/* ============================================================================
   Pom Pond — CLOUD LAYER (Firebase Auth + Firestore live sync + Functions).

   Progressive enhancement: the local-first core (inlined in index.html) has
   already booted in localStorage mode. If firebase-config.js still holds the
   REPLACE_ME placeholder, this module no-ops and the app stays local. Once
   configured it takes over: shows an auth gate, and after sign-in drives the
   app via PP (window.PomPond) — economy actions route to Cloud Functions and
   live family state arrives through onSnapshot. It is never loaded by the
   jsdom harness (no network), so the regression suite stays in local mode.
   ============================================================================ */
import { firebaseConfig, useEmulators } from './firebase-config.js';

const SDK = 'https://www.gstatic.com/firebasejs/10.13.0';
const PP = window.PomPond;
let cloudReady = false; // true once Firebase auth has taken control of the gate

if (!firebaseConfig || firebaseConfig.apiKey === 'REPLACE_ME' || !PP) {
  console.info('[PomPond] Cloud dormant — running local-first. Fill js/firebase-config.js to enable sync.');
} else {
  // Cover the local-first wizard IMMEDIATELY (synchronously, before the async
  // Firebase SDK loads) so the parent never sees the local wizard flash before
  // the cloud sign-in screen — they should see exactly one screen at a time.
  const _gate = document.getElementById('authgate');
  if (_gate) {
    _gate.innerHTML = '<div class="auth-card"><h2>🐸 Pom Pond</h2><p>Loading…</p></div>';
    _gate.classList.add('show');
  }
  const failGate = (msg) => {
    if (!_gate) return;
    _gate.innerHTML = '<div class="auth-card"><h2>🐸 Pom Pond</h2>'+
      '<p>'+(msg||"Couldn’t connect. Check your internet and try again.")+'</p>'+
      '<div class="sa"><button class="save" id="ppreload">Reload</button></div></div>';
    _gate.classList.add('show');
    const b = _gate.querySelector('#ppreload'); if (b) b.onclick = () => location.reload();
  };
  // Watchdog: never spin forever. If cloud hasn't taken over in 12s, offer a
  // reload. The loading gate stays up the whole time, so the local-first setup
  // wizard can never leak through before sign-in.
  setTimeout(() => { if (!cloudReady) failGate('Still connecting… check your internet, then reload.'); }, 12000);
  bootCloud().catch(err => {
    console.error('[PomPond] cloud init failed.', err);
    if (!cloudReady) failGate('Couldn’t connect to the server. Check your internet and reload.');
  });
}

