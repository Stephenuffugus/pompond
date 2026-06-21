/* ============================================================================
   Pom Pond — Cloud Functions (server-authoritative economy)

   Every economy mutation runs HERE, with the Admin SDK, inside a transaction.
   The client never computes a Pom/critter/bucket result it can submit — it asks
   the server to do it, and the server runs the SAME shared Economy module that
   the browser runs in local mode (functions/shared/* is synced from src/* by
   build.mjs). That is what makes "a kid can't credit themselves" true: the
   rules deny client economy writes, and only this trusted code writes them.

   Auth model — custom claims minted here:
     parent: { familyId, role:'parent' }
     child:  { familyId, memberId, role:'child' }
   ============================================================================ */
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

const Economy = require('./shared/economy.js');
const CritterEngine = require('./shared/critter-engine.js'); // loaded so Economy can mint

initializeApp();
const db = getFirestore();
const auth = getAuth();

/* ---------------- helpers ---------------- */
const famRef = (fid) => db.collection('families').doc(fid);
function requireAuth(req) {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Sign in first.');
  return req.auth;
}
function requireParent(req) {
  const a = requireAuth(req);
  const fid = a.token.familyId;
  if (!fid || a.token.role !== 'parent') throw new HttpsError('permission-denied', 'Parents only.');
  return { uid: a.uid, fid };
}
function requireChild(req) {
  const a = requireAuth(req);
  const fid = a.token.familyId, memberId = a.token.memberId;
  if (!fid || a.token.role !== 'child' || !memberId)
    throw new HttpsError('permission-denied', 'Child device not bound.');
  return { uid: a.uid, fid, memberId };
}
function code6() {
  const C = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no ambiguous chars
  let s = ''; for (let i = 0; i < 6; i++) s += C[Math.floor(Math.random() * C.length)];
  return s;
}

// Run a shared-Economy mutation against ONE kid, transactionally, and persist
// the deltas (Economy only appends critters/inventory/ledger/pending + sets
// done keys + mutates the kid's economy fields). Returns the minted critters
// so the caller can hand them to the earning kid's device for the reveal.
async function applyEconomy(fid, memberId, mutate, opts) {
  opts = opts || {};
  const ref = famRef(fid);
  return db.runTransaction(async (tx) => {
    const famSnap = await tx.get(ref);
    if (!famSnap.exists) throw new HttpsError('not-found', 'Family not found.');
    const memberRef = ref.collection('members').doc(memberId);
    const memberSnap = await tx.get(memberRef);
    if (!memberSnap.exists) throw new HttpsError('not-found', 'Member not found.');
    const kid = Object.assign({ id: memberId }, memberSnap.data());
    if (kid.role !== 'child') throw new HttpsError('failed-precondition', 'Not a child member.');
    // seed economy defaults (a freshly-added kid is profile-only) so every
    // persisted field is defined — Firestore rejects `undefined`.
    kid.buckets = kid.buckets || { s:0, m:0, b:0 };
    kid.palms = kid.palms || 0;
    kid.choices = kid.choices || 0;
    kid.streak = kid.streak || 0;
    if (kid.lastActive === undefined) kid.lastActive = null;

    // pre-read any done keys the mutation needs (daily-lock atomicity)
    const done = {};
    if (opts.doneKey) {
      const dSnap = await tx.get(ref.collection('done').doc(opts.doneKey));
      if (dSnap.exists) done[opts.doneKey] = true;
    }

    // minimal fam slice — Economy only reads settings + this kid + done,
    // and only APPENDS to these arrays / sets done keys.
    const fam = {
      settings: famSnap.data().settings || {},
      members: [kid], critters: [], inventory: [], log: [], pending: [], done
    };

    // dedicated reveals collector (NOT fam.critters — addCritter pushes to both,
    // so sharing the array would double every minted critter).
    const reveals = [];
    const result = mutate(fam, kid, reveals) || {};
    if (result.status === 'already') throw new HttpsError('already-exists', 'Already done today.');
    if (result.reject) throw new HttpsError('failed-precondition', result.reject);

    // persist deltas
    const { palms, buckets, choices, streak, lastActive } = kid;
    tx.set(memberRef, { palms, buckets, choices, streak, lastActive }, { merge: true });
    for (const c of fam.critters) tx.set(ref.collection('critters').doc(c.id), c);
    for (const i of fam.inventory) tx.set(ref.collection('inventory').doc(i.id), i);
    for (const e of fam.log) tx.set(ref.collection('ledger').doc(e.id), e);
    for (const p of fam.pending) tx.set(ref.collection('pending').doc(p.id), p);
    for (const k of Object.keys(fam.done))
      tx.set(ref.collection('done').doc(k), { ownerId: memberId, at: Date.now() });

    return { reveals, status: result.status };
  });
}

