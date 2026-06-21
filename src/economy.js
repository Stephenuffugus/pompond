/* ============================================================
   ECONOMY (hybrid bucket ladder) — PURE, no DOM, no persistence.

   Ported VERBATIM from the prototype's earn -> checkSmall ->
   checkMedium -> checkBig -> resolveChoice chain. The ONLY change
   from the prototype is mechanical: functions take an explicit
   `fam` and push newly-minted critters into a caller-supplied
   `reveals` array instead of mutating module globals. The math,
   ordering, and side-effects are identical — the jsdom harness is
   the contract.

   Dual-mode: inlined into the browser build AND require()-d by the
   Cloud Functions, so the server runs the SAME ladder transactionally
   (kids can never compute their own economy result — §5).
   ============================================================ */
(function (root, factory) {
  const CritterEngine = root.CritterEngine ||
    (typeof require !== 'undefined' ? require('./critter-engine.js') : null);
  const mod = factory(CritterEngine);
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
  root.Economy = mod;
})(typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : this), function (CritterEngine) {

  function id(){return Math.random().toString(36).slice(2,9);}
  function today(now){return new Date(now||Date.now()).toISOString().slice(0,10);}
  const doneKey=(kid,chore,now)=>kid.id+"|"+chore.id+"|"+today(now);
  const isDoneToday=(fam,kid,chore,now)=>!!fam.done[doneKey(kid,chore,now)];

  function addCritter(fam,ownerId,rarity,special,tag,reveals,reason){
    const arch=CritterEngine.randomArchetype();
    const c={id:id(),ownerId,seed:ownerId+":"+Date.now()+":"+Math.random().toString(36).slice(2),
             archetype:arch,rarity,special:!!special,tag:tag||null,reason:reason||null,createdAt:Date.now()};
    fam.critters.push(c); if(reveals)reveals.push(c); return c;
  }
  function grant(fam,kid,tier){ fam.inventory.push({id:id(),ownerId:kid.id,tier,status:"ready",at:Date.now()}); }
  function logEvent(fam,kid,type,note,byUid){
    fam.log.unshift({id:id(),ownerId:kid.id,type,note:note||"",at:Date.now(),byUid:byUid||null});
    if(fam.log.length>60)fam.log.length=60;
  }
  function bumpStreak(fam,kid,now){
    const d=today(now); if(kid.lastActive===d)return;
    const y=new Date((now||Date.now())-864e5).toISOString().slice(0,10);
    kid.streak=(kid.lastActive===y)?(kid.streak||0)+1:1; kid.lastActive=d;
  }

  function earn(fam,kid,opts,reveals){          // opts:{type, special, note, byUid}
    opts=opts||{};
    kid.palms=(kid.palms||0)+1;
    bumpStreak(fam,kid);
    // why this critter exists, in plain words — so a kid can tap it and remember.
    const reason=opts.type==="kindness"?("A kind thing"+(opts.note?" — "+opts.note:""))
      :opts.type==="school"?("School"+(opts.note?" — "+opts.note:""))
      :(opts.note||"Did a chore");
    addCritter(fam,kid.id,opts.special?1:0,opts.special,opts.special?opts.type:null,reveals,reason);
    kid.buckets.s++;
    logEvent(fam,kid,opts.type||"chore",opts.note,opts.byUid);
    checkSmall(fam,kid,reveals);
  }
  function checkSmall(fam,kid,reveals){
    const cap=fam.settings.smallCap;
    if(kid.buckets.s>=cap){
      kid.buckets.s-=cap;
      grant(fam,kid,"small");
      addCritter(fam,kid.id,1,false,null,reveals,"Bonus for filling the Small pond 💧");   // fused tier-1 critter
      kid.buckets.m++;
      checkMedium(fam,kid,reveals);
    }
  }
  function checkMedium(fam,kid,reveals){
    const cap=fam.settings.medCap;
    if(kid.buckets.m>=cap){
      kid.buckets.m-=cap;
      grant(fam,kid,"medium");
      addCritter(fam,kid.id,2,false,null,reveals,"Reward for filling the Medium pond 🌊");
      kid.choices=(kid.choices||0)+1;                // HYBRID: queue save-vs-keep
    }
  }
  function resolveChoice(fam,kid,saveUp,reveals){
    if(kid.choices>0)kid.choices--;
    if(saveUp){ kid.buckets.b++; checkBig(fam,kid,reveals); }
  }
  function checkBig(fam,kid,reveals){
    const cap=fam.settings.bigCap;
    if(kid.buckets.b>=cap){
      kid.buckets.b-=cap;
      grant(fam,kid,"big");
      addCritter(fam,kid.id,3,false,null,reveals,"Showpiece for filling the Big pond 🪷");   // showpiece
    }
  }

  // Returns: {status:'already'|'pending'|'earned'}; mutates fam accordingly.
  function completeChore(fam,kid,chore,reveals,opts){
    opts=opts||{};
    if(isDoneToday(fam,kid,chore)) return {status:'already'};
    fam.done[doneKey(kid,chore)]=true;
    if(fam.settings.approval && !opts.forceEarn){
      fam.pending.push({id:id(),ownerId:kid.id,choreId:chore.id,at:Date.now()});
      return {status:'pending'};
    }
    earn(fam,kid,{type:'chore',byUid:opts.byUid,note:chore.name},reveals);  // note=chore name so kids can see what each Pom was for
    return {status:'earned'};
  }

  /* ---- combining (fusion) — DETERMINISTIC from the parent seeds ----
     Build the spec for a child critter fused from 2–3 parents. Pure: the server
     and the browser both call this so they agree on the result. Fusing UPGRADES
     rarity (min(3, best parent + (3-fuse ? 2 : 1))) and the archetype is derived
     from the child seed across ALL species, so combining can discover new ones. */
  function makeCombo(parents){
    const seed=CritterEngine.combineSeed(parents.map(p=>p.seed));
    const archetype=CritterEngine.archetypeFor(seed);
    const maxR=parents.reduce((m,p)=>Math.max(m,p.rarity||0),0);
    const rarity=Math.min(3, maxR + (parents.length>=3 ? 2 : 1));
    const names=parents.map(p=>CritterEngine.name(p.archetype)).join(' + ');
    return { seed, archetype, rarity, special:true, tag:'combo', reason:'Combined from '+names };
  }
  // Local-mode fusion: remove the parents from fam, append the child. Returns the
  // child (or {reject}). The server does the same via the Admin SDK (doc ops).
  function combine(fam,kid,parentIds,reveals,opts){
    opts=opts||{};
    const parents=parentIds.map(pid=>fam.critters.find(c=>c.id===pid&&c.ownerId===kid.id)).filter(Boolean);
    if(parents.length<2||parents.length>3) return {reject:'Pick 2 or 3 of your own critters.'};
    if(new Set(parentIds).size!==parents.length) return {reject:'Pick different critters.'};
    const spec=makeCombo(parents);
    const child=Object.assign({id:id(),ownerId:kid.id,createdAt:Date.now()},spec);
    const drop=new Set(parents.map(p=>p.id));
    fam.critters=fam.critters.filter(c=>!drop.has(c.id));
    fam.critters.push(child); if(reveals)reveals.push(child);
    logEvent(fam,kid,'combine',spec.reason,opts.byUid);
    return {child};
  }

  return {
    id, today, doneKey, isDoneToday,
    addCritter, grant, logEvent, bumpStreak,
    earn, checkSmall, checkMedium, checkBig, resolveChoice, completeChore,
    makeCombo, combine
  };
});