async function bootCloud() {
  const [{ initializeApp }, authMod, fsMod, fnMod] = await Promise.all([
    import(`${SDK}/firebase-app.js`),
    import(`${SDK}/firebase-auth.js`),
    import(`${SDK}/firebase-firestore.js`),
    import(`${SDK}/firebase-functions.js`),
  ]);

  const app = initializeApp(firebaseConfig);

  // Offline-first WHEN POSSIBLE: a persistent local cache + multi-tab sync. If it
  // can't initialize (multiple tabs, private mode, blocked/again-opened storage),
  // fall back to the default in-memory cache so SIGN-IN ALWAYS WORKS — an
  // offline-cache hiccup must never block the whole app.
  let db;
  try {
    db = fsMod.initializeFirestore(app, {
      localCache: fsMod.persistentLocalCache({ tabManager: fsMod.persistentMultipleTabManager() })
    });
  } catch (e) {
    console.warn('[PomPond] persistent cache unavailable; using default cache.', e);
    db = fsMod.getFirestore(app);
  }
  const auth = authMod.getAuth(app);
  const functions = fnMod.getFunctions(app);

  if (useEmulators) {
    authMod.connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
    fsMod.connectFirestoreEmulator(db, 'localhost', 8080);
    fnMod.connectFunctionsEmulator(functions, 'localhost', 5001);
  }

  const call = (name) => {
    const fn = fnMod.httpsCallable(functions, name);
    return (data) => fn(data).then(r => r.data);
  };
  const fns = {};
  ['createFamily','regenJoinCode','setKidCode','bindDevice','completeChore','givePom',
   'resolveChoice','redeem','approvePending','denyPending','markGiven','resetProgress',
   'joinFamilyAsParent','regenParentCode']
    .forEach(n => fns[n] = call(n));

  const gate = document.getElementById('authgate');
  const showGate = (html, wire) => { gate.innerHTML = html; gate.classList.add('show'); wire && wire(gate); };
  const hideGate = () => gate.classList.remove('show');

  // ---- live sync: assemble subcollections into the prototype-shaped blob ----
  let unsub = [];
  function stopSync() { unsub.forEach(u => { try { u(); } catch (e) {} }); unsub = []; }
  const known = { members: new Set(), chores: new Set(), rewards: new Set() };

  function subscribe(fid, role, memberId) {
    stopSync();
    const ref = fsMod.doc(db, 'families', fid);
    const sub = (path, key) =>
      fsMod.onSnapshot(fsMod.collection(db, 'families', fid, path), s => {
        cache[key] = s.docs.map(d => Object.assign({ id: d.id }, d.data()));
        if (path === 'members') { known.members = new Set(cache.members.map(m => m.id)); }
        if (path === 'chores')  { known.chores  = new Set(cache.chores.map(c => c.id)); }
        if (path === 'rewards') { known.rewards = new Set(cache.rewards.map(r => r.id)); }
        push();
      }, err => console.warn('[PomPond] snapshot', path, err && err.code));

    const cache = { fam: null, members: [], chores: [], rewards: [], critters: [], inventory: [], ledger: [], pending: [], done: [] };
    let ready = false;
    function push() {
      if (!cache.fam) return;
      const done = {}; cache.done.forEach(d => { done[d.id] = true; });
      const fam = {
        setup: cache.fam.setup !== false,
        name: cache.fam.name, settings: cache.fam.settings || {},
        members: cache.members, chores: cache.chores, rewards: cache.rewards,
        critters: cache.critters, inventory: cache.inventory,
        log: cache.ledger.slice().sort((a,b)=> (b.at||0)-(a.at||0)).slice(0,60),
        pending: cache.pending, done
      };
      cloud.active = true; cloud.role = role; cloud.member = memberId;
      PP.applySnapshot(fam);
      if (!ready) { ready = true; hideGate(); }
    }
    unsub.push(fsMod.onSnapshot(ref, s => { cache.fam = s.exists() ? s.data() : null; push(); }));
    unsub.push(sub('members','members'));
    unsub.push(sub('chores','chores'));
    unsub.push(sub('rewards','rewards'));
    unsub.push(sub('critters','critters'));
    unsub.push(sub('inventory','inventory'));
    unsub.push(sub('ledger','ledger'));
    unsub.push(sub('pending','pending'));
    unsub.push(sub('done','done'));
  }

  // ---- Backend.cloud surface the app calls ----
  const reveal = (out) => { if (out && out.reveals) PP.applyReveals(out.reveals); return out; };
  const cloud = {
    active: false, role: null, member: null, fid: null,
    isParent: () => cloud.role === 'parent',
    boundMemberId: () => cloud.member,

    completeChore: (memberId, choreId) => fns.completeChore({ memberId, choreId }).then(reveal),
    givePom: (memberId, src, note) => fns.givePom({ memberId, src, note }),
    resolveChoice: (memberId, saveUp) => fns.resolveChoice({ saveUp }).then(reveal),
    redeem: (itemId, rewardId) => fns.redeem({ itemId, rewardId }),
    approve: (pendingId) => fns.approvePending({ pendingId }),
    deny: (pendingId) => fns.denyPending({ pendingId }),
    markGiven: (itemId) => fns.markGiven({ itemId }),
    resetProgress: () => fns.resetProgress({}),

    // Parent config edits write straight to Firestore (allowed by rules, offline-capable).
    // Economy fields are never written here — only the server writes those.
    saveCrud: async (fam) => {
      if (cloud.role !== 'parent' || !cloud.fid) return;
      const fid = cloud.fid, b = fsMod.writeBatch(db);
      b.set(fsMod.doc(db,'families',fid), { name: fam.name, settings: fam.settings, setup: fam.setup === true }, { merge: true });
      for (const m of fam.members)
        b.set(fsMod.doc(db,'families',fid,'members',m.id),
          { name:m.name, emoji:m.emoji, color:m.color, role:m.role }, { merge: true });
      for (const c of fam.chores) b.set(fsMod.doc(db,'families',fid,'chores',c.id), c);
      for (const r of fam.rewards) b.set(fsMod.doc(db,'families',fid,'rewards',r.id), r);
      for (const id of known.members) if (!fam.members.find(m=>m.id===id)) b.delete(fsMod.doc(db,'families',fid,'members',id));
      for (const id of known.chores)  if (!fam.chores.find(c=>c.id===id))  b.delete(fsMod.doc(db,'families',fid,'chores',id));
      for (const id of known.rewards) if (!fam.rewards.find(r=>r.id===id)) b.delete(fsMod.doc(db,'families',fid,'rewards',id));
      try { await b.commit(); } catch (e) { console.warn('[PomPond] saveCrud', e); }
    },

    accountSheet: () => accountSheet(),
    joinCodeField: () => {
      if (cloud.role !== 'parent') return '';
      const kids = (PP.getState().members || []).filter(m => m.role === 'child');
      const codeRows = kids.map(k =>
        `<div class="minrow" style="margin-top:8px"><span style="flex:1;font-weight:800">${k.emoji||'🧒'} ${(k.name||'Kid').replace(/</g,'&lt;')}</span>`+
        `<input class="kidcode" data-mid="${k.id}" inputmode="numeric" maxlength="4" placeholder="4-digit" value="${(cloud.kidCodes&&cloud.kidCodes[k.id])||''}" style="width:90px;text-align:center"></div>`
      ).join('');
      return `<div class="field"><label>Kid sign-in</label>`+
        `<div class="minrow"><input id="jcode" value="${cloud.joinCode||'…'}" readonly style="flex:1"><button class="iconbtn" id="jregen" style="height:42px">↻</button></div>`+
        `<div class="hint" style="margin:6px 0 0;text-align:left">Kids open the app on their own device, tap “I’m a kid”, and enter this join code + their 4-digit code below.</div>`+
        (kids.length?`<label style="margin-top:12px">Each kid’s 4-digit code</label>${codeRows}`:`<div class="hint" style="margin:8px 0 0;text-align:left">Add a kid first (Kids → + Kid), then set their code here.</div>`)+
        `</div>`;
    },
    // Grown-up invite code: another adult signs up on their own phone and joins
    // as a full co-parent. Parents only.
    grownupCodeField: () => {
      if (cloud.role !== 'parent') return '';
      return `<div class="field"><label>Invite another grown-up</label>`+
        `<div class="minrow"><input id="pcode" value="${cloud.parentCode||'…'}" readonly style="flex:1"><button class="iconbtn" id="pregen" style="height:42px">↻</button></div>`+
        `<div class="hint" style="margin:6px 0 0;text-align:left">A partner or grandparent opens Pom Pond on their own phone, taps “Join a family”, and enters this code — they become a full co-parent with their own login.</div>`+
        `</div>`;
    },
    wireGrownupCode: (s) => {
      const b = s.querySelector('#pregen');
      if (b) b.onclick = () => fns.regenParentCode({}).then(r => { cloud.parentCode = r.parentCode; const i = s.querySelector('#pcode'); if (i) i.value = r.parentCode; PP.toast('New grown-up code ✅'); });
    },
    wireJoinCode: (s) => {
      const b = s.querySelector('#jregen');
      if (b) b.onclick = () => fns.regenJoinCode({}).then(r => { cloud.joinCode = r.joinCode; const i = s.querySelector('#jcode'); if (i) i.value = r.joinCode; PP.toast('New join code ✅'); });
      s.querySelectorAll('.kidcode').forEach(inp => {
        const commit = () => {
          const code = (inp.value||'').replace(/\D/g,'').slice(0,4); inp.value = code;
          if (code.length !== 4) return;
          if ((cloud.kidCodes||{})[inp.dataset.mid] === code) return;
          fns.setKidCode({ memberId: inp.dataset.mid, code })
            .then(() => { (cloud.kidCodes = cloud.kidCodes||{})[inp.dataset.mid] = code; PP.toast('Kid code saved 🔑'); })
            .catch(() => PP.toast('Couldn’t save that code'));
        };
        inp.onblur = commit;
        inp.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); inp.blur(); } };
      });
    },
  };
  PP.setCloud(cloud);

  // ---- auth state ----
  authMod.onAuthStateChanged(auth, async (user) => {
    cloudReady = true;   // cloud has taken control of the gate; stop the watchdog
    if (!user) { cloud.active = false; stopSync(); return showWelcomeOrSignIn(); }
    const token = await user.getIdTokenResult(true);
    const fid = token.claims.familyId;
    if (!fid) {
      // signed in but no family yet → parent onboarding (offer local migration)
      return onboardingGate(user);
    }
    cloud.fid = fid; cloud.role = token.claims.role; cloud.member = token.claims.memberId || null;
    if (cloud.role === 'parent') {
      const a = await fsMod.getDoc(fsMod.doc(db,'families',fid,'private','auth')).catch(()=>null);
      cloud.joinCode = a && a.exists() ? (a.data().joinCode||'') : '';
      cloud.kidCodes = a && a.exists() ? (a.data().kidCodes||{}) : {};
      cloud.parentCode = a && a.exists() ? (a.data().parentCode||'') : '';
    }
    subscribe(fid, cloud.role, cloud.member);
  });

  // ---- gates ----
  // First-ever visit gets a one-time welcome that explains the app (handy when a
  // family opens the shared link directly rather than via the portal intro).
  function showWelcomeOrSignIn() {
    let seen = false; try { seen = localStorage.getItem('pp_seen_welcome') === '1'; } catch (e) {}
    return seen ? signInGate() : welcomeGate();
  }
  function welcomeGate() {
    let art = '<div style="font-size:46px">🐸</div>';
    try {
      const CE = (typeof window !== 'undefined') && window.CritterEngine;
      if (CE) art = ['frog','axolotl','duck'].map((a,i)=>`<div style="width:66px;height:66px">${CE.render('welcome:'+a+i,a,i===1?2:1)}</div>`).join('');
    } catch (e) {}
    showGate(`<div class="auth-card">
      <div style="display:flex;justify-content:center;align-items:flex-end;gap:4px;margin-bottom:2px">${art}</div>
      <h2>Welcome to Pom Pond 🐸</h2>
      <p>A chore tracker &amp; reward center the whole family will actually enjoy.</p>
      <div style="text-align:left;font-weight:700;color:var(--ink);font-size:14px;line-height:1.45;margin:0 0 18px">
        <div style="margin:7px 0">✅ Kids do <b>chores</b> &amp; kind things to earn <b>Poms</b></div>
        <div style="margin:7px 0">🐣 Every Pom hatches a <b>collectible critter</b> into their pond</div>
        <div style="margin:7px 0">🎁 Filling buckets unlocks <b>rewards you choose</b></div>
      </div>
      <div class="sa"><button class="save" id="ppgo">Get started →</button></div>
      <p style="font-size:12px;margin:13px 0 0">A grown-up signs up first, sets a PIN, and adds the kids.</p>
    </div>`, g => {
      g.querySelector('#ppgo').onclick = () => { try { localStorage.setItem('pp_seen_welcome','1'); } catch (e) {} signInGate(); };
    });
  }
  function signInGate() {
    showGate(`<div class="auth-card">
      <h2>🐸 Pom Pond</h2><p>Sign in to sync your family across devices.</p>
      <div class="auth-tabs"><button id="tParent" class="on">I'm a parent</button><button id="tKid">I'm a kid</button></div>
      <div id="paneParent">
        <div class="field"><input id="email" type="email" placeholder="Email" autocomplete="username"></div>
        <div class="field"><input id="pass" type="password" placeholder="Password" autocomplete="current-password"></div>
        <div class="sa"><button class="save" id="login">Sign in</button><button class="save" id="signup" style="background:#5BB98C">Create account</button></div>
        <button class="gbtn" id="google">Continue with Google</button>
        <div class="hint" id="authmsg" style="margin-top:10px;min-height:16px;color:#E5524B"></div>
      </div>
      <div id="paneKid" style="display:none">
        <div class="field"><input id="jc" placeholder="Family join code" autocapitalize="characters"></div>
        <div class="field"><input id="kcode" inputmode="numeric" maxlength="4" placeholder="Your 4-digit code"></div>
        <div class="sa"><button class="save" id="kidgo">Find my pond</button></div>
        <div class="hint" id="kiderr"></div>
      </div></div>`, g => {
      const tP=g.querySelector('#tParent'), tK=g.querySelector('#tKid');
      const show=(kid)=>{ tP.classList.toggle('on',!kid); tK.classList.toggle('on',kid);
        g.querySelector('#paneParent').style.display=kid?'none':''; g.querySelector('#paneKid').style.display=kid?'':'none'; };
      tP.onclick=()=>show(false); tK.onclick=()=>show(true);
      const email=()=>g.querySelector('#email').value.trim(), pass=()=>g.querySelector('#pass').value;
      const setMsg=(m)=>{ const el=g.querySelector('#authmsg'); if(el) el.textContent=m||''; };
      // Email auth with VISIBLE feedback: validates, shows a working state on the
      // button, and leaves any error on screen (toasts are too easy to miss).
      const runEmail=(btn,fn)=>{
        const e=email(), p=pass(); setMsg('');
        if(!e){ setMsg('Enter your email address.'); return; }
        if(!p || p.length<6){ setMsg('Password must be at least 6 characters.'); return; }
        const orig=btn.textContent; btn.textContent='…'; btn.disabled=true;
        Promise.resolve().then(()=>fn(auth,e,p))
          .catch(err=>{ console.warn('[PomPond] email auth', err && err.code); setMsg(authMsg(err)); })
          .finally(()=>{ btn.textContent=orig; btn.disabled=false; });
      };
      g.querySelector('#login').onclick=()=>runEmail(g.querySelector('#login'), authMod.signInWithEmailAndPassword);
      g.querySelector('#signup').onclick=()=>runEmail(g.querySelector('#signup'), authMod.createUserWithEmailAndPassword);
      g.querySelector('#google').onclick=()=>{ setMsg(''); authMod.signInWithPopup(auth,new authMod.GoogleAuthProvider()).catch(e=>setMsg(authMsg(e))); };
      g.querySelector('#kidgo').onclick=async()=>{
        const err=g.querySelector('#kiderr'); err.textContent='Connecting…';
        try {
          if (!auth.currentUser) await authMod.signInAnonymously(auth);
          // need the family roster to bind — but kid doesn't know memberId yet.
          // bindDevice accepts memberId; we resolve it by letting the kid pick after a
          // lightweight lookup. For simplicity v1: ask parent to share code AND name->the
          // parent set a per-kid code, so we try binding by scanning members client-side
          // is not possible (kid can't read family yet). So we bind by join code + code and
          // let the function match the (memberId,code) — kid enters memberId-less: instead
          // we require the kid to also know which avatar. Show roster after anon sign-in via
          // a public-by-joincode lookup is out of scope; v1 asks the parent to hand the kid
          // the device already on their tile. Fallback: bind to the single matching code.
          await bindByCode(g.querySelector('#jc').value, g.querySelector('#kcode').value, err);
        } catch (e) { err.textContent = authMsg(e); }
      };
    });
  }

  // Kid binding: try each child member's code server-side. To keep the kid flow
  // truly codes-only (no roster needed), bindDevice is called with memberId omitted
  // and the function matches the 4-digit code to a unique child. (If codes collide,
  // the parent is prompted to make them unique.)
  async function bindByCode(joinCode, code, err) {
    try {
      const out = await fns.bindDevice({ joinCode: (joinCode||'').toUpperCase(), code, memberId: null });
      await auth.currentUser.getIdToken(true);
      // onAuthStateChanged won't refire on claim change → re-resolve now:
      const t = await auth.currentUser.getIdTokenResult(true);
      cloud.fid = t.claims.familyId; cloud.role = 'child'; cloud.member = t.claims.memberId;
      subscribe(cloud.fid, 'child', cloud.member);
    } catch (e) { err.textContent = authMsg(e); }
  }

  function onboardingGate(user) {
    const local = PP.localFamily();
    const canMigrate = local && Array.isArray(local.members) && local.members.some(m=>m.role==='child');
    const loadCodes = async () => {
      const a = await fsMod.getDoc(fsMod.doc(db,'families',cloud.fid,'private','auth')).catch(()=>null);
      cloud.joinCode = a && a.exists() ? (a.data().joinCode||'') : '';
      cloud.parentCode = a && a.exists() ? (a.data().parentCode||'') : '';
    };
    showGate(`<div class="auth-card">
      <h2>Welcome to Pom Pond ☁️</h2>
      <p>${user.email||'Signed in'} — start your family, or join one a partner already made.</p>
      <div class="auth-tabs"><button id="tNew" class="on">Start a family</button><button id="tJoin">Join a family</button></div>
      <div id="paneNew">
        <div class="field"><input id="fname" placeholder="Family name" value="${local&&local.name?String(local.name).replace(/"/g,'&quot;'):''}"></div>
        ${canMigrate?`<div class="toggle">Bring my existing pond (${local.members.filter(m=>m.role==='child').length} kid(s), ${(local.critters||[]).length} critters) <div class="sw on" id="mig"><i></i></div></div>`:''}
        <div class="sa"><button class="save" id="create">Create family 🎉</button></div>
      </div>
      <div id="paneJoin" style="display:none">
        <div class="field"><input id="jpname" placeholder="Your name (Mum, Dad, Grandma…)" maxlength="14"></div>
        <div class="field"><input id="jpcode" placeholder="Grown-up invite code" autocapitalize="characters"></div>
        <div class="sa"><button class="save" id="joinbtn">Join family 🤝</button></div>
        <div class="hint" id="joinerr" style="margin-top:8px;text-align:left"></div>
      </div>
      <button class="gbtn" id="signout">Sign out</button></div>`, g => {
      const tN=g.querySelector('#tNew'), tJ=g.querySelector('#tJoin');
      const show=(join)=>{ tN.classList.toggle('on',!join); tJ.classList.toggle('on',join);
        g.querySelector('#paneNew').style.display=join?'none':''; g.querySelector('#paneJoin').style.display=join?'':'none'; };
      tN.onclick=()=>show(false); tJ.onclick=()=>show(true);
      let migrate = canMigrate;
      const sw = g.querySelector('#mig'); if (sw) sw.onclick=()=>{ migrate=!migrate; sw.classList.toggle('on',migrate); };
      g.querySelector('#signout').onclick=()=>authMod.signOut(auth);
      g.querySelector('#create').onclick=async()=>{
        g.querySelector('#create').textContent='Creating…';
        try {
          const payload = { name: g.querySelector('#fname').value.trim()||'Our Family' };
          if (migrate && canMigrate) payload.import = PP.normalize(local);
          await fns.createFamily(payload);
          await user.getIdToken(true);
          const t = await user.getIdTokenResult(true);
          cloud.fid = t.claims.familyId; cloud.role = 'parent';
          await loadCodes();
          subscribe(cloud.fid, 'parent', null);
        } catch (e) { PP.toast(authMsg(e)); g.querySelector('#create').textContent='Create family 🎉'; }
      };
      g.querySelector('#joinbtn').onclick=async()=>{
        const err=g.querySelector('#joinerr'); err.textContent='Joining…';
        try {
          const code=(g.querySelector('#jpcode').value||'').toUpperCase().trim();
          const name=(g.querySelector('#jpname').value||'').trim();
          if (code.length < 4) { err.textContent='Enter the grown-up invite code.'; return; }
          await fns.joinFamilyAsParent({ code, name });
          await user.getIdToken(true);
          const t = await user.getIdTokenResult(true);
          cloud.fid = t.claims.familyId; cloud.role = 'parent';
          await loadCodes();
          subscribe(cloud.fid, 'parent', null);
        } catch (e) { err.textContent = authMsg(e); }
      };
    });
  }

  function accountSheet() {
    PP.openSheet(`<h3>Account ☁️</h3>
      <p style="font-weight:700;color:var(--soft);font-size:14px">${cloud.role==='parent'?'Parent':'Kid'} · ${auth.currentUser&&auth.currentUser.email?auth.currentUser.email:'this device'}</p>
      ${cloud.role==='parent'&&cloud.joinCode?`<div class="field"><label>Kid join code</label><input value="${cloud.joinCode}" readonly></div>`:''}
      <div class="sa"><button class="cancel">Close</button><button class="save" id="so" style="background:#E5524B">Sign out</button></div>`, s => {
      s.querySelector('.cancel').onclick=PP.closeSheet;
      s.querySelector('#so').onclick=()=>{ PP.closeSheet(); authMod.signOut(auth); };
    });
  }

  function authMsg(e) {
    const c = (e && (e.code||e.message)) || 'error';
    if (/operation-not-allowed/.test(c)) return 'Email sign-in isn’t enabled for this app yet — use “Continue with Google” for now.';
    if (/wrong-password|invalid-credential|user-not-found/.test(c)) return 'Wrong email or password.';
    if (/invalid-email/.test(c)) return 'That email address doesn’t look right.';
    if (/email-already-in-use/.test(c)) return 'That email already has an account — tap “Sign in” instead.';
    if (/weak-password/.test(c)) return 'Password should be at least 6 characters.';
    if (/network-request-failed/.test(c)) return 'No internet connection — check your signal and try again.';
    if (/too-many-requests/.test(c)) return 'Too many attempts — wait a minute and try again.';
    if (/popup-closed|popup-blocked|cancelled-popup/.test(c)) return 'Sign-in popup was closed — try again.';
    if (/permission-denied|Wrong kid code/.test(c)) return 'Wrong code — ask a parent.';
    if (/not-found|Unknown join code/.test(c)) return 'That join code wasn\'t found.';
    return String(c).replace(/^.*\//,'').replace(/-/g,' ');
  }
}