/* ---------------- family creation + migration ---------------- */
// data: { name, settings, parentName, joinCode?, import? }
//   import (optional) = a whole local pomPondV1 family blob to migrate intact.
exports.createFamily = onCall(async (req) => {
  const a = requireAuth(req);
  const uid = a.uid;
  const data = req.data || {};
  const imp = data.import || null;

  // refuse to clobber: one family per parent uid for v1
  const existing = await db.collection('families').where('parentUids', 'array-contains', uid).limit(1).get();
  if (!existing.empty) {
    const fid = existing.docs[0].id;
    await auth.setCustomUserClaims(uid, { familyId: fid, role: 'parent' });
    return { familyId: fid, existed: true };
  }

  const fid = famRef('_new_').parent.doc().id; // random id
  const ref = famRef(fid);
  const settings = Object.assign(
    { smallCap:4, medCap:3, bigCap:2, approval:false, parentPin:'0000', currencyName:'Pom' },
    (imp && imp.settings) || data.settings || {}
  );
  const joinCode = (data.joinCode || code6()).toUpperCase();
  const parentCode = code6(); // grown-up invite code (co-parents / grandparents)

  const batch = db.batch();
  // A newly created family ALWAYS starts setup:false, so the parent is forced
  // through the welcome wizard and must choose their OWN PIN before they can use
  // the app — even when migrating local data (the wizard pre-lists imported
  // kids). Returning parents hit the early return above and are never re-onboarded.
  batch.set(ref, {
    name: (imp && imp.name) || data.name || 'Our Family',
    setup: false,
    settings,
    parentUids: [uid],
    createdAt: FieldValue.serverTimestamp()
  });

  // members
  const members = (imp && imp.members) || [{ id:'p1', name: data.parentName || 'Parent', role:'parent', emoji:'🧑‍🍳', color:'#3FA7A1' }];
  let hasParent = false;
  const kidCodes = {};
  for (const m of members) {
    if (m.role === 'parent') { hasParent = true; }
    const doc = Object.assign({}, m);
    batch.set(ref.collection('members').doc(m.id), doc);
    if (m.role === 'child') kidCodes[m.id] = (data.kidCodes && data.kidCodes[m.id]) || '0000';
  }
  if (!hasParent) batch.set(ref.collection('members').doc('p1'),
    { id:'p1', name:data.parentName||'Parent', role:'parent', emoji:'🧑‍🍳', color:'#3FA7A1' });

  // chores + rewards — a fresh (non-migrated) family gets the starter set so the
  // parent never lands in an empty app (matches the prototype's local defaults).
  let chores = (imp && imp.chores) || data.chores || [];
  if (!imp && chores.length === 0) chores = [
    { id: Economy.id(), name:'Tidy Room',   emoji:'🛏️', secs:600, palm:1 },
    { id: Economy.id(), name:'Dishes',      emoji:'🍽️', secs:300, palm:1 },
    { id: Economy.id(), name:'Brush Teeth', emoji:'🪥', secs:120, palm:1 },
    { id: Economy.id(), name:'Feed Pet',    emoji:'🐕', secs:180, palm:1 }
  ];
  for (const c of chores) batch.set(ref.collection('chores').doc(c.id), c);
  let rewards = (imp && imp.rewards) || data.rewards || [];
  if (!imp && rewards.length === 0) rewards = [
    { id: Economy.id(), name:'15 min screen time', emoji:'📺', tier:'small' },
    { id: Economy.id(), name:'Pick dinner',        emoji:'🍕', tier:'medium' },
    { id: Economy.id(), name:'Movie night',        emoji:'🎬', tier:'big' }
  ];
  for (const r of rewards) batch.set(ref.collection('rewards').doc(r.id), r);

  // migrate economy artifacts intact (admin write — allowed)
  if (imp) {
    for (const c of (imp.critters||[])) batch.set(ref.collection('critters').doc(c.id||db.collection('x').doc().id), c);
    for (const i of (imp.inventory||[])) batch.set(ref.collection('inventory').doc(i.id||db.collection('x').doc().id), i);
    for (const e of (imp.log||[])) batch.set(ref.collection('ledger').doc(e.id||db.collection('x').doc().id), e);
    for (const k of Object.keys(imp.done||{})) batch.set(ref.collection('done').doc(k), { ownerId:(k.split('|')[0]), at: Date.now() });
  }

  // private auth doc (join code + per-kid codes + grown-up code) — parents only.
  batch.set(ref.collection('private').doc('auth'), { joinCode, kidCodes, parentCode });
  // top-level code -> family maps (read by Cloud Functions via Admin SDK only).
  batch.set(db.collection('joinCodes').doc(joinCode), { familyId: fid });
  batch.set(db.collection('parentCodes').doc(parentCode), { familyId: fid });

  await batch.commit();
  await auth.setCustomUserClaims(uid, { familyId: fid, role: 'parent' });
  return { familyId: fid, joinCode };
});

