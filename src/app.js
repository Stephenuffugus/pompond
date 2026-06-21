/* ============================================================
   APP — state, router, views, sheets, FX.
   Ported from the prototype. Economy math lives in Economy.* (shared
   with the server); CritterEngine + store are separate modules.
   In LOCAL mode every path below behaves exactly like the prototype
   (the jsdom harness is the contract). In CLOUD mode (js/cloud.js
   active) the economy-affecting actions route to Cloud Functions and
   live state arrives via onSnapshot -> PP.applySnapshot().
   ============================================================ */
  const PP = (window.PomPond = window.PomPond || {});
  const cloudActive = () => Backend.cloudActive();

  const ARCHETYPES = CritterEngine.list;
  const renderCritter = (seed,archetype,rarity)=>CritterEngine.render(seed,archetype,rarity);

  /* ---------- state ---------- */
  function id(){return Math.random().toString(36).slice(2,9);}
  const C_EMOJI=["🧹","🧺","🍽️","🛏️","🗑️","🪥","🐕","🌱","📚","🧼","🚿","🧦","🧽","🍳","🪣","👕","🪟","🦷","✏️","🎒"];
  const R_EMOJI=["🍿","🎮","🍕","🎬","🍦","🛝","📺","🧸","💵","🎨","🎟️","🧁","⚽","🚲","🏊","🐶"];
  const KID_EMOJI=["🦊","🐼","🐯","🦁","🐸","🐵","🐶","🐱","🦄","🐧","🐢","🦖","🐙","🦋","🐝","🦉","🐰","🐨"];
  const ADULT_EMOJI=["🧑‍🍳","👩","👨","👵","👴","🧕","👩‍🦰","🧔","👩‍🦳","👨‍🦳","🧑‍🌾","👩‍🏫","👨‍🍳","🦸","🧑‍💻","👩‍⚕️"];
  const COLORS=["#FF8A5B","#5BB1FF","#5BB98C","#C98BFF","#FFC24B","#FF6FA5","#4EC6C6","#9FCB55"];
  /* Freely-given Poms — a rich, organised list of positive reasons (inspired by
     ClassDojo's default behaviours + their at-home routines, tuned for families).
     `key` is the small category enum the server validates; the specific label is
     stored as the Pom's reason. Add/trim freely — the server allows any key here. */
  const GIVE_CATS=[
    {key:"kindness",emoji:"💛",name:"Kindness",reasons:[
      ["🤗","Was kind to someone"],["🤝","Shared without being asked"],["🫂","Comforted someone"],
      ["👋","Included someone"],["🐾","Gentle with a pet"],["💌","Said something nice"]]},
    {key:"helping",emoji:"🤝",name:"Helping",reasons:[
      ["🙋","Helped without being asked"],["🧒","Helped a sibling"],["🍽️","Helped make dinner"],
      ["🧹","Cleaned up extra"],["🛒","Helped with errands"],["💪","Did a big job"]]},
    {key:"effort",emoji:"🚀",name:"Effort & Grit",reasons:[
      ["🚀","Tried really hard"],["🧗","Didn't give up"],["🎯","Practiced something"],
      ["🌱","Great attitude"],["⏰","Did it right away"],["🧠","Solved a problem"]]},
    {key:"respect",emoji:"🙏",name:"Manners & Respect",reasons:[
      ["🙏","Used good manners"],["🗣️","Please & thank you"],["👂","Listened well"],
      ["⏳","Waited their turn"],["✅","Told the truth"],["😌","Stayed calm"]]},
    {key:"school",emoji:"🏫",name:"School & Learning",reasons:[
      ["🏫","Great day at school"],["📚","Finished homework"],["📖","Read a book"],
      ["⭐","Caught being good"],["✏️","Did their best work"],["🎨","Got creative"]]},
    {key:"family",emoji:"🏡",name:"Family & Home",reasons:[
      ["🏡","Great family time"],["🐶","Looked after a pet"],["🏆","Good sport"],
      ["🛏️","Got ready on time"],["😴","Smooth bedtime"],["🌟","Big helper today"]]}
  ];
  const CATMAP={}; GIVE_CATS.forEach(c=>CATMAP[c.key]={emoji:c.emoji,name:c.name});
  CATMAP.custom={emoji:"⭐",name:"Bonus"};   // parent-defined "Your reasons"

  function defaultFamily(){
    return {
      setup:false,
      name:"Our Family",
      settings:{smallCap:4, medCap:3, bigCap:2, approval:false, parentPin:"0000"},
      members:[ {id:"p1", name:"Parent", role:"parent", emoji:"🧑‍🍳", color:"#3FA7A1"} ],
      chores:[
        {id:id(), name:"Tidy Room", emoji:"🛏️", secs:600, palm:1},
        {id:id(), name:"Dishes", emoji:"🍽️", secs:300, palm:1},
        {id:id(), name:"Brush Teeth", emoji:"🪥", secs:120, palm:1},
        {id:id(), name:"Feed Pet", emoji:"🐕", secs:180, palm:1}
      ],
      rewards:[
        {id:id(), name:"15 min screen time", emoji:"📺", tier:"small"},
        {id:id(), name:"Pick dinner", emoji:"🍕", tier:"medium"},
        {id:id(), name:"Movie night", emoji:"🎬", tier:"big"}
      ],
      critters:[], inventory:[], pending:[], log:[], done:{}
    };
  }

  // normalize older / cloud-sourced state into the runtime shape
  function normalizeFam(f){
    f.settings=f.settings||{}; f.members=f.members||[]; f.chores=f.chores||[];
    f.rewards=f.rewards||[]; f.critters=f.critters||[]; f.inventory=f.inventory||[];
    f.log=f.log||[]; f.done=f.done||{}; f.pending=f.pending||[];
    if(f.setup===undefined) f.setup = f.members.some(m=>m.role==="child");
    f.members.forEach(m=>{ if(m.role==="child"){ m.buckets=m.buckets||{s:0,m:0,b:0}; m.choices=m.choices||0; m.streak=m.streak||0; if(m.lastActive===undefined)m.lastActive=null; } });
    return f;
  }

  let fam = normalizeFam( Backend.loadLocal() || defaultFamily() );
  function save(){
    if(cloudActive() && Backend.cloud.saveCrud){ try{ Backend.cloud.saveCrud(fam); }catch(e){} }
    Backend.saveLocal(fam);
  }

  let view=fam.setup?"lobby":"setup", meId=null;
  const timer={choreId:null,kidId:null,remaining:0,total:0,running:false,int:null};

  const members=()=>fam.members;
  const kids=()=>fam.members.filter(m=>m.role==="child");
  const member=mid=>fam.members.find(m=>m.id===mid);
  const me=()=>member(meId);
  const choresFor=kid=>fam.chores.filter(c=>!c.assignedTo||c.assignedTo===kid.id);
  // chores assigned to a grown-up — visibility/accountability only (no economy).
  const adultChores=()=>fam.chores.filter(c=>{const m=member(c.assignedTo);return !!(m&&m.role==="parent");});
  const choreDoneToday=c=>c.doneDate===today();
  function toggleAdultChore(c){
    if(choreDoneToday(c)){ c.doneDate=null; c.doneCount=Math.max(0,(c.doneCount||0)-1); }
    else { c.doneDate=today(); c.doneCount=(c.doneCount||0)+1; }
    save(); render();
  }
  const rewardsTier=t=>fam.rewards.filter(r=>r.tier===t);
  const crittersOf=mid=>fam.critters.filter(c=>c.ownerId===mid);
  const invOf=mid=>fam.inventory.filter(i=>i.ownerId===mid);
  function fmt(s){s=Math.max(0,Math.round(s));return String(Math.floor(s/60)).padStart(2,"0")+":"+String(s%60).padStart(2,"0");}
  function esc(s){return String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));}

  /* ---------- currency: Poms (renameable per family) ---------- */
  const cname=()=>fam.settings.currencyName||"Pom";
  const cnames=()=>{const n=cname();return /s$/i.test(n)?n:n+"s";};
  function pomIcon(sz){sz=sz||16;
    let dots="";for(let i=0;i<10;i++){const a=i/10*Math.PI*2;
      dots+=`<circle cx="${(50+30*Math.cos(a)).toFixed(1)}" cy="${(50+30*Math.sin(a)).toFixed(1)}" r="16" fill="hsl(${(i*36+10)%360},78%,66%)"/>`;}
    return `<svg viewBox="0 0 100 100" width="${sz}" height="${sz}" style="vertical-align:-${Math.round(sz*0.15)}px">${dots}<circle cx="50" cy="50" r="26" fill="hsl(45,90%,70%)"/><circle cx="43" cy="44" r="7" fill="hsl(45,95%,85%)"/></svg>`;}
  /* top-down pond icons for the three reward meters — grander as the tier goes up */
  function pondTierIcon(tier){
    const water=`<ellipse cx="50" cy="52" rx="45" ry="31" fill="#3E92B4"/>`+
      `<ellipse cx="50" cy="49" rx="40" ry="26" fill="#5FB7C6"/>`+
      `<ellipse cx="38" cy="38" rx="15" ry="6" fill="#cdf3ef" opacity=".6"/>`;
    const pad=(cx,cy,r)=>`<circle cx="${cx}" cy="${cy}" r="${r}" fill="#4FA86A"/><circle cx="${cx-r*0.32}" cy="${cy-r*0.32}" r="${r*0.5}" fill="#6cc188"/>`;
    const lotus=(cx,cy)=>{let p='';for(let i=0;i<6;i++){const a=(i/6)*Math.PI*2;p+=`<circle cx="${(cx+7*Math.cos(a)).toFixed(1)}" cy="${(cy+7*Math.sin(a)).toFixed(1)}" r="4" fill="#FF9EC4"/>`;}return p+`<circle cx="${cx}" cy="${cy}" r="4.4" fill="#FFD86B"/>`;};
    let extra='', rim='';
    if(tier==="m") extra=pad(64,55,15);
    if(tier==="b"){ extra=pad(28,62,11)+lotus(58,47)+`<circle cx="80" cy="42" r="2.4" fill="#fff"/><circle cx="22" cy="44" r="1.8" fill="#fff"/>`;
      rim=`<ellipse cx="50" cy="52" rx="47" ry="33" fill="none" stroke="#F2B33B" stroke-width="3"/>`; }
    return `<svg viewBox="0 0 100 100" width="46" height="40" style="display:block;margin:2px auto">${water}${extra}${rim}</svg>`;
  }

  /* ============================================================
     ECONOMY WRAPPERS — local path is verbatim prototype behavior;
     cloud path routes to server-authoritative Cloud Functions.
     ============================================================ */
  let revealQ=[];
  let pondZoom=1, pondPanX=0, pondPanY=0;   // pond view state — persists across re-renders
  // Where the kid has dragged each critter (x%,y% per critter id). This is a
  // per-DEVICE view preference in localStorage — kids can't write economy state
  // (rules deny it), and a critter's spot is cosmetic, not shared family data.
  let critterPos=(()=>{ try{ return JSON.parse(localStorage.getItem("pp_critterpos")||"{}")||{}; }catch(e){ return {}; } })();
  function saveCritterPos(){ try{ localStorage.setItem("pp_critterpos",JSON.stringify(critterPos)); }catch(e){} }
  let combineMode=false, combineSel=[];   // 🧬 fusion: select-and-combine state (kid view)
  const today=()=>Economy.today();
  const isDoneToday=(kid,chore)=>Economy.isDoneToday(fam,kid,chore);

  function completeChore(kid,chore){
    if(cloudActive()){ Backend.cloud.completeChore(kid.id,chore.id).catch(e=>toast("Couldn't reach server — try again")); return; }
    const r=Economy.completeChore(fam,kid,chore,revealQ);
    if(r.status==='already'){ toast("Already done today ✅"); render(); return; }
    save();
    if(r.status==='pending'){ render(); toast("Sent to a parent for approval ✅"); return; }
    playReveals(kid.id);
  }
  function approve(p){
    if(cloudActive()){ Backend.cloud.approve(p.id).catch(()=>toast("Couldn't reach server")); return; }
    const kid=member(p.ownerId); if(kid){ const ch=fam.chores.find(c=>c.id===p.choreId); Economy.earnTimes(fam,kid,{type:"chore",note:ch?ch.name:""},revealQ, ch?ch.palm:1); }
    revealQ=[];                                  // reveals are for the kid's device, not the parent's
    fam.pending=fam.pending.filter(x=>x.id!==p.id); save(); render();
  }
  function givePom(kid,src,note,n){
    n=Math.max(1,Math.min(3,n||1));
    if(cloudActive()){ Backend.cloud.givePom(kid.id,src,note,n).catch(()=>toast("Couldn't reach server")); return; }
    Economy.earnTimes(fam,kid,{type:src,special:true,note:note,byUid:"local-parent"},revealQ,n); revealQ=[]; save();
  }
  function resolveChoice(kid,saveUp){
    if(cloudActive()){ Backend.cloud.resolveChoice(kid.id,saveUp).catch(()=>toast("Couldn't reach server")); return; }
    Economy.resolveChoice(fam,kid,saveUp,revealQ); save();
    playReveals(kid.id,()=>{ if((kid.choices||0)>0)choiceModal(kid); });
  }
  // 🧬 fuse 2–3 of the kid's critters into one new one (server-authoritative in
  // cloud mode; same shared math locally). Consumed parents lose their saved spot.
  function doCombine(kid,ids){
    const cleanup=()=>{ ids.forEach(id=>{ delete critterPos[id]; }); saveCritterPos(); };
    if(cloudActive()){ Backend.cloud.combine(kid.id,ids).then(cleanup).catch(()=>toast("Couldn't reach server — try again")); return; }
    const r=Economy.combine(fam,kid,ids,revealQ,{byUid:"local"});
    if(r.reject){ toast(r.reject); return; }
    cleanup(); save(); playReveals(kid.id);
  }

  /* play earned-critter reveals (only on the earning kid's own screen) */
  function playReveals(kidId,done){
    const q=revealQ; revealQ=[];
    render();
    if(meId!==kidId||view!=="kid"||!q.length){ if(done)done(); return; }
    let i=0;
    const next=()=>{ if(i>=q.length){ render(); if(done)done(); return; } showReveal(q[i],()=>{ i++; next(); }); };
    setTimeout(next,160);
  }
  function showReveal(c,cb){
    const ov=document.getElementById("reveal");
    const label=c.special?(c.tag==="combo"?"🧬 New Fusion!":CATMAP[c.tag]?CATMAP[c.tag].emoji+" "+CATMAP[c.tag].name+"!":"✨ Bonus Critter!"):c.rarity>=3?"🏆 LEGENDARY!":c.rarity===2?"💎 Rare Evolution!":c.rarity===1?"⬆️ Evolved!":"🥚 New Critter!";
    ov.innerHTML=`<div class="reveal-card"><div class="rl-sub">${label}</div><div class="rl-art">${renderCritter(c.seed,c.archetype,c.rarity)}</div><div class="rl-name">${CritterEngine.name(c.archetype)} · ${CritterEngine.rarityName(c.rarity)}</div><div class="rl-tap">tap to continue</div></div>`;
    ov.classList.add("show"); confetti(); beep(c.rarity>=2||c.special);
    let fin=false; const close=()=>{ if(fin)return; fin=true; ov.classList.remove("show"); cb&&cb(); };
    ov.onclick=close; setTimeout(close,c.rarity>=2?2400:1500);
  }

  /* ============================================================
     ROUTER
     ============================================================ */
  const app=document.getElementById("app");
  function render(){
    if(view==="setup")return renderSetup();
    if(view==="lobby")return renderLobby();
    if(view==="parent")return renderParent();
    if(view==="kid")return renderKid();
  }

  /* ============================================================
     FIRST-RUN SETUP WIZARD
     ============================================================ */
  const setupParent=()=>fam.members.find(m=>m.role==="parent");
  const setupParentName=()=>{const p=setupParent();return p&&p.name&&p.name!=="Parent"?p.name:"";};
  const setupPin=()=>{const p=fam.settings.parentPin;return p&&p!=="0000"?p:"";};
  function renderSetup(){
    document.body.classList.remove("editing");
    const kidList=kids().map(k=>`
      <div class="row" style="--kc:${k.color}"><span class="emo">${k.emoji}</span>
        <div class="grow"><div class="rn">${esc(k.name)}</div></div>
        <button class="mini ghost" data-edit="${k.id}">Edit</button></div>`).join("");
    app.innerHTML=`
      <div class="setup-hero">
        <div class="setup-art">${["frog","duck","turtle"].map((a,i)=>`<div class="sa-c" style="animation-delay:${i*.5}s">${renderCritter("welcome:"+a,a,1)}</div>`).join("")}</div>
        <h1>Welcome to<br>Pom Pond! 🐸</h1>
        <p>Kids do chores &amp; kind things, earn <b>Poms</b> ${pomIcon(18)}, hatch critters into their own pond, and fill <b>reward ponds</b> to unlock <b>rewards you choose</b>.</p>
      </div>
      <div class="setup-card">
        <div class="field"><label>Your family name</label><input id="sfn" maxlength="20" value="${esc(fam.name)}" placeholder="The Smiths"></div>
        <div class="field"><label>Your name <span style="text-transform:none;font-weight:700">(the grown-up)</span></label>
          <input id="spnm" maxlength="14" value="${esc(setupParentName())}" placeholder="e.g. Mum, Dad, Sam"></div>
        <div class="field"><label>Choose a Parent PIN <span style="text-transform:none;font-weight:700">(keeps kids out of the parent screen)</span></label>
          <input id="spn" inputmode="numeric" maxlength="4" value="${esc(setupPin())}" placeholder="Pick 4 digits"></div>
        <div class="field"><label>Your kids</label>
          <div class="rows" id="skids">${kidList||'<div class="hint" style="margin:4px 0">No kids yet — add your first!</div>'}</div>
          <button class="iconbtn go" id="saddkid" style="width:100%;margin-top:10px;justify-content:center">+ Add a kid</button></div>
        <button class="btn-big" id="sgo" ${kids().length?"":"disabled"}>Let's go! 🎉</button>
        <div class="hint" style="margin-top:12px">Starter chores &amp; rewards are loaded — you can change everything later in the Parent screen.</div>
      </div>`;
    const stash=()=>{ fam.name=app.querySelector("#sfn").value.trim()||fam.name;
      fam.settings.parentPin=app.querySelector("#spn").value||fam.settings.parentPin;
      const p=setupParent(),pn=app.querySelector("#spnm").value.trim(); if(p&&pn)p.name=pn; };
    app.querySelector("#saddkid").onclick=()=>{stash();kidSheet(null);};
    app.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>{stash();kidSheet(member(b.dataset.edit));});
    app.querySelector("#sgo").onclick=()=>{
      const pin=app.querySelector("#spn").value.replace(/\D/g,"");
      if(pin.length!==4){ toast("Choose a 4-digit Parent PIN 🔒"); const el=app.querySelector("#spn"); if(el)el.focus(); return; }
      fam.name=app.querySelector("#sfn").value.trim()||"Our Family";
      fam.settings.parentPin=pin;
      const p=setupParent(),pn=app.querySelector("#spnm").value.trim(); if(p&&pn)p.name=pn;
      fam.setup=true; save(); view="lobby"; render(); confetti(); beep(true);
      if(cloudActive() && Backend.cloud.onSetupComplete) Backend.cloud.onSetupComplete(fam);
    };
  }

  function renderLobby(){
    document.body.classList.remove("editing");
    app.innerHTML=`
      <div class="topbar"><div class="brand">🐸 <h1>Pom Pond</h1></div>
        <span>${showInstall()?'<button class="iconbtn go" id="install">📲 Get app</button> ':''}${cloudActive()?'<button class="iconbtn" id="acct">👤</button> ':''}<button class="iconbtn" id="gallery">🎨 Critters</button></span></div>
      <div class="label"><span>Who's here?</span><span class="ln"></span></div>
      <div class="lobby-grid" id="lg"></div>
      <div class="hint">Parents manage chores & rewards · kids do chores and grow their Pond</div>`;
    app.querySelector("#gallery").onclick=galleryModal;
    const ib=app.querySelector("#install"); if(ib)ib.onclick=doInstall;
    const acct=app.querySelector("#acct"); if(acct&&Backend.cloud.accountSheet) acct.onclick=()=>Backend.cloud.accountSheet();
    const lg=app.querySelector("#lg");
    fam.members.forEach(m=>{
      const b=document.createElement("button"); b.className="lobby-card"; b.style.setProperty("--kc",m.color);
      b.innerHTML=`<span class="disc">${m.emoji}</span><span class="nm">${esc(m.name)}</span><span class="rl">${m.role==="parent"?"Parent":"Kid"}</span>`;
      b.onclick=()=>enter(m);
      lg.appendChild(b);
    });
  }
  function enter(m){
    // In cloud mode, a kid device bound to one member can only enter as that member.
    if(cloudActive() && Backend.cloud.boundMemberId){
      const bound=Backend.cloud.boundMemberId();
      if(bound && m.id!==bound && m.role==="child"){ toast("This device belongs to another kid"); return; }
    }
    if(m.role==="parent"){
      // Cloud: a kid principal can never pass into parent mode even with the PIN.
      if(cloudActive() && Backend.cloud.isParent && !Backend.cloud.isParent()){ toast("Ask a parent to sign in on their device"); return; }
      askPin(ok=>{ if(ok){meId=m.id;view="parent";render();} });
    }else{ meId=m.id; view="kid"; render(); }
  }
  function askPin(cb){
    const canReset = cloudActive() && Backend.cloud && Backend.cloud.isParent && Backend.cloud.isParent();
    openSheet(`<h3>Parent PIN</h3>
      <div class="field"><label>Enter PIN</label><input id="pin" inputmode="numeric" maxlength="4" placeholder="••••"></div>
      <div class="hint" id="pinerr" style="color:#E5524B;min-height:16px;margin-top:-8px;text-align:left"></div>
      <div class="sa"><button class="cancel">Cancel</button><button class="save">Enter</button></div>
      ${canReset?'<button class="gbtn" id="forgotpin" style="margin-top:10px">Forgot PIN? Reset it</button>':''}`,sheet=>{
      const pin=sheet.querySelector("#pin");
      const tryit=()=>{
        const v=pin.value;
        if(v===fam.settings.parentPin){ closeSheet(); cb(true); }
        else { sheet.querySelector("#pinerr").textContent="Wrong PIN — try again."; pin.value=""; pin.focus(); }
      };
      sheet.querySelector(".cancel").onclick=closeSheet;
      sheet.querySelector(".save").onclick=tryit;
      pin.onkeydown=(e)=>{ if(e.key==="Enter"){ e.preventDefault(); tryit(); } };
      const fp=sheet.querySelector("#forgotpin"); if(fp) fp.onclick=resetPinFlow;
      setTimeout(()=>{if(pin)pin.focus();},60);
    });
  }
  // A signed-in cloud parent can always reset the PIN (the PIN is just a
  // keep-kids-out gate; the real auth is their account). Kids never see this.
  function resetPinFlow(){
    openSheet(`<h3>Reset Parent PIN 🔒</h3>
      <p style="font-weight:700;color:var(--soft);font-size:13px;margin-top:-6px">You're signed in as a parent, so you can set a new PIN now.</p>
      <div class="field"><label>New 4-digit PIN</label><input id="npin" inputmode="numeric" maxlength="4" placeholder="••••"></div>
      <div class="hint" id="npinerr" style="color:#E5524B;min-height:16px;margin-top:-8px;text-align:left"></div>
      <div class="sa"><button class="cancel">Cancel</button><button class="save">Save PIN</button></div>`,sheet=>{
      const np=sheet.querySelector("#npin");
      sheet.querySelector(".cancel").onclick=closeSheet;
      sheet.querySelector(".save").onclick=()=>{
        const v=(np.value||"").replace(/\D/g,"");
        if(v.length!==4){ sheet.querySelector("#npinerr").textContent="Enter exactly 4 digits."; return; }
        fam.settings.parentPin=v; save(); closeSheet(); toast("PIN updated 🔒 — tap your tile and enter it.");
      };
      setTimeout(()=>{if(np)np.focus();},60);
    });
  }

  /* ============================================================
     KID VIEW
     ============================================================ */
  function renderKid(){
    document.body.classList.remove("editing");
    const kid=me(); const cap=fam.settings;
    const ready=invOf(kid.id).filter(i=>i.status==="ready");
    app.innerHTML=`
      <div class="topbar"><div class="brand">🐸 <h1>${esc(fam.name)}</h1></div>
        <span>${showInstall()?'<button class="iconbtn go" id="install">📲</button> ':''}<button class="iconbtn" id="dex">📖</button> <button class="iconbtn" id="leave">⤺</button></span></div>
      <div class="me" style="--kc:${kid.color}">
        <div class="disc">${kid.emoji}</div>
        <div class="info"><h2>${esc(kid.name)}'s Pond</h2>
          <div class="palms"><button class="palmchip" id="palmlog" aria-label="See what you earned ${esc(cnames())} for">${pomIcon(15)} <b>${kid.palms||0}</b> ${cnames()} <span class="pchev">›</span></button> · ${crittersOf(kid.id).length} critters${kid.streak?` · 🔥 ${kid.streak}-day streak`:""}</div></div>
      </div>
      <div class="buckets">
        ${bucketHTML("s","Small",kid.buckets.s,cap.smallCap)}
        ${bucketHTML("m","Medium",kid.buckets.m,cap.medCap)}
        ${bucketHTML("b","Big",kid.buckets.b,cap.bigCap)}
      </div>
      ${ready.length?`<div class="label"><span>Rewards to spend 🎉</span><span class="ln"></span></div><div class="tokens" id="tok"></div>`:""}
      <div class="label"><span>My Pond</span><span class="ln"></span>${(!combineMode&&crittersOf(kid.id).length>=2)?`<button class="combinebtn" id="combineBtn">🧬 Combine</button>`:""}</div>
      ${combineMode?`<div class="combinebar"><span id="combinemsg">Tap 2–3 critters to fuse ✨</span><span class="cbtns"><button id="combineCancel">Cancel</button><button id="combineGo" disabled>Fuse</button></span></div>`:""}
      <div class="pond" id="pond"></div>
      <div class="label"><span>Do a chore</span><span class="ln"></span></div>
      <div class="chore-list" id="cl"></div>
      ${adultChores().length?`<div class="label"><span>Grown-ups are doing chores too 💪</span><span class="ln"></span></div><div class="rows" id="adultcl"></div>`:""}
      <div class="hint">Finish a chore → earn a ${esc(cname())} → a critter joins your pond. Drag critters to move them, tap to see what they're for!</div>`;
    app.querySelector("#leave").onclick=()=>{meId=null;view="lobby";combineMode=false;combineSel=[];render();};
    app.querySelector("#dex").onclick=()=>dexModal(kid);
    const plog=app.querySelector("#palmlog"); if(plog)plog.onclick=()=>palmHistory(kid);
    const kib=app.querySelector("#install"); if(kib)kib.onclick=doInstall;
    const cbtn=app.querySelector("#combineBtn"); if(cbtn)cbtn.onclick=()=>{ combineMode=true; combineSel=[]; render(); };
    if(combineMode){
      const cc=app.querySelector("#combineCancel"); if(cc)cc.onclick=()=>{ combineMode=false; combineSel=[]; render(); };
      const cg=app.querySelector("#combineGo"); if(cg)cg.onclick=()=>{ if(combineSel.length<2)return; const ids=combineSel.slice(); combineMode=false; combineSel=[]; render(); doCombine(kid,ids); };
      updateCombineBar();
    }

    if(ready.length){
      const tok=app.querySelector("#tok");
      ready.forEach(i=>{const t=document.createElement("div");t.className="token";
        t.innerHTML=`<span class="pill">${i.tier}</span> Tap to redeem`;
        t.onclick=()=>redeemFlow(kid,i); tok.appendChild(t);});
    }
    paintPond(kid);
    const cl=app.querySelector("#cl");
    choresFor(kid).forEach(c=>{const done=isDoneToday(kid,c);
      const d=document.createElement("button");d.className="chore"+(done?" done":"");
      d.innerHTML=`${done?'<span class="check">✓</span>':""}<span class="emo">${c.emoji}</span><span class="cn">${esc(c.name)}</span><span class="meta">${done?"Done today!":"⏱ "+fmt(c.secs)+" · "+pomIcon(13)+" "+c.palm}</span>`;
      d.onclick=()=>{ if(done){toast("Already done today ✅");return;} openTimer(kid,c); };
      cl.appendChild(d);});

    const acl=app.querySelector("#adultcl");
    if(acl) adultChores().forEach(c=>{const who=member(c.assignedTo);const done=choreDoneToday(c);
      const row=document.createElement("div");row.className="row";if(who)row.style.setProperty("--kc",who.color);
      row.innerHTML=`<span class="emo">${c.emoji}</span><div class="grow"><div class="rn">${esc(c.name)}</div><div class="rs">${who?esc(who.name):"Grown-up"}${(c.doneCount||0)?` · done ${c.doneCount}×`:""}</div></div>`
        +(done?'<span class="mini" style="background:#5BB98C">✓ today</span>':'<span class="rs" style="color:var(--soft);font-weight:800">not yet</span>');
      acl.appendChild(row);});

    if((kid.choices||0)>0) setTimeout(()=>choiceModal(kid),350);
  }
  function bucketHTML(k,name,val,cap){
    const pct=Math.min(100,(val/cap)*100);
    const ic=pondTierIcon(k);
    return `<div class="bucket ${k}"><div class="bt">${name}</div><div class="bn">${ic}</div>
      <div class="frac">${val}/${cap}</div><div class="pbar"><i style="width:${pct}%"></i></div></div>`;
  }
  function paintPond(kid){
    const pond=app.querySelector("#pond"); const all=crittersOf(kid.id); const list=all.slice(-28);
    pond.innerHTML="";
    // Everything pannable/zoomable lives in the stage; badges + zoom buttons sit outside it.
    const stage=document.createElement("div"); stage.className="pond-stage";
    // CSS lily pads (disc with the classic V-notch), some with a lotus flower
    [[14,58,58],[66,26,48],[44,74,42],[78,60,54]].forEach(([x,y,w],i)=>{
      const p=document.createElement("div");p.className="pad";
      p.style.left=x+"%";p.style.top=y+"%";p.style.width=w+"px";p.style.height=Math.round(w*0.7)+"px";
      p.style.animationDelay=(i*0.8)+"s";stage.appendChild(p);
      if(i%2===0){const f=document.createElement("div");f.className="lily";f.textContent="🌸";
        f.style.left=(x+3)+"%";f.style.top=(y-3)+"%";f.style.fontSize="18px";f.style.animationDelay=(i*0.8)+"s";stage.appendChild(f);}
    });
    // reeds near the back corners + a few gentle ripples for life
    [10,84].forEach(x=>{const r=document.createElement("div");r.className="reed";r.textContent="🌾";r.style.left=x+"%";stage.appendChild(r);});
    [[34,44],[62,56],[48,70]].forEach(([x,y],i)=>{const rp=document.createElement("div");rp.className="ripple";
      rp.style.left=x+"%";rp.style.top=y+"%";rp.style.animationDelay=(i*1.7)+"s";stage.appendChild(rp);});
    const n=list.length;
    if(!n){const em=document.createElement("div");em.className="empty";
      em.innerHTML="Your pond is empty.<br>Do a chore to hatch your first critter! 🐣";stage.appendChild(em);}
    else list.forEach((c,i)=>{const w=document.createElement("div");w.className="critter";
      const sp=critterPos[c.id];
      // golden-angle (phyllotaxis) spiral, scaled by COUNT so the critters fill
      // the whole pond evenly whether there are 3 or 28 — no diagonal banding,
      // never clustered in the middle. Dragged critters keep their saved spot.
      const a=i*2.399963, rr=(n>1?Math.sqrt((i+0.6)/n):0);
      const dx=sp?sp.x:(50+Math.cos(a)*rr*40), dy=sp?sp.y:(52+Math.sin(a)*rr*34);
      w.style.left=dx+"%"; w.style.top=dy+"%";
      w.style.animationDelay=(i%6)*0.4+"s";
      w.style.transform=`scale(${1+c.rarity*0.12})`;
      w.innerHTML=renderCritter(c.seed,c.archetype,c.rarity);
      if(combineMode&&combineSel.includes(c.id))w.classList.add("csel");
      makeCritterDraggable(w,c,pond);
      stage.appendChild(w);});
    pond.appendChild(stage);
    const count=document.createElement("div");count.className="pondcount";count.textContent=all.length+" 🪷";pond.appendChild(count);
    if(list.length){
      const zc=document.createElement("div");zc.className="pond-zoom";
      zc.innerHTML=`<button class="zb" id="zin" aria-label="Zoom in">+</button><button class="zb" id="zout" aria-label="Zoom out">−</button>`;
      pond.appendChild(zc);
      setupPondZoom(pond,stage);
    } else { pondZoom=1; pondPanX=pondPanY=0; stage.style.transform=""; }
  }
  // Drag a critter to a new spot (helps when they overlap — drag to untangle,
  // then tap the one you want). A real drag suppresses the tap-to-inspect; a
  // plain tap still inspects. Position is saved per-device (critterPos).
  function makeCritterDraggable(w,c,pond){
    w.onpointerdown=(e)=>{
      if(combineMode){ e.stopPropagation(); return; }   // in fuse mode, tap = select (no drag)
      e.stopPropagation();                 // don't let the pond start a pan
      const sx=e.clientX, sy=e.clientY, pr=pond.getBoundingClientRect();
      const startL=parseFloat(w.style.left)||0, startT=parseFloat(w.style.top)||0;
      let moved=false; w._dragged=false;
      try{ w.setPointerCapture(e.pointerId); }catch(_){}
      const move=(ev)=>{
        const dx=ev.clientX-sx, dy=ev.clientY-sy;
        if(!moved && Math.abs(dx)+Math.abs(dy)>5){ moved=true; w.classList.add("dragging"); }
        if(!moved) return;
        let nx=startL+(dx/pondZoom)/pr.width*100, ny=startT+(dy/pondZoom)/pr.height*100;
        nx=Math.max(2,Math.min(90,nx)); ny=Math.max(6,Math.min(86,ny));
        w.style.left=nx+"%"; w.style.top=ny+"%";
      };
      const up=()=>{
        window.removeEventListener("pointermove",move);
        window.removeEventListener("pointerup",up);
        window.removeEventListener("pointercancel",up);
        w.classList.remove("dragging");
        if(moved){ w._dragged=true; critterPos[c.id]={x:parseFloat(w.style.left),y:parseFloat(w.style.top)}; saveCritterPos(); }
      };
      window.addEventListener("pointermove",move);
      window.addEventListener("pointerup",up);
      window.addEventListener("pointercancel",up);
    };
    w.onclick=()=>{
      if(combineMode){ toggleCombineSel(c.id,w); return; }
      if(w._dragged){ w._dragged=false; return; } if(pond._ppDragged) return; inspectCritter(c);
    };
  }
  function toggleCombineSel(id,el){
    const i=combineSel.indexOf(id);
    if(i>=0){ combineSel.splice(i,1); el&&el.classList.remove("csel"); }
    else if(combineSel.length<3){ combineSel.push(id); el&&el.classList.add("csel"); }
    else { toast("Up to 3 — tap one to deselect"); return; }
    updateCombineBar();
  }
  function updateCombineBar(){
    const msg=document.getElementById("combinemsg"), go=document.getElementById("combineGo");
    const n=combineSel.length;
    if(msg) msg.textContent = n===0?"Tap 2–3 critters to fuse ✨" : n===1?"Pick at least 1 more…" : n+" selected — ready to fuse!";
    if(go){ go.disabled=n<2; go.textContent = n>=2?("Fuse "+n+" →"):"Fuse"; }
  }
  // Pinch / wheel / button zoom + drag-to-pan. Zoom state lives in module vars so
  // it survives the re-render paintPond does on every state change.
  function setupPondZoom(pond,stage){
    const MINZ=1, MAXZ=3.2;
    const dist=t=>Math.hypot(t[0].clientX-t[1].clientX, t[0].clientY-t[1].clientY);
    const clampPan=()=>{
      const r=pond.getBoundingClientRect();
      const mx=Math.max(0,(pondZoom-1)*r.width/2), my=Math.max(0,(pondZoom-1)*r.height/2);
      pondPanX=Math.max(-mx,Math.min(mx,pondPanX)); pondPanY=Math.max(-my,Math.min(my,pondPanY));
    };
    const apply=(animate)=>{
      stage.style.transition=animate?"transform .15s ease-out":"none";
      stage.style.transform=`translate(${pondPanX.toFixed(1)}px,${pondPanY.toFixed(1)}px) scale(${pondZoom.toFixed(3)})`;
      pond.classList.toggle("zoomed",pondZoom>1.001);
      const zo=pond.querySelector("#zout"),zi=pond.querySelector("#zin");
      if(zo)zo.disabled=pondZoom<=MINZ+0.001; if(zi)zi.disabled=pondZoom>=MAXZ-0.001;
    };
    const setZoom=(z,animate)=>{ pondZoom=Math.max(MINZ,Math.min(MAXZ,z)); if(pondZoom<=MINZ){pondPanX=pondPanY=0;} clampPan(); apply(animate); };
    const zi=pond.querySelector("#zin"),zo=pond.querySelector("#zout");
    if(zi)zi.onclick=e=>{e.stopPropagation();setZoom(pondZoom+0.6,true);};
    if(zo)zo.onclick=e=>{e.stopPropagation();setZoom(pondZoom-0.6,true);};
    pond.onwheel=e=>{ e.preventDefault(); setZoom(pondZoom+(e.deltaY<0?0.3:-0.3),false); };
    // drag-to-pan (only when zoomed in); guards a critter tap from firing after a drag
    let drag=false,pinching=false,sx=0,sy=0,ox=0,oy=0;
    pond.onpointerdown=e=>{ if(pinching||pondZoom<=MINZ||(e.target.closest&&e.target.closest(".zb")))return;
      drag=true;sx=e.clientX;sy=e.clientY;ox=pondPanX;oy=pondPanY;pond._ppDragged=false;
      try{pond.setPointerCapture(e.pointerId);}catch(_){}};
    pond.onpointermove=e=>{ if(!drag||pinching)return; const dx=e.clientX-sx,dy=e.clientY-sy;
      if(Math.abs(dx)+Math.abs(dy)>6)pond._ppDragged=true; pondPanX=ox+dx;pondPanY=oy+dy; clampPan(); apply(false); };
    const end=()=>{ if(!drag)return; drag=false; if(pond._ppDragged)setTimeout(()=>{pond._ppDragged=false;},60); };
    pond.onpointerup=end; pond.onpointercancel=end;
    // pinch-to-zoom (touch). Native pinch is disabled (user-scalable=no), so this owns it.
    let pd=0,pz=1;
    pond.ontouchstart=e=>{ if(e.touches.length===2){pinching=true;drag=false;pd=dist(e.touches);pz=pondZoom;} };
    pond.ontouchmove=e=>{ if(e.touches.length===2&&pd){ e.preventDefault(); setZoom(pz*(dist(e.touches)/pd),false); } };
    pond.ontouchend=e=>{ if(e.touches.length<2){pinching=false;pd=0;} };
    apply(false);
  }
  function inspectCritter(c){
    const reason=c.reason?esc(c.reason):null;
    openSheet(`<h3 style="text-align:center">${CritterEngine.name(c.archetype)}</h3>
      <div style="width:160px;height:160px;margin:0 auto">${renderCritter(c.seed,c.archetype,c.rarity)}</div>
      <p style="text-align:center;font-weight:800;color:var(--soft);margin:6px 0 8px">${CritterEngine.rarityName(c.rarity)}${c.special?(c.tag==="combo"?" · 🧬 Fusion":CATMAP[c.tag]?" · "+CATMAP[c.tag].emoji+" "+esc(CATMAP[c.tag].name):" · ✨ Bonus"):""}</p>
      <div class="critreason">${reason?`<span class="rlbl">Earned for</span>${reason}`:`An early critter 🐣`}</div>
      <div class="sa"><button class="cancel">Close</button></div>`,s=>{s.querySelector(".cancel").onclick=closeSheet;});
  }
  // Kid taps their Pom count → a plain-language history of what each Pom was for.
  function palmHistory(kid){
    const mine=fam.log.filter(e=>e.ownerId===kid.id);
    let rows="", lastDay=null;
    if(mine.length) mine.forEach(e=>{   // log is newest-first → group consecutive same-day entries under a date header
      const dk=dayKey(e.at);
      if(dk!==lastDay){ lastDay=dk; rows+=`<div class="dayhdr">${esc(dayLabel(e.at))}</div>`; }
      const cat=CATMAP[e.type];
      const ic=e.type==="redeem"?"🎉":e.type==="combine"?"🧬":cat?cat.emoji:"✅";
      const txt=e.type==="redeem"?("Spent on "+esc(e.note||"a reward"))
        :e.type==="combine"?(e.note?esc(e.note):"Fused critters")
        :(e.note?esc(e.note):(cat?cat.name:"Did a chore"));
      const tag=e.type==="redeem"?'<span class="pminus">spent</span>':e.type==="combine"?'<span class="pminus">fused</span>':`<span class="pplus">+1 ${pomIcon(12)}</span>`;
      rows+=`<div class="actrow"><span>${ic}</span><span class="grow">${txt}</span>${tag}<span class="ago">${esc(clockTime(e.at))}</span></div>`;
    });
    else rows=`<p style="font-weight:700;color:var(--soft);text-align:center;padding:20px 0">No ${esc(cnames())} yet —<br>do a chore to earn your first one! 🐣</p>`;
    openSheet(`<h3>My ${esc(cnames())} ${pomIcon(18)}</h3>
      <p style="font-weight:700;color:var(--soft);font-size:13px;margin-top:-6px">${kid.palms||0} earned in total${kid.streak?` · 🔥 ${kid.streak}-day streak`:""}</p>
      <div class="actlog" style="max-height:48vh;overflow:auto;margin-bottom:14px">${rows}</div>
      <div class="sa"><button class="cancel">Close</button></div>`,s=>{s.querySelector(".cancel").onclick=closeSheet;});
  }
  function galleryModal(){
    let salt=Math.random();
    const draw=()=>CritterEngine.list.map(k=>`<div style="text-align:center"><div style="width:62px;height:62px;margin:0 auto">${renderCritter(k+":"+salt,k,1)}</div><div style="font-size:11px;font-weight:800;color:var(--soft)">${CritterEngine.name(k)}</div></div>`).join("");
    openSheet(`<h3>Critter Gallery <span style="font-size:13px;color:var(--soft);font-family:var(--body)">· ${CritterEngine.list.length} species</span></h3>
      <p style="font-weight:700;color:var(--soft);margin-top:-8px;font-size:13px">Every drop also varies color, pattern, eyes &amp; accessories — reroll to see.</p>
      <div id="gg" style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px">${draw()}</div>
      <div class="sa"><button class="cancel">Close</button><button class="save" id="rr">🎲 Reroll</button></div>`,s=>{
      s.querySelector(".cancel").onclick=closeSheet;
      s.querySelector("#rr").onclick=()=>{salt=Math.random();s.querySelector("#gg").innerHTML=draw();};
    });
  }
  function dexModal(kid){
    const mine=crittersOf(kid.id);
    const found=CritterEngine.list.filter(k=>mine.some(c=>c.archetype===k)).length;
    const cells=CritterEngine.list.map(k=>{
      const owned=mine.filter(c=>c.archetype===k);
      if(!owned.length)return `<div style="text-align:center;opacity:.45"><div style="width:62px;height:62px;margin:0 auto;filter:grayscale(1) contrast(.4) brightness(1.1)">${renderCritter("mystery:"+k,k,0)}</div><div style="font-size:11px;font-weight:800;color:var(--soft)">???</div></div>`;
      const best=owned.reduce((a,b)=>b.rarity>a.rarity?b:a);
      return `<div style="text-align:center"><div style="width:62px;height:62px;margin:0 auto">${renderCritter(best.seed,best.archetype,best.rarity)}</div><div style="font-size:11px;font-weight:800;color:var(--ink)">${CritterEngine.name(k)} ×${owned.length}</div></div>`;
    }).join("");
    openSheet(`<h3>${esc(kid.name)}'s Collection <span style="font-size:13px;color:var(--soft);font-family:var(--body)">· ${found}/${CritterEngine.list.length} species</span></h3>
      <div class="pbar" style="margin:-4px 0 14px"><i style="width:${Math.round(found/CritterEngine.list.length*100)}%"></i></div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px">${cells}</div>
      <div class="sa"><button class="cancel">Close</button></div>`,s=>{s.querySelector(".cancel").onclick=closeSheet;});
  }
  function choiceModal(kid){
    openSheet(`<div class="choice"><h3>Pond full! 💧 Your choice…</h3>
      <button class="opt" data-c="save"><b>Save toward the BIG reward 🏆</b><span>Pour it up. Skip a medium win now for the big prize later.</span></button>
      <button class="opt" data-c="keep"><b>Keep my medium win ✅</b><span>Enjoy it now. The big pond waits.</span></button></div>`,sheet=>{
      sheet.querySelectorAll(".opt").forEach(o=>o.onclick=()=>{closeSheet();resolveChoice(kid,o.dataset.c==="save");});
    });
  }
  function redeemFlow(kid,item){
    const list=rewardsTier(item.tier);
    const opts=list.length?list.map(r=>`<button class="opt" data-r="${r.id}"><b>${r.emoji} ${esc(r.name)}</b><span>${item.tier} reward</span></button>`).join(""):
      `<p style="font-weight:700;color:var(--soft)">No ${item.tier} rewards set yet — ask a parent to add some.</p>`;
    openSheet(`<div class="choice"><h3>Spend your ${item.tier} reward</h3>${opts}<div class="sa"><button class="cancel">Later</button></div></div>`,sheet=>{
      sheet.querySelector(".cancel").onclick=closeSheet;
      sheet.querySelectorAll(".opt").forEach(o=>o.onclick=()=>{
        if(cloudActive()){ Backend.cloud.redeem(item.id,o.dataset.r).catch(()=>toast("Couldn't reach server")); closeSheet(); confetti(); return; }
        item.status="redeemed";item.rewardId=o.dataset.r;const rw=fam.rewards.find(r=>r.id===o.dataset.r);Economy.logEvent(fam,kid,"redeem",rw?rw.name:"");save();closeSheet();confetti();render();});
    });
  }

  /* ============================================================
     TIMER OVERLAY
     ============================================================ */
  const overlay=document.getElementById("overlay"), timerCard=document.getElementById("timerCard");
  const RING=2*Math.PI*92;
  function openTimer(kid,chore){
    stopT();   // clear any stale interval from a previous timer before opening a new one
    timer.kidId=kid.id;timer.choreId=chore.id;timer.total=timer.remaining=chore.secs;timer.running=false;
    timerCard.innerHTML=`
      <h3>${chore.emoji} ${esc(chore.name)}</h3>
      <div class="ring-wrap"><svg class="ring" width="200" height="200" viewBox="0 0 200 200">
        <circle class="ring-bg" cx="100" cy="100" r="92"></circle>
        <circle class="ring-fg" id="rf" cx="100" cy="100" r="92" stroke-dasharray="${RING}"></circle></svg>
        <div class="clock"><div class="time" id="tt">${fmt(timer.remaining)}</div><div class="face" id="ff">⏰</div></div></div>
      <div class="adjust"><button data-a="-60">−1m</button><button data-a="-10">−10s</button><button data-a="10">+10s</button><button data-a="60">+1m</button></div>
      <div class="timer-actions"><button class="ta-x" id="tx">Close</button><button class="ta-go" id="tg">Start</button><button class="ta-done" id="td">Done! ${pomIcon(17)}</button></div>`;
    overlay.classList.add("show"); paintTimer();
    timerCard.querySelector("#tx").onclick=()=>{stopT();overlay.classList.remove("show");};
    timerCard.querySelector("#tg").onclick=()=>{timer.running?stopT():startT();paintTimer();};
    timerCard.querySelector("#td").onclick=()=>{stopT();overlay.classList.remove("show");completeChore(kid,chore);};
    timerCard.querySelectorAll(".adjust button").forEach(b=>b.onclick=()=>{
      timer.remaining=Math.max(0,timer.remaining+parseInt(b.dataset.a,10));
      if(timer.remaining>timer.total)timer.total=timer.remaining;paintTimer();});
  }
  function paintTimer(){
    const tt=timerCard.querySelector("#tt"),rf=timerCard.querySelector("#rf"),ff=timerCard.querySelector("#ff"),tg=timerCard.querySelector("#tg");
    if(!tt)return;
    tt.textContent=fmt(timer.remaining);
    rf.style.strokeDashoffset=RING*(1-(timer.total?timer.remaining/timer.total:0));
    ff.textContent=timer.running?"🏃":(timer.remaining===0?"🎉":"⏰");
    tg.textContent=timer.running?"Pause":(timer.remaining<timer.total&&timer.remaining>0?"Resume":"Start");
    tg.classList.toggle("run",timer.running);
  }
  function startT(){if(timer.int)clearInterval(timer.int);if(timer.remaining<=0){timer.remaining=timer.total;}timer.running=true;timer.int=setInterval(()=>{
    timer.remaining--;if(timer.remaining<=0){timer.remaining=0;stopT();beep();navigator.vibrate&&navigator.vibrate([180,90,180]);}paintTimer();},1000);}
  function stopT(){timer.running=false;clearInterval(timer.int);timer.int=null;}

  /* ============================================================
     PARENT VIEW
     ============================================================ */
  function renderParent(){
    document.body.classList.remove("editing");
    const deliver=fam.inventory.filter(i=>i.status==="redeemed");
    app.innerHTML=`
      <div class="topbar"><div class="brand">🐸 <h1>Parent</h1></div>
        <span><button class="iconbtn" id="settings">⚙︎</button> <button class="iconbtn" id="leave">⤺</button></span></div>
      ${fam.pending.length?`<div class="label"><span>Approve ✅</span><span class="ln"></span></div><div class="rows" id="pend"></div>`:""}
      ${deliver.length?`<div class="label"><span>Rewards to deliver 🎁</span><span class="ln"></span></div><div class="rows" id="deliver"></div>`:""}
      <div class="label"><span>Kids</span><span class="ln"></span><button class="iconbtn go" id="addKid" style="height:32px;padding:0 12px;font-size:13px">+ Kid</button></div>
      <div class="rows" id="kidRows"></div>
      <div class="label"><span>Grown-ups</span><span class="ln"></span><button class="iconbtn go" id="addGrown" style="height:32px;padding:0 12px;font-size:13px">+ Grown-up</button></div>
      <div class="rows" id="grownRows"></div>
      <div class="label"><span>Chores</span><span class="ln"></span><button class="iconbtn go" id="addChore" style="height:32px;padding:0 12px;font-size:13px">+ Chore</button></div>
      <div class="rows" id="choreRows"></div>
      <div class="label"><span>Rewards by tier</span><span class="ln"></span><button class="iconbtn go" id="addReward" style="height:32px;padding:0 12px;font-size:13px">+ Reward</button></div>
      <div class="rows" id="rewardRows"></div>
      ${fam.log.length?`<div class="label"><span>Recent activity</span><span class="ln"></span></div><div class="actlog" id="actlog"></div>`:""}
      <div class="hint">Award ${esc(cnames())} for kindness, approve chores, and set the rewards kids unlock.</div>`;
    app.querySelector("#leave").onclick=()=>{meId=null;view="lobby";render();};
    app.querySelector("#settings").onclick=settingsSheet;
    app.querySelector("#addKid").onclick=()=>kidSheet(null);
    app.querySelector("#addGrown").onclick=()=>grownupSheet(null);
    app.querySelector("#addChore").onclick=()=>choreSheet(null);
    app.querySelector("#addReward").onclick=()=>rewardSheet(null);

    if(deliver.length){const de=app.querySelector("#deliver");
      deliver.forEach(i=>{const kid=member(i.ownerId),rw=fam.rewards.find(r=>r.id===i.rewardId);
        const row=document.createElement("div");row.className="row";
        row.innerHTML=`<span class="emo">${rw?rw.emoji:"🎁"}</span><div class="grow"><div class="rn">${rw?esc(rw.name):"Reward"}</div><div class="rs">${kid?esc(kid.name):""} · <span class="tier-tag t-${i.tier}">${i.tier}</span></div></div>
          <button class="mini">Mark given</button>`;
        row.querySelector(".mini").onclick=()=>{ if(cloudActive()){ Backend.cloud.markGiven(i.id).catch(()=>toast("Couldn't reach server")); return; } i.status="given";save();render(); };
        de.appendChild(row);});}

    if(fam.pending.length){const pe=app.querySelector("#pend");
      fam.pending.forEach(p=>{const kid=member(p.ownerId),ch=fam.chores.find(c=>c.id===p.choreId);
        const row=document.createElement("div");row.className="row";
        row.innerHTML=`<span class="emo">${ch?ch.emoji:"❓"}</span><div class="grow"><div class="rn">${ch?esc(ch.name):"Chore"}</div><div class="rs">${kid?esc(kid.name):""}</div></div>
          <button class="mini ghost">Deny</button><button class="mini">Approve</button>`;
        row.querySelector(".mini:not(.ghost)").onclick=()=>approve(p);
        row.querySelector(".ghost").onclick=()=>{ if(cloudActive()){ Backend.cloud.deny(p.id).catch(()=>toast("Couldn't reach server")); return; } fam.pending=fam.pending.filter(x=>x.id!==p.id);save();render(); };
        pe.appendChild(row);});}

    const kr=app.querySelector("#kidRows");
    kids().forEach(k=>{const row=document.createElement("div");row.className="row";row.style.setProperty("--kc",k.color);
      row.innerHTML=`<span class="emo">${k.emoji}</span><div class="grow" style="cursor:pointer"><div class="rn">${esc(k.name)}</div><div class="rs">${pomIcon(13)} ${k.palms||0} · ${crittersOf(k.id).length} critters</div></div>
        <button class="mini">+ ${esc(cname())}</button><button class="mini ghost">Edit</button>`;
      row.querySelector(".grow").onclick=()=>kidSheet(k);
      row.querySelector(".mini:not(.ghost)").onclick=()=>kindnessSheet(k);
      row.querySelector(".ghost").onclick=()=>kidSheet(k);
      kr.appendChild(row);});

    const grr=app.querySelector("#grownRows");
    members().filter(m=>m.role==="parent").forEach(p=>{const row=document.createElement("div");row.className="row";row.style.setProperty("--kc",p.color);
      row.innerHTML=`<span class="emo">${p.emoji}</span><div class="grow" style="cursor:pointer"><div class="rn">${esc(p.name)}</div><div class="rs">Grown-up${p.parentAuthId?" · has own login":""}</div></div>
        <button class="mini ghost">Edit</button>`;
      row.querySelector(".grow").onclick=()=>grownupSheet(p);
      row.querySelector(".ghost").onclick=()=>grownupSheet(p);
      grr.appendChild(row);});

    const cr=app.querySelector("#choreRows");
    fam.chores.forEach(c=>{const row=document.createElement("div");row.className="row";
      const who=c.assignedTo?member(c.assignedTo):null;
      const adult=!!(who&&who.role==="parent");
      const meta = adult
        ? `👤 ${esc(who.name)} · grown-up${(c.doneCount||0)?` · done ${c.doneCount}×`:""}`
        : `⏱ ${fmt(c.secs)} · ${pomIcon(13)} ${c.palm} ${who?"· "+esc(who.name):"· anyone"}`;
      const doneBtn = adult
        ? `<button class="mini donebtn" style="${choreDoneToday(c)?"background:#5BB98C":"background:#fff;color:var(--soft);box-shadow:inset 0 0 0 2px var(--line)"}">${choreDoneToday(c)?"✓ Done":"Mark done"}</button>`
        : "";
      row.innerHTML=`<span class="emo">${c.emoji}</span><div class="grow" style="cursor:pointer"><div class="rn">${esc(c.name)}</div><div class="rs">${meta}</div></div>
        ${doneBtn}<button class="mini ghost">Edit</button><button class="mini del" style="background:#E5524B">✕</button>`;
      row.querySelector(".grow").onclick=()=>choreSheet(c);
      row.querySelector(".ghost").onclick=()=>choreSheet(c);
      row.querySelector(".del").onclick=()=>{fam.chores=fam.chores.filter(x=>x.id!==c.id);save();render();};
      const db=row.querySelector(".donebtn"); if(db) db.onclick=()=>toggleAdultChore(c);
      cr.appendChild(row);});

    const rr=app.querySelector("#rewardRows");
    fam.rewards.forEach(r=>{const row=document.createElement("div");row.className="row";
      row.innerHTML=`<span class="emo">${r.emoji}</span><div class="grow" style="cursor:pointer"><div class="rn">${esc(r.name)}</div><div class="rs"><span class="tier-tag t-${r.tier}">${r.tier}</span></div></div>
        <button class="mini ghost">Edit</button><button class="mini" style="background:#E5524B">✕</button>`;
      row.querySelector(".grow").onclick=()=>rewardSheet(r);
      row.querySelector(".ghost").onclick=()=>rewardSheet(r);
      row.querySelector(".mini:not(.ghost)").onclick=()=>{fam.rewards=fam.rewards.filter(x=>x.id!==r.id);save();render();};
      rr.appendChild(row);});

    if(fam.log.length){const al=app.querySelector("#actlog"); let lastDay=null;
      fam.log.slice(0,14).forEach(e=>{const kid=member(e.ownerId);
        const dk=dayKey(e.at);
        if(dk!==lastDay){ lastDay=dk; const h=document.createElement("div");h.className="dayhdr";h.textContent=dayLabel(e.at);al.appendChild(h); }
        const cat=CATMAP[e.type];
        const ic=e.type==="redeem"?"🎉":e.type==="combine"?"🧬":cat?cat.emoji:pomIcon(15);
        const txt=e.type==="redeem"?("Redeemed "+esc(e.note||"a reward")):e.type==="combine"?("Fused critters"+(e.note?" — "+esc(e.note):"")):(e.note?esc(e.note):(cat?cat.name:"Did a chore"));
        const li=document.createElement("div");li.className="actrow";
        li.innerHTML=`<span>${ic}</span><span class="grow"><b>${kid?esc(kid.name):"?"}</b> · ${txt}</span><span class="ago">${esc(clockTime(e.at))}</span>`;
        al.appendChild(li);});}
  }
  function ago(ts){const s=Math.floor((Date.now()-ts)/1000);if(s<60)return"now";if(s<3600)return Math.floor(s/60)+"m";if(s<86400)return Math.floor(s/3600)+"h";return Math.floor(s/86400)+"d";}
  // History is grouped by day with a date header; each row shows the clock time.
  function dayKey(ts){const d=new Date(ts);return d.getFullYear()+"-"+d.getMonth()+"-"+d.getDate();}
  function ord(n){const v=n%100,s=["th","st","nd","rd"];return n+(s[(v-20)%10]||s[v]||s[0]);}
  function dayLabel(ts){const d=new Date(ts),now=new Date();
    if(dayKey(ts)===dayKey(now.getTime()))return"Today";
    if(dayKey(ts)===dayKey(now.getTime()-864e5))return"Yesterday";
    const base=d.toLocaleDateString(undefined,{month:"long"})+" "+ord(d.getDate());
    return d.getFullYear()!==now.getFullYear()?base+", "+d.getFullYear():base;}
  function clockTime(ts){return new Date(ts).toLocaleTimeString(undefined,{hour:"numeric",minute:"2-digit"});}

  function kindnessSheet(kid){
    const allKids=kids();
    let toAll=false;   // #3: award to one kid or the whole family
    // Award a bonus Pom for a positive behaviour — tap a reason to give instantly.
    const award=(cat,label,emoji,n)=>{
      n=Math.max(1,Math.min(3,n||1));
      const targets=toAll?allKids:[kid];
      targets.forEach(k=>givePom(k,cat,label,n));
      closeSheet(); confetti(); beep(true); render();
      toast((emoji||"🌟")+" "+(n>1?n+" "+esc(cnames()):esc(cname()))+" given to "+(toAll?"everyone":esc(kid.name)));
    };
    const sections=GIVE_CATS.map(c=>`<div class="givecat">${c.emoji} ${esc(c.name)}</div><div class="giverow">`+
      c.reasons.map(r=>`<button class="givechip" data-cat="${c.key}" data-emoji="${r[0]}" data-label="${esc(r[1])}" data-n="1">${r[0]} ${esc(r[1])}</button>`).join("")+`</div>`).join("");
    const custom=(fam.settings.customReasons||[]);
    const customSection=custom.length?`<div class="givecat">⭐ Your reasons</div><div class="giverow">`+
      custom.map(r=>`<button class="givechip" data-cat="custom" data-emoji="${r.e}" data-label="${esc(r.l)}" data-n="${r.n||1}">${r.e} ${esc(r.l)}${(r.n||1)>1?` <span class="chipx">×${r.n}</span>`:""}</button>`).join("")+`</div>`:"";
    const targetToggle=allKids.length>1?`<div class="gtoggle"><button class="on" data-t="one">👤 ${esc(kid.name)}</button><button data-t="all">👨‍👩‍👧‍👦 Everyone</button></div>`:"";
    openSheet(`<h3>Give a ${esc(cname())} ${pomIcon(17)}</h3>
      <p style="font-weight:700;color:var(--soft);font-size:13px;margin:-8px 0 8px">Tap what they did — they'll earn a ${esc(cname())} + a critter 🐣 · <a id="editreasons" style="color:var(--accent);font-weight:800;cursor:pointer">✏️ edit reasons</a></p>
      ${targetToggle}
      <div class="givewrap">${sections}${customSection}
        <div class="givecat">✍️ Something else</div>
        <div class="minrow"><input id="gnote" placeholder="Type what they did…" style="flex:1" maxlength="60"><button class="save" id="gcustom">Give</button></div>
      </div>
      <div class="sa"><button class="cancel">Close</button></div>`,sheet=>{
      const tg=sheet.querySelector(".gtoggle");
      if(tg)tg.querySelectorAll("button").forEach(b=>b.onclick=()=>{ toAll=b.dataset.t==="all"; tg.querySelectorAll("button").forEach(x=>x.classList.toggle("on",x===b)); });
      sheet.querySelectorAll(".givechip").forEach(b=>b.onclick=()=>award(b.dataset.cat,b.dataset.label,b.dataset.emoji,+b.dataset.n||1));
      const note=sheet.querySelector("#gnote");
      sheet.querySelector("#gcustom").onclick=()=>{ const v=(note.value||"").trim(); if(!v){ note.focus(); return; } award("custom",v,"⭐",1); };
      note.onkeydown=(e)=>{ if(e.key==="Enter"){ e.preventDefault(); sheet.querySelector("#gcustom").click(); } };
      sheet.querySelector("#editreasons").onclick=()=>customReasonsSheet(kid);
      sheet.querySelector(".cancel").onclick=closeSheet;
    });
  }
  // #1: parents add/remove their own reasons — saved in family settings, shown in the give list.
  function customReasonsSheet(kid){
    let pickEmoji="⭐";
    const list=(fam.settings.customReasons||[]);
    openSheet(`<h3>Your own ${esc(cnames())} reasons ⭐</h3>
      <p style="font-weight:700;color:var(--soft);font-size:13px;margin:-8px 0 10px">Add reasons that fit your family — they appear in the give list for every kid.</p>
      <div id="crlist">${list.length?list.map((r,i)=>`<div class="minrow" style="margin-bottom:7px"><span style="flex:1;font-weight:800">${r.e} ${esc(r.l)}${(r.n||1)>1?` · ×${r.n}`:""}</span><button class="iconbtn" data-rm="${i}">🗑️</button></div>`).join(""):'<div class="hint" style="margin:4px 0">No custom reasons yet — add one below.</div>'}</div>
      <div class="field" style="margin-top:12px"><label>Add a reason</label>
        <div class="minrow"><button class="iconbtn" id="cremoji" style="font-size:20px;width:46px">⭐</button><input id="crlabel" placeholder="e.g. Practiced piano" maxlength="40" style="flex:1">
          <select id="crval" style="width:78px">${[1,2,3].map(v=>`<option value="${v}">${v} ${esc(v===1?cname():cnames())}</option>`).join("")}</select>
          <button class="save" id="cradd">Add</button></div></div>
      <div class="sa"><button class="cancel">Done</button></div>`,s=>{
      s.querySelector("#cremoji").onclick=()=>openEmojiPicker([pickEmoji],1,arr=>{ pickEmoji=arr[0]||"⭐"; s.querySelector("#cremoji").textContent=pickEmoji; },"Pick an icon");
      s.querySelector("#cradd").onclick=()=>{ const l=(s.querySelector("#crlabel").value||"").trim(); if(!l){ s.querySelector("#crlabel").focus(); return; }
        const n=Math.max(1,Math.min(3,+s.querySelector("#crval").value||1));
        (fam.settings.customReasons=fam.settings.customReasons||[]).push({e:pickEmoji,l,n}); save(); customReasonsSheet(kid); };
      s.querySelectorAll("[data-rm]").forEach(b=>b.onclick=()=>{ fam.settings.customReasons.splice(+b.dataset.rm,1); save(); customReasonsSheet(kid); });
      s.querySelector(".cancel").onclick=()=>kindnessSheet(kid);
    });
  }

  /* ============================================================
     SHEETS (editors)
     ============================================================ */
  const scrim=document.getElementById("scrim"), sheet=document.getElementById("sheet");
  function openSheet(html,wire){sheet.innerHTML=html;scrim.classList.add("show");wire&&wire(sheet);}
  function closeSheet(){scrim.classList.remove("show");}
  scrim.onclick=e=>{if(e.target===scrim)closeSheet();};

  /* ============================================================
     EMOJI PICKER — full library, standard category tabs + search,
     multi-select (up to `max`). Layers ABOVE the open sheet so the
     form underneath keeps its state; calls onDone(arrayOfEmoji).
     ============================================================ */
  function openEmojiPicker(initial,max,onDone,title){
    max=max||3;
    const DATA=(typeof EMOJI_DATA!=="undefined"&&EMOJI_DATA)||{order:[],groups:{}};
    let selected=(initial||[]).filter(Boolean).slice(0,max);
    const groupOf=(em)=>DATA.order.find(g=>DATA.groups[g].items.some(it=>it[0]===em));
    let active=(selected[0]&&groupOf(selected[0]))||(DATA.groups.objects?"objects":DATA.order[0])||"";
    let query="";

    const wrap=document.createElement("div"); wrap.className="epscrim";
    wrap.innerHTML=`<div class="epcard">
      <div class="ephead"><b>${esc(title||"Chore icons")}</b><span class="ephint" id="ephint"></span></div>
      <div class="epchips" id="epchips"></div>
      <input class="epsearch" id="epsearch" placeholder="Search emojis…  (broom, dog, plant…)" autocomplete="off">
      <div class="eptabs" id="eptabs"></div>
      <div class="epgrid" id="epgrid"></div>
      <div class="sa"><button class="cancel" id="epcancel">Cancel</button><button class="save" id="epdone">Done</button></div>
    </div>`;
    document.body.appendChild(wrap);
    const $=(s)=>wrap.querySelector(s);
    const tabs=$("#eptabs"),grid=$("#epgrid"),chips=$("#epchips"),hint=$("#ephint"),done=$("#epdone"),search=$("#epsearch");

    tabs.innerHTML=DATA.order.map(g=>`<button class="eptab" data-g="${g}" title="${esc(DATA.groups[g].label)}">${DATA.groups[g].icon}</button>`).join("");

    const renderChips=()=>{
      chips.innerHTML=selected.length
        ? selected.map(e=>`<button class="epchip" data-rm="${e}">${e}<span>×</span></button>`).join("")
        : `<span class="epempty">No icons yet — tap some below</span>`;
      hint.textContent=`${selected.length}/${max} chosen`;
      done.disabled=selected.length===0;
    };
    const matches=()=>{
      if(query){ const out=[]; for(const g of DATA.order){ for(const it of DATA.groups[g].items){
        if(it[1].indexOf(query)>=0){ out.push(it); if(out.length>=250) return out; } } } return out; }
      return (DATA.groups[active]||{items:[]}).items;
    };
    const renderGrid=()=>{
      tabs.querySelectorAll(".eptab").forEach(t=>t.classList.toggle("on",!query&&t.dataset.g===active));
      const items=matches();
      grid.innerHTML=items.length
        ? items.map(it=>`<button class="epe${selected.includes(it[0])?" on":""}" data-e="${it[0]}" title="${esc(it[1])}">${it[0]}</button>`).join("")
        : `<div class="epnone">No emojis match “${esc(query)}”.</div>`;
    };
    const refresh=()=>{ renderChips(); renderGrid(); };
    const toggle=(em)=>{
      const i=selected.indexOf(em);
      if(i>=0) selected.splice(i,1);
      else if(selected.length<max) selected.push(em);
      else { hint.textContent=`Up to ${max} — remove one first`; hint.classList.add("warn"); setTimeout(()=>hint.classList.remove("warn"),900); return; }
      refresh();
    };
    tabs.onclick=e=>{const b=e.target.closest(".eptab"); if(!b)return; active=b.dataset.g; query=""; search.value=""; renderGrid(); grid.scrollTop=0;};
    grid.onclick=e=>{const b=e.target.closest(".epe"); if(b)toggle(b.dataset.e);};
    chips.onclick=e=>{const b=e.target.closest(".epchip"); if(b)toggle(b.dataset.rm);};
    search.oninput=()=>{ query=search.value.trim().toLowerCase(); renderGrid(); grid.scrollTop=0; };
    const close=()=>wrap.remove();
    $("#epcancel").onclick=close;
    wrap.onclick=e=>{ if(e.target===wrap) close(); };
    done.onclick=()=>{ const out=selected.slice(); close(); onDone(out); };
    refresh();
  }

  function kidSheet(kid){
    const isNew=!kid;
    const d=kid?{...kid}:{id:id(),name:"",role:"child",emoji:freeEmoji(),color:freeColor(),palms:0,buckets:{s:0,m:0,b:0},choices:0,streak:0,lastActive:null};
    openSheet(`<h3>${isNew?"Add a kid":"Edit kid"}</h3>
      <div class="field"><label>Name</label><input id="kn" maxlength="14" value="${esc(d.name)}" placeholder="Name"></div>
      <div class="field"><label>Character</label><div class="emo-grid" id="ke"></div></div>
      <div class="field"><label>Color</label><div class="swatch-row" id="kc"></div></div>
      <div class="sa">${isNew?"":'<button class="cancel" id="del" style="background:#E5524B;color:#fff">Remove</button>'}<button class="cancel">Cancel</button><button class="save">${isNew?"Add":"Save"}</button></div>`,s=>{
      const eg=s.querySelector("#ke");KID_EMOJI.forEach(em=>{const b=document.createElement("button");b.textContent=em;if(em===d.emoji)b.classList.add("pick");
        b.onclick=()=>{d.emoji=em;eg.querySelectorAll("button").forEach(x=>x.classList.remove("pick"));b.classList.add("pick");};eg.appendChild(b);});
      const cg=s.querySelector("#kc");COLORS.forEach(col=>{const sw=document.createElement("div");sw.className="swatch"+(col===d.color?" pick":"");sw.style.background=col;
        sw.onclick=()=>{d.color=col;cg.querySelectorAll(".swatch").forEach(x=>x.classList.remove("pick"));sw.classList.add("pick");};cg.appendChild(sw);});
      s.querySelectorAll(".cancel").forEach(b=>{if(b.id!=="del")b.onclick=closeSheet;});
      const del=s.querySelector("#del");if(del)del.onclick=()=>{fam.members=fam.members.filter(m=>m.id!==kid.id);save();closeSheet();render();};
      s.querySelector(".save").onclick=()=>{d.name=s.querySelector("#kn").value.trim()||"Kiddo";
        if(isNew)fam.members.push(d);else Object.assign(kid,d);save();closeSheet();render();};
      setTimeout(()=>{const el=s.querySelector("#kn");if(el)el.focus();},60);
    });
  }
  function choreSheet(ch){
    const isNew=!ch;
    const d=ch?{...ch}:{id:id(),name:"",emoji:C_EMOJI[Math.floor(Math.random()*C_EMOJI.length)],secs:300,palm:1,assignedTo:null};
    let mins=Math.floor(d.secs/60),secs=d.secs%60;
    let icons=(d.emoji||"").split(" ").filter(Boolean).slice(0,3);   // up to 3 emojis make the chore's icon
    const adults=members().filter(m=>m.role==="parent");
    const kidOpts=`<option value="">Anyone (kids)</option>`
      +`<optgroup label="Kids">`+kids().map(k=>`<option value="${k.id}" ${d.assignedTo===k.id?"selected":""}>🧒 ${esc(k.name)}</option>`).join("")+`</optgroup>`
      +(adults.length?`<optgroup label="Grown-ups (just for show — no Poms)">`+adults.map(a=>`<option value="${a.id}" ${d.assignedTo===a.id?"selected":""}>🧑 ${esc(a.name)}</option>`).join("")+`</optgroup>`:"");
    openSheet(`<h3>${isNew?"New chore":"Edit chore"}</h3>
      <div class="field"><label>Name</label><input id="cn" maxlength="20" value="${esc(d.name)}" placeholder="Chore name"></div>
      <div class="field"><label>Icons <span style="text-transform:none;font-weight:700">— pick up to 3</span></label>
        <button type="button" class="iconpick" id="cipick"><span class="ipprev" id="ciprev"></span><span class="ipgo">Tap to choose…</span></button></div>
      <div class="field"><label>Timer</label><div class="minrow">
        <button class="stepper" id="mm">−</button><input id="cmin" inputmode="numeric" value="${mins}" style="width:60px;text-align:center">
        <button class="stepper" id="mp">+</button><span style="font-weight:800;color:var(--soft)">min</span>
        <input id="csec" inputmode="numeric" value="${secs}" style="width:60px;text-align:center"><span style="font-weight:800;color:var(--soft)">sec</span></div></div>
      <div class="field"><label>Assigned to</label><select id="cas">${kidOpts}</select></div>
      <div class="field"><label>Worth <span style="text-transform:none;font-weight:700">(${esc(cnames())} per finish)</span></label>
        <select id="cpalm">${[1,2,3,4,5].map(v=>`<option value="${v}" ${(d.palm||1)===v?"selected":""}>${v} ${esc(v===1?cname():cnames())}</option>`).join("")}</select></div>
      <div class="sa"><button class="cancel">Cancel</button><button class="save">${isNew?"Add":"Save"}</button></div>`,s=>{
      const prev=s.querySelector("#ciprev");
      const drawPrev=()=>{ prev.innerHTML=icons.length?icons.map(e=>`<span>${e}</span>`).join(""):`<span class="ipph">＋</span>`; };
      drawPrev();
      s.querySelector("#cipick").onclick=()=>openEmojiPicker(icons,3,arr=>{ icons=arr; drawPrev(); });
      const min=s.querySelector("#cmin");
      s.querySelector("#mm").onclick=()=>min.value=Math.max(0,(parseInt(min.value,10)||0)-1);
      s.querySelector("#mp").onclick=()=>min.value=(parseInt(min.value,10)||0)+1;
      s.querySelector(".cancel").onclick=closeSheet;
      s.querySelector(".save").onclick=()=>{const m=parseInt(min.value,10)||0,sc=parseInt(s.querySelector("#csec").value,10)||0;
        d.secs=Math.max(5,m*60+sc);d.name=s.querySelector("#cn").value.trim()||"Chore";d.assignedTo=s.querySelector("#cas").value||null;
        d.palm=Math.max(1,Math.min(5,+s.querySelector("#cpalm").value||1));
        d.emoji=icons.join(" ")||"✅";
        if(isNew)fam.chores.push(d);else Object.assign(ch,d);save();closeSheet();render();};
      setTimeout(()=>{const el=s.querySelector("#cn");if(el)el.focus();},60);
    });
  }
  function rewardSheet(rw){
    const isNew=!rw;
    const d=rw?{...rw}:{id:id(),name:"",emoji:R_EMOJI[Math.floor(Math.random()*R_EMOJI.length)],tier:"small"};
    openSheet(`<h3>${isNew?"New reward":"Edit reward"}</h3>
      <div class="field"><label>Reward</label><input id="rn" maxlength="28" value="${esc(d.name)}" placeholder="e.g. Movie night"></div>
      <div class="field"><label>Icon</label><div class="emo-grid" id="re"></div></div>
      <div class="field"><label>Tier</label><select id="rt">
        <option value="small" ${d.tier==="small"?"selected":""}>Small — frequent, easy to earn</option>
        <option value="medium" ${d.tier==="medium"?"selected":""}>Medium — a few small fills</option>
        <option value="big" ${d.tier==="big"?"selected":""}>Big — the goal prize</option></select></div>
      <div class="sa"><button class="cancel">Cancel</button><button class="save">${isNew?"Add":"Save"}</button></div>`,s=>{
      const eg=s.querySelector("#re");R_EMOJI.forEach(em=>{const b=document.createElement("button");b.textContent=em;if(em===d.emoji)b.classList.add("pick");
        b.onclick=()=>{d.emoji=em;eg.querySelectorAll("button").forEach(x=>x.classList.remove("pick"));b.classList.add("pick");};eg.appendChild(b);});
      s.querySelector(".cancel").onclick=closeSheet;
      s.querySelector(".save").onclick=()=>{d.name=s.querySelector("#rn").value.trim()||"Reward";d.tier=s.querySelector("#rt").value;
        if(isNew)fam.rewards.push(d);else Object.assign(rw,d);save();closeSheet();render();};
      setTimeout(()=>{const el=s.querySelector("#rn");if(el)el.focus();},60);
    });
  }
  function settingsSheet(){
    const st=fam.settings;
    openSheet(`<h3>Family settings</h3>
      <div class="field"><label>Family name</label><input id="fn" value="${esc(fam.name)}"></div>
      <div class="field"><label>Pond sizes (drops to fill)</label><div class="minrow">
        <span style="font-weight:800;color:var(--soft);width:60px">Small</span><input id="cs" inputmode="numeric" value="${st.smallCap}" style="width:56px;text-align:center">
        <span style="font-weight:800;color:var(--soft);width:60px">Medium</span><input id="cm" inputmode="numeric" value="${st.medCap}" style="width:56px;text-align:center">
        <span style="font-weight:800;color:var(--soft);width:40px">Big</span><input id="cb" inputmode="numeric" value="${st.bigCap}" style="width:56px;text-align:center"></div></div>
      <div class="toggle">Require parent approval <div class="sw ${st.approval?"on":""}" id="ap"><i></i></div></div>
      <div class="field"><label>What are points called? <span style="text-transform:none;font-weight:700">(Pom, Gem, Star…)</span></label><input id="cy" maxlength="12" value="${esc(cname())}"></div>
      <div class="field"><label>Parent PIN</label><input id="pn" inputmode="numeric" maxlength="4" value="${esc(st.parentPin)}"></div>
      ${cloudActive()&&Backend.cloud.joinCodeField?Backend.cloud.joinCodeField():""}
      ${cloudActive()&&Backend.cloud.grownupCodeField?Backend.cloud.grownupCodeField():""}
      <div class="field"><label>Backup &amp; restore${cloudActive()?" <span style='text-transform:none;font-weight:700'>(your family is also synced to the cloud)</span>":""}</label>
        <div style="display:flex;gap:8px">
          <button id="bkup" class="iconbtn" style="flex:1;justify-content:center;height:42px">⬆ Copy backup</button>
          <button id="rstr" class="iconbtn" style="flex:1;justify-content:center;height:42px">⬇ Restore</button>
        </div>
        <textarea id="bktx" placeholder="Backup code appears here — or paste one to restore" style="width:100%;margin-top:8px;border:2px solid var(--line);border-radius:13px;padding:10px;font-family:var(--body);font-weight:700;font-size:12px;min-height:64px;color:var(--ink);background:#fff;outline:none"></textarea>
      </div>
      <button id="reset" style="width:100%;border:none;background:#fff;color:#E5524B;box-shadow:inset 0 0 0 2px #f3c6c3;border-radius:13px;padding:12px;font-family:var(--display);font-weight:600;font-size:15px;cursor:pointer;margin-bottom:12px">↺ Reset all progress (keep kids & chores)</button>
      <div class="sa"><button class="cancel">Cancel</button><button class="save">Save</button></div>`,s=>{
      let appr=st.approval;const sw=s.querySelector("#ap");sw.onclick=()=>{appr=!appr;sw.classList.toggle("on",appr);};
      const tx=s.querySelector("#bktx");
      if(cloudActive()&&Backend.cloud.wireJoinCode) Backend.cloud.wireJoinCode(s);
      if(cloudActive()&&Backend.cloud.wireGrownupCode) Backend.cloud.wireGrownupCode(s);
      s.querySelector("#bkup").onclick=()=>{
        try{ tx.value=btoa(unescape(encodeURIComponent(JSON.stringify(fam))));
          tx.select(); try{document.execCommand("copy");}catch(e){}
          if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(tx.value).catch(()=>{});
          toast("Backup code ready — save it somewhere safe 📋");
        }catch(e){toast("Couldn't create backup");}
      };
      s.querySelector("#rstr").onclick=()=>{
        const code=tx.value.trim(); if(!code){toast("Paste a backup code first");return;}
        try{ const data=JSON.parse(decodeURIComponent(escape(atob(code))));
          if(!data||!Array.isArray(data.members))throw 0;
          fam=normalizeFam(data); if(fam.setup===undefined)fam.setup=true;
          save();closeSheet();render();toast("Family restored ✅");
          if(cloudActive()&&Backend.cloud.onRestore)Backend.cloud.onRestore(fam);
        }catch(e){toast("That code doesn't look right");}
      };
      let armed=false; const rb=s.querySelector("#reset");
      rb.onclick=()=>{
        if(!armed){armed=true;rb.textContent="Tap again to confirm reset";rb.style.background="#E5524B";rb.style.color="#fff";setTimeout(()=>{armed=false;rb.textContent="↺ Reset all progress (keep kids & chores)";rb.style.background="#fff";rb.style.color="#E5524B";},2600);return;}
        if(cloudActive()){ Backend.cloud.resetProgress().catch(()=>toast("Couldn't reach server")); closeSheet(); return; }
        fam.critters=[];fam.inventory=[];fam.pending=[];fam.log=[];fam.done={};
        fam.members.forEach(m=>{if(m.role==="child"){m.palms=0;m.buckets={s:0,m:0,b:0};m.choices=0;m.streak=0;m.lastActive=null;}});
        save();closeSheet();render();toast("Progress reset ↺");
      };
      s.querySelector(".cancel").onclick=closeSheet;
      s.querySelector(".save").onclick=()=>{fam.name=s.querySelector("#fn").value.trim()||"Our Family";
        st.smallCap=Math.max(1,parseInt(s.querySelector("#cs").value,10)||4);
        st.medCap=Math.max(1,parseInt(s.querySelector("#cm").value,10)||3);
        st.bigCap=Math.max(1,parseInt(s.querySelector("#cb").value,10)||2);
        st.approval=appr;st.parentPin=(s.querySelector("#pn").value||"0000").slice(0,4);
        st.currencyName=(s.querySelector("#cy").value.trim()||"Pom").slice(0,12);
        save();closeSheet();render();};
    });
  }
  function freeEmoji(){const u=members().map(m=>m.emoji);return KID_EMOJI.find(e=>!u.includes(e))||KID_EMOJI[0];}
  function freeAdultEmoji(){const u=members().map(m=>m.emoji);return ADULT_EMOJI.find(e=>!u.includes(e))||ADULT_EMOJI[0];}
  function freeColor(){const u=members().map(m=>m.color);return COLORS.find(c=>!u.includes(c))||COLORS[0];}

  /* ---------- grown-ups (co-parents, grandparents) ---------- */
  function grownupSheet(g){
    const isNew=!g;
    const d=g?{...g}:{id:id(),name:"",role:"parent",emoji:freeAdultEmoji(),color:freeColor()};
    const adults=members().filter(m=>m.role==="parent");
    const canRemove=!isNew && adults.length>1;
    openSheet(`<h3>${isNew?"Add a grown-up":"Edit grown-up"}</h3>
      <div class="field"><label>Name</label><input id="gn" maxlength="14" value="${esc(d.name)}" placeholder="Mum, Dad, Grandma…"></div>
      <div class="field"><label>Character</label><div class="emo-grid" id="ge"></div></div>
      <div class="field"><label>Color</label><div class="swatch-row" id="gc"></div></div>
      ${cloudActive()?`<div class="hint" style="text-align:left;margin:2px 0 8px">Want them on their <b>own phone</b> with their own login? Share the <b>grown-up invite code</b> in ⚙︎ Settings — they sign up and join as a full co-parent. This just adds a tile that shares this device &amp; the Parent PIN.</div>`:`<div class="hint" style="text-align:left;margin:2px 0 8px">Adds a grown-up who shares this device and the Parent PIN.</div>`}
      <div class="sa">${canRemove?'<button class="cancel" id="gdel" style="background:#E5524B;color:#fff">Remove</button>':""}<button class="cancel">Cancel</button><button class="save">${isNew?"Add":"Save"}</button></div>`,s=>{
      const eg=s.querySelector("#ge");ADULT_EMOJI.forEach(em=>{const b=document.createElement("button");b.textContent=em;if(em===d.emoji)b.classList.add("pick");
        b.onclick=()=>{d.emoji=em;eg.querySelectorAll("button").forEach(x=>x.classList.remove("pick"));b.classList.add("pick");};eg.appendChild(b);});
      const cg=s.querySelector("#gc");COLORS.forEach(col=>{const sw=document.createElement("div");sw.className="swatch"+(col===d.color?" pick":"");sw.style.background=col;
        sw.onclick=()=>{d.color=col;cg.querySelectorAll(".swatch").forEach(x=>x.classList.remove("pick"));sw.classList.add("pick");};cg.appendChild(sw);});
      s.querySelectorAll(".cancel").forEach(b=>{if(b.id!=="gdel")b.onclick=closeSheet;});
      const del=s.querySelector("#gdel");if(del)del.onclick=()=>{fam.members=fam.members.filter(m=>m.id!==g.id);save();closeSheet();render();};
      s.querySelector(".save").onclick=()=>{d.name=s.querySelector("#gn").value.trim()||"Grown-up";
        if(isNew)fam.members.push(d);else Object.assign(g,d);save();closeSheet();render();};
      setTimeout(()=>{const el=s.querySelector("#gn");if(el)el.focus();},60);
    });
  }

  /* ---------- install / add to home screen ---------- */
  function isStandalone(){return (window.matchMedia&&window.matchMedia('(display-mode: standalone)').matches)||window.navigator.standalone===true;}
  function isiOS(){const ua=navigator.userAgent||"";return /iphone|ipad|ipod/i.test(ua)||(/Macintosh/i.test(ua)&&typeof document!=="undefined"&&'ontouchend' in document);}
  function isAndroid(){return /android/i.test(navigator.userAgent||"");}
  function showInstall(){return !isStandalone();}
  function doInstall(){
    const dp=window.__ppInstall;
    if(dp&&dp.prompt){ dp.prompt(); if(dp.userChoice)dp.userChoice.then(()=>{window.__ppInstall=null;render();}); return; }  // native one-tap (Android/desktop Chrome)
    installSheet();
  }
  function installSheet(){
    const ios=isiOS(), android=isAndroid();
    const steps = ios
      ? 'In <b>Safari</b>, tap the <b>Share</b> icon <span style="font-size:16px">⬆️</span> at the bottom, scroll down, and tap <b>“Add to Home Screen.”</b>'
      : android
      ? 'Tap the <b>⋮ menu</b> (top-right of Chrome) and choose <b>“Install app”</b> (or <b>“Add to Home screen”</b>).'
      : 'Click the <b>install icon</b> in the address bar, or your browser menu → <b>“Install Pom Pond.”</b>';
    openSheet(`<h3>📲 Add Pom Pond to your phone</h3>
      <p style="font-weight:700;color:var(--soft);font-size:14px;line-height:1.55;margin-top:-6px">${steps}</p>
      <p style="font-weight:700;color:var(--soft);font-size:13px">It then opens full-screen like a real app — with its own icon on your home screen.</p>
      <div class="sa"><button class="cancel">Got it 👍</button></div>`,s=>{s.querySelector(".cancel").onclick=closeSheet;});
  }

  /* ============================================================
     FX
     ============================================================ */
  function confetti(){const wrap=document.getElementById("burst");const set=["🎉","✨","🐸","🦆","💛","🪷","⭐"];
    for(let i=0;i<20;i++){const s=document.createElement("span");s.textContent=set[Math.floor(Math.random()*set.length)];
      s.style.left=Math.random()*100+"vw";s.style.fontSize=(20+Math.random()*22)+"px";s.style.animationDelay=(Math.random()*.4)+"s";
      wrap.appendChild(s);setTimeout(()=>s.remove(),1900);}}
  let actx;function beep(happy){try{actx=actx||new(window.AudioContext||window.webkitAudioContext)();
    (happy?[523,659,784,1047]:[880,660,880]).forEach((f,i)=>{const o=actx.createOscillator(),g=actx.createGain();o.type="triangle";o.frequency.value=f;
      o.connect(g);g.connect(actx.destination);const t=actx.currentTime+i*.15;g.gain.setValueAtTime(.0001,t);
      g.gain.exponentialRampToValueAtTime(.22,t+.02);g.gain.exponentialRampToValueAtTime(.0001,t+.3);o.start(t);o.stop(t+.32);});}catch(e){}}
  function toast(msg){const t=document.createElement("div");t.textContent=msg;
    t.style.cssText="position:fixed;left:50%;bottom:30px;transform:translateX(-50%);background:#23413E;color:#fff;padding:12px 18px;border-radius:14px;font-weight:800;z-index:70;box-shadow:var(--shadow)";
    document.body.appendChild(t);setTimeout(()=>t.remove(),2200);}

  /* ============================================================
     PUBLIC BRIDGE for js/cloud.js (Firebase enhancement layer)
     ============================================================ */
  PP.render=render;
  PP.toast=toast;
  PP.getState=()=>fam;
  PP.localFamily=()=>Backend.loadLocal();
  PP.normalize=normalizeFam;
  PP.setCloud=(c)=>{ Backend.cloud=c; };
  PP.goLobby=()=>{ meId=null; view="lobby"; render(); };
  PP.openSheet=openSheet; PP.closeSheet=closeSheet;
  PP.applySnapshot=(f)=>{                       // cloud pushes new family state
    fam=normalizeFam(f);
    // A cloud family that isn't set up yet must run the welcome wizard, even if
    // stale local state left us on the lobby. This is what guarantees a parent
    // always chooses their own PIN before reaching the app (kids never onboard).
    const amParent = !Backend.cloud.isParent || Backend.cloud.isParent();
    if(!fam.setup && amParent){ meId=null; view="setup"; }
    else if(view==="setup" && fam.setup) view="lobby";
    if((view==="kid"||view==="parent") && !member(meId)) { meId=null; view="lobby"; }
    render();
  };
  PP.applyReveals=(critters)=>{                 // cloud hands us critters to show on this kid's screen
    if(!critters||!critters.length) return;
    revealQ=critters.slice();
    const kid=me();
    if(kid && view==="kid"){ playReveals(kid.id,()=>{ if((kid.choices||0)>0)choiceModal(kid); }); }
    else revealQ=[];
  };
  PP.boot=render;

  if(typeof window!=="undefined"&&window.addEventListener){
    window.addEventListener('pp-installable',()=>{ if(view==="lobby"||view==="kid")render(); });
    window.addEventListener('pp-installed',()=>render());
  }

  render();