// Parent regenerates the join code (e.g. after a kid leaves).
exports.regenJoinCode = onCall(async (req) => {
  const { fid } = requireParent(req);
  const ref = famRef(fid);
  const authRef = ref.collection('private').doc('auth');
  const cur = (await authRef.get()).data() || {};
  if (cur.joinCode) await db.collection('joinCodes').doc(cur.joinCode).delete().catch(()=>{});
  const joinCode = code6();
  await authRef.set({ joinCode }, { merge: true });
  await db.collection('joinCodes').doc(joinCode).set({ familyId: fid });
  return { joinCode };
});

// A second adult (partner, grandparent) joins an existing family as a full
// co-parent using the family's grown-up invite code. Mints a parent claim and
// creates their parent member. One family per uid for v1.
exports.joinFamilyAsParent = onCall(async (req) => {
  const a = requireAuth(req);
  const uid = a.uid;
  if (a.token.familyId) return { familyId: a.token.familyId, existed: true };
  const code = String((req.data && req.data.code) || '').toUpperCase().trim();
  const name = (String((req.data && req.data.name) || '').trim() || 'Parent').slice(0, 14);
  if (!code) throw new HttpsError('invalid-argument', 'Grown-up code required.');
  const map = await db.collection('parentCodes').doc(code).get();
  if (!map.exists) throw new HttpsError('not-found', 'Unknown grown-up code.');
  const fid = map.data().familyId;
  const ref = famRef(fid);
  if (!(await ref.get()).exists) throw new HttpsError('not-found', 'Family not found.');

  const mid = 'pa_' + uid.slice(0, 10);
  const batch = db.batch();
  batch.set(ref, { parentUids: FieldValue.arrayUnion(uid) }, { merge: true });
  batch.set(ref.collection('members').doc(mid),
    { id: mid, name, role: 'parent', emoji: '🧑', color: '#7C6FF0', parentAuthId: uid }, { merge: true });
  await batch.commit();
  await auth.setCustomUserClaims(uid, { familyId: fid, role: 'parent' });
  return { familyId: fid, memberId: mid };
});

// Parent regenerates the grown-up invite code.
exports.regenParentCode = onCall(async (req) => {
  const { fid } = requireParent(req);
  const ref = famRef(fid);
  const authRef = ref.collection('private').doc('auth');
  const cur = (await authRef.get()).data() || {};
  if (cur.parentCode) await db.collection('parentCodes').doc(cur.parentCode).delete().catch(()=>{});
  const parentCode = code6();
  await authRef.set({ parentCode }, { merge: true });
  await db.collection('parentCodes').doc(parentCode).set({ familyId: fid });
  return { parentCode };
});

// Parent sets/updates a kid's 4-digit device code.
exports.setKidCode = onCall(async (req) => {
  const { fid } = requireParent(req);
  const { memberId, code } = req.data || {};
  if (!/^\d{4}$/.test(String(code||''))) throw new HttpsError('invalid-argument', 'Code must be 4 digits.');
  await famRef(fid).collection('private').doc('auth')
    .set({ kidCodes: { [memberId]: String(code) } }, { merge: true });
  return { ok: true };
});

/* ---------------- kid device binding ---------------- */
// Anonymous kid device binds to exactly one child member using the family join
// code + that kid's 4-digit code (a shared secret the parent set). Validated
// server-side; mints the child claim. A kid can NEVER mint a parent claim.
exports.bindDevice = onCall(async (req) => {
  const a = requireAuth(req);
  const uid = a.uid;
  const { joinCode, memberId, code } = req.data || {};
  const jc = String(joinCode||'').toUpperCase();
  const map = await db.collection('joinCodes').doc(jc).get();
  if (!map.exists) throw new HttpsError('not-found', 'Unknown join code.');
  const fid = map.data().familyId;
  const ref = famRef(fid);

  const authDoc = (await ref.collection('private').doc('auth').get()).data() || {};
  const kidCodes = authDoc.kidCodes || {};

  // Resolve the member: either the caller named one, or we match the (unique)
  // 4-digit code to exactly one child so the kid flow can be codes-only.
  let mid = memberId;
  if (!mid) {
    const matches = Object.keys(kidCodes).filter(k => String(kidCodes[k]) === String(code));
    if (matches.length === 0) throw new HttpsError('permission-denied', 'Wrong kid code.');
    if (matches.length > 1) throw new HttpsError('failed-precondition', 'Code not unique — ask a parent to set distinct kid codes.');
    mid = matches[0];
  } else if (String(kidCodes[mid] || '') !== String(code)) {
    throw new HttpsError('permission-denied', 'Wrong kid code.');
  }

  const memberSnap = await ref.collection('members').doc(mid).get();
  if (!memberSnap.exists || memberSnap.data().role !== 'child')
    throw new HttpsError('failed-precondition', 'Not a child member.');

  await ref.collection('members').doc(mid).set({ childAuthId: uid }, { merge: true });
  await db.collection('deviceBindings').doc(uid).set({ familyId: fid, memberId: mid });
  await auth.setCustomUserClaims(uid, { familyId: fid, memberId: mid, role: 'child' });
  return { familyId: fid, memberId: mid };
});

/* ---------------- economy callables ---------------- */

// Kid completes a chore (or a parent completes on their behalf).
exports.completeChore = onCall(async (req) => {
  const a = requireAuth(req);
  const fid = a.token.familyId;
  if (!fid) throw new HttpsError('permission-denied', 'No family.');
  const isParent = a.token.role === 'parent';
  const memberId = isParent ? req.data.memberId : a.token.memberId;
  const choreId = req.data.choreId;
  if (!memberId || !choreId) throw new HttpsError('invalid-argument', 'memberId + choreId required.');

  const choreSnap = await famRef(fid).collection('chores').doc(choreId).get();
  if (!choreSnap.exists) throw new HttpsError('not-found', 'Chore not found.');
  const chore = Object.assign({ id: choreId }, choreSnap.data());
  const doneKey = Economy.doneKey({ id: memberId }, chore);

  return applyEconomy(fid, memberId, (fam, kid, reveals) =>
    Economy.completeChore(fam, kid, chore, reveals, { byUid: a.uid, forceEarn: isParent })
  , { doneKey });
});

// Parent grants a kindness / school Pom.
exports.givePom = onCall(async (req) => {
  const { uid, fid } = requireParent(req);
  const { memberId, src, note } = req.data || {};
  if (!memberId || !['kindness','school'].includes(src))
    throw new HttpsError('invalid-argument', 'memberId + src(kindness|school) required.');
  return applyEconomy(fid, memberId, (fam, kid, reveals) => {
    Economy.earn(fam, kid, { type: src, special: true, note: note || "", byUid: uid }, reveals);
    return { status: 'earned' };
  });
});

// Kid resolves a queued medium-fill choice.
exports.resolveChoice = onCall(async (req) => {
  const { fid, memberId } = requireChild(req);
  const saveUp = !!(req.data && req.data.saveUp);
  return applyEconomy(fid, memberId, (fam, kid, reveals) => {
    if (!((kid.choices||0) > 0)) return { reject: 'No pending choice.' };
    Economy.resolveChoice(fam, kid, saveUp, reveals);
    return { status: 'resolved' };
  });
});

// Kid redeems a ready reward token (ready -> redeemed). Parent later marks given.
exports.redeem = onCall(async (req) => {
  const { fid, memberId } = requireChild(req);
  const { itemId, rewardId } = req.data || {};
  const ref = famRef(fid);
  await db.runTransaction(async (tx) => {
    const itemRef = ref.collection('inventory').doc(itemId);
    const snap = await tx.get(itemRef);
    if (!snap.exists) throw new HttpsError('not-found', 'Token not found.');
    const it = snap.data();
    if (it.ownerId !== memberId) throw new HttpsError('permission-denied', 'Not your token.');
    if (it.status !== 'ready') throw new HttpsError('failed-precondition', 'Token not redeemable.');
    tx.set(itemRef, { status: 'redeemed', rewardId: rewardId || null, at: Date.now() }, { merge: true });
    const rwSnap = rewardId ? await tx.get(ref.collection('rewards').doc(rewardId)) : null;
    const note = rwSnap && rwSnap.exists ? rwSnap.data().name : '';
    tx.set(ref.collection('ledger').doc(Economy.id()),
      { id: Economy.id(), ownerId: memberId, type: 'redeem', note, at: Date.now(), byUid: req.auth.uid });
  });
  return { ok: true };
});

// Parent approves a pending (approval-mode) chore -> credits the kid.
exports.approvePending = onCall(async (req) => {
  const { fid } = requireParent(req);
  const pendId = req.data && req.data.pendingId;
  const ref = famRef(fid);
  const pSnap = await ref.collection('pending').doc(pendId).get();
  if (!pSnap.exists) throw new HttpsError('not-found', 'Pending item gone.');
  const p = pSnap.data();
  // look up the chore name so the ledger records what the Pom was for
  const chSnap = p.choreId ? await ref.collection('chores').doc(p.choreId).get() : null;
  const choreName = chSnap && chSnap.exists ? (chSnap.data().name || '') : '';
  const out = await applyEconomy(fid, p.ownerId, (fam, kid, reveals) => {
    Economy.earn(fam, kid, { type: 'chore', note: choreName }, reveals);
    return { status: 'earned' };
  });
  await ref.collection('pending').doc(pendId).delete();
  return out; // reveals belong to the kid's device, not the parent's
});

exports.denyPending = onCall(async (req) => {
  const { fid } = requireParent(req);
  await famRef(fid).collection('pending').doc(req.data.pendingId).delete();
  return { ok: true };
});

// Parent marks a redeemed reward as delivered (redeemed -> given).
exports.markGiven = onCall(async (req) => {
  const { fid } = requireParent(req);
  const itemRef = famRef(fid).collection('inventory').doc(req.data.itemId);
  const snap = await itemRef.get();
  if (!snap.exists || snap.data().status !== 'redeemed')
    throw new HttpsError('failed-precondition', 'Not a redeemed token.');
  await itemRef.set({ status: 'given', at: Date.now() }, { merge: true });
  return { ok: true };
});

// Parent resets all progress (keeps kids, chores, rewards).
exports.resetProgress = onCall(async (req) => {
  const { fid } = requireParent(req);
  const ref = famRef(fid);
  for (const col of ['critters','inventory','ledger','done','pending']) {
    const docs = await ref.collection(col).get();
    let batch = db.batch(), n = 0;
    for (const d of docs.docs) { batch.delete(d.ref); if (++n === 400) { await batch.commit(); batch = db.batch(); n = 0; } }
    if (n) await batch.commit();
  }
  const kids = await ref.collection('members').where('role','==','child').get();
  const b = db.batch();
  for (const k of kids.docs) b.set(k.ref, { palms:0, buckets:{s:0,m:0,b:0}, choices:0, streak:0, lastActive:null }, { merge: true });
  await b.commit();
  return { ok: true };
});

/* ---------------- Phase 2 seam: premium photo-verify ---------------- */
// Wired now (cheap), shipped later. Vision API per-call cost is the honest gate.
exports.verifyChorePhoto = onCall(async (req) => {
  requireAuth(req);
  // TODO(phase2): pull image, call a vision model, confirm + reply with a one-liner,
  // then credit via applyEconomy(). Gated behind an entitlement flag.
  throw new HttpsError('unimplemented', 'Photo-verify is a Phase 2 premium feature.');
});
