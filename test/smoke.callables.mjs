// Pom Pond — end-to-end callable smoke test (against the emulator suite).
// Drives the REAL Cloud Functions through the client SDK exactly as the app does:
// parent signs up -> createFamily -> add kid/chore -> completeChore -> daily lock
// -> drive the ladder via givePom -> kid binds device -> resolveChoice -> redeem
// -> parent markGiven. Proves the server-authoritative economy works as a whole.
//   Run:  npm run smoke   (firebase emulators:exec auth,firestore,functions ...)
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signInAnonymously } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, doc, setDoc, getDoc, getDocs, collection, query, orderBy, limit, startAfter } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'firebase/functions';

const cfg = { apiKey: 'demo', projectId: 'demo-pom-pond', appId: 'demo' };
let pass = 0, fail = 0;
const ok = (n, c) => { (c ? pass++ : fail++); console.log(`${c ? '✅' : '❌'} ${n}`); };
async function throws(n, p) { try { await p; ok(n, false); } catch { ok(n, true); } }

function makeClient(name) {
  const app = initializeApp(cfg, name);
  const auth = getAuth(app); connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const db = getFirestore(app); connectFirestoreEmulator(db, '127.0.0.1', 8080);
  const fns = getFunctions(app); connectFunctionsEmulator(fns, '127.0.0.1', 5001);
  const call = (n) => (d) => httpsCallable(fns, n)(d).then(r => r.data);
  return { app, auth, db, call };
}

const P = makeClient('parent');
const K = makeClient('kid');

// ---------- parent: account + family ----------
const pUser = (await createUserWithEmailAndPassword(P.auth, `p${Date.now()}@test.com`, 'pw123456')).user;
const { familyId: fid, joinCode } = await P.call('createFamily')({ name: 'Smoke Family' });
await pUser.getIdToken(true); // pick up the parent custom claim
ok('createFamily returns id + joinCode', !!fid && /^[A-Z2-9]{6}$/.test(joinCode));
ok('fresh family seeded starter chores + rewards',
   (await getDocs(collection(P.db, `families/${fid}/chores`))).size === 4 &&
   (await getDocs(collection(P.db, `families/${fid}/rewards`))).size === 3);

// parent adds a kid + a chore (config writes allowed by rules), sets the kid code.
// Profile fields only — exactly like the app's saveCrud; the server seeds economy.
await setDoc(doc(P.db, `families/${fid}/members/k1`),
  { id:'k1', name:'Maya', role:'child', emoji:'🦊', color:'#FF8A5B' });
await setDoc(doc(P.db, `families/${fid}/chores/c1`), { id:'c1', name:'Dishes', secs:60, palm:1 });
await P.call('setKidCode')({ memberId:'k1', code:'1234' });

const kidDoc = async () => (await getDoc(doc(P.db, `families/${fid}/members/k1`))).data();
const count = async (col) => (await getDocs(collection(P.db, `families/${fid}/${col}`))).size;

// ---------- chore completion + server-enforced daily lock ----------
const r1 = await P.call('completeChore')({ memberId:'k1', choreId:'c1' });
ok('completeChore mints exactly one reveal', Array.isArray(r1.reveals) && r1.reveals.length === 1);
let k = await kidDoc();
ok('palms credited server-side (1)', k.palms === 1 && k.buckets.s === 1);
ok('one critter persisted', (await count('critters')) === 1);
await throws('daily-done lock rejects a second same-day completion', P.call('completeChore')({ memberId:'k1', choreId:'c1' }));

// ---------- drive the ladder to a medium fill via kindness Poms ----------
for (let i = 0; i < 11; i++) await P.call('givePom')({ memberId:'k1', src:'kindness', note:'helpful' });
k = await kidDoc();
ok('12 earns → a medium fill queued a choice', (k.choices||0) >= 1);
const inv = (await getDocs(collection(P.db, `families/${fid}/inventory`))).docs.map(d => d.data());
ok('small + medium reward tokens granted', inv.some(i=>i.tier==='small') && inv.some(i=>i.tier==='medium'));
ok('fusion critters minted (rarities 0,1,2 present)', new Set((await getDocs(collection(P.db,`families/${fid}/critters`))).docs.map(d=>d.data().rarity)).size >= 3);

// a parent CLIENT still cannot fabricate economy (defense in depth)
await throws('parent client CANNOT write palms directly', setDoc(doc(P.db,`families/${fid}/members/k1`), { palms: 999 }, { merge:true }));
await throws('parent client CANNOT mint a critter directly', setDoc(doc(P.db,`families/${fid}/critters/hax`), { ownerId:'k1', rarity:3 }));

// ---------- kid device binds + resolves the choice ----------
await signInAnonymously(K.auth);
const bind = await K.call('bindDevice')({ joinCode, code:'1234', memberId:null });
await K.auth.currentUser.getIdToken(true);
ok('kid device bound to its member by code', bind.memberId === 'k1');

// a PARENT in the kid's pond (default shared-phone mode) can resolve on the kid's
// behalf — otherwise the "Pond full!" prompt loops forever (the live bug fix).
await P.call('resolveChoice')({ memberId:'k1', saveUp:false });
k = await kidDoc();
ok('parent can resolve a choice on a kid\'s behalf + it clears', (k.choices||0) === 0);
// drive another choice, then the kid resolves with SAVE
await P.call('givePom')({ memberId:'k1', src:'effort', n:3 });
await P.call('givePom')({ memberId:'k1', src:'effort', n:3 });
await P.call('givePom')({ memberId:'k1', src:'effort', n:3 });
await P.call('givePom')({ memberId:'k1', src:'effort', n:3 });
k = await kidDoc();
if ((k.choices||0) > 0) { await K.call('resolveChoice')({ saveUp:true }); k = await kidDoc(); }
ok('kid SAVE clears the choice (no pending choice left)', (k.choices||0) === 0);

await throws('a kid CANNOT grant itself a reward token', setDoc(doc(K.db,`families/${fid}/inventory/hax`), { ownerId:'k1', tier:'big', status:'ready' }));

// ---------- kid fuses two of their OWN critters (server-authoritative sink) ----------
const critDocs = (await getDocs(collection(P.db,`families/${fid}/critters`))).docs;
const myCrit = critDocs.filter(d=>d.data().ownerId==='k1').slice(0,2).map(d=>d.id);
const beforeN = critDocs.length;
const fz = await K.call('combineCritters')({ critterIds: myCrit });
ok('combineCritters returns the fused child as a reveal', Array.isArray(fz.reveals) && fz.reveals.length===1 && fz.reveals[0].tag==='combo');
ok('fused child climbed to tier 1 (evolution)', fz.reveals[0].tier === 1);
const afterDocs = (await getDocs(collection(P.db,`families/${fid}/critters`))).docs;
ok('fusion archives parents + adds child (net +1, nothing deleted)', afterDocs.length === beforeN+1);
ok('parents kept as fused + combo child persisted', afterDocs.find(d=>d.id===myCrit[0]).data().fused===true && afterDocs.find(d=>d.id===myCrit[1]).data().fused===true && afterDocs.some(d=>d.data().tag==='combo'));
await throws('combine rejects fewer than 2 critters', K.call('combineCritters')({ critterIds:[myCrit[0]] }));
await throws('combine rejects critters that are not the kid\'s', K.call('combineCritters')({ critterIds:['nope1','nope2'] }));
// a PARENT in the kid's pond (shared-phone) can Mix on the kid's behalf — the hero
// feature must not silently fail for the most common operator.
const pCrit = (await getDocs(collection(P.db,`families/${fid}/critters`))).docs.filter(d=>d.data().ownerId==='k1'&&!d.data().fused).slice(0,2).map(d=>d.id);
const pfz = await P.call('combineCritters')({ memberId:'k1', critterIds: pCrit });
ok('parent can Mix on a kid\'s behalf', Array.isArray(pfz.reveals) && pfz.reveals.length===1 && pfz.reveals[0].tag==='combo');

// ---------- redeem (kid) → deliver (parent) ----------
const smallReady = inv.find(i => i.tier==='small' && i.status==='ready');
const smallId = (await getDocs(collection(P.db,`families/${fid}/inventory`))).docs.find(d=>d.data().tier==='small'&&d.data().status==='ready').id;
// pass a REAL rewardId — this is what the UI always does, and exercises the
// in-transaction reward read (reads must precede writes, else the tx throws).
const smallReward = (await getDocs(collection(P.db,`families/${fid}/rewards`))).docs.find(d=>d.data().tier==='small');
await K.call('redeem')({ itemId: smallId, rewardId: smallReward ? smallReward.id : null });
let item = (await getDoc(doc(P.db,`families/${fid}/inventory/${smallId}`))).data();
ok('kid redeem flips ready → redeemed', item.status === 'redeemed');
ok('redeem with a real rewardId records the reward name in the ledger',
   !smallReward || (await getDocs(collection(P.db,`families/${fid}/ledger`))).docs.some(d=>d.data().type==='redeem' && d.data().note===smallReward.data().name));
await P.call('markGiven')({ itemId: smallId });
item = (await getDoc(doc(P.db,`families/${fid}/inventory/${smallId}`))).data();
ok('parent markGiven flips redeemed → given', item.status === 'given');

// a PARENT can redeem on a kid's behalf (the "couldn't reach server" bug fix)
const medId = (await getDocs(collection(P.db,`families/${fid}/inventory`))).docs.find(d=>d.data().tier==='medium'&&d.data().status==='ready').id;
await P.call('redeem')({ itemId: medId, rewardId: null, memberId: 'k1' });
ok('parent can redeem on a kid\'s behalf', (await getDoc(doc(P.db,`families/${fid}/inventory/${medId}`))).data().status === 'redeemed');

// ---------- co-parent (grandparent) joins via the grown-up invite code ----------
const authDoc = (await getDoc(doc(P.db, `families/${fid}/private/auth`))).data();
ok('family has a grown-up invite code', /^[A-Z2-9]{6}$/.test(authDoc.parentCode || ''));
const G = makeClient('grandparent');
const gUser = (await createUserWithEmailAndPassword(G.auth, `g${Date.now()}@test.com`, 'pw123456')).user;
await throws('joinFamilyAsParent rejects a bad code', G.call('joinFamilyAsParent')({ code: 'ZZZZZZ', name: 'Nope' }));
const joined = await G.call('joinFamilyAsParent')({ code: authDoc.parentCode, name: 'Grandma' });
await gUser.getIdToken(true); // pick up the co-parent claim
ok('co-parent joined the same family', joined.familyId === fid);
ok('co-parent member created with their name',
   (await getDoc(doc(G.db, `families/${fid}/members/${joined.memberId}`))).data().name === 'Grandma');
ok('co-parent can read the family', (await getDoc(doc(G.db, `families/${fid}`))).exists());
const palmsBefore = (await kidDoc()).palms;
await G.call('givePom')({ memberId: 'k1', src: 'kindness', note: 'from grandma' });
ok('co-parent has full parent powers (can grant Poms)', (await kidDoc()).palms === palmsBefore + 1);

// ---------- expanded give-a-Pom categories ----------
const palmsB = (await kidDoc()).palms;
await P.call('givePom')({ memberId:'k1', src:'helping', note:'Helped a sibling' });
ok('givePom accepts a new category (helping) + credits', (await kidDoc()).palms === palmsB + 1);
ok('the helping Pom tagged a critter with its category + reason',
   (await getDocs(collection(P.db,`families/${fid}/critters`))).docs.some(d=>d.data().tag==='helping' && d.data().reason==='Helped a sibling'));
await throws('givePom rejects an unknown category', P.call('givePom')({ memberId:'k1', src:'banana', note:'x' }));

// ---------- weighted Poms (per-reason / per-chore value) ----------
const wB = (await kidDoc()).palms;
const w2 = await P.call('givePom')({ memberId:'k1', src:'effort', note:'Tried really hard', n:2 });
ok('givePom n=2 → palms +2 (+ at least 2 reveals)', (await kidDoc()).palms === wB+2 && w2.reveals.length >= 2);
await setDoc(doc(P.db, `families/${fid}/chores/c2`), { id:'c2', name:'Big clean', secs:60, palm:3 });
const wB2 = (await kidDoc()).palms;
const w3 = await P.call('completeChore')({ memberId:'k1', choreId:'c2' });
ok('chore worth 3 → palms +3 (+ at least 3 reveals)', (await kidDoc()).palms === wB2+3 && w3.reveals.length >= 3);

// ---------- bounded critter window (what cloud.js live-syncs) ----------
const recent = await getDocs(query(collection(P.db, `families/${fid}/critters`), orderBy('createdAt','desc'), limit(3)));
ok('recent-critters query works (orderBy createdAt desc + limit, no index needed)', recent.size === 3);
const ts = recent.docs.map(d => d.data().createdAt);
ok('recent critters return newest-first', ts[0] >= ts[1] && ts[1] >= ts[2]);
// "load older" pagination (cursor = oldest of the page, fetch the next, no overlap)
const cur = ts[ts.length - 1];
const older = await getDocs(query(collection(P.db, `families/${fid}/critters`), orderBy('createdAt','desc'), startAfter(cur), limit(3)));
const ids1 = new Set(recent.docs.map(d=>d.id));
ok('load-older pages strictly older critters with no overlap', older.docs.length > 0 && older.docs.every(d => d.data().createdAt <= cur && !ids1.has(d.id)));

// ---------- web push: token register/unregister callables succeed ----------
// (pushTokens is server-only — client reads are denied by rules, as they should be)
const reg = await P.call('registerPush')({ token: 'tok-smoke-123', tzOffsetMin: 0, hour: 16 });
ok('registerPush succeeds for a family parent', reg && reg.ok === true);
await throws('registerPush rejects an empty token', P.call('registerPush')({ token: '' }));
const unreg = await P.call('unregisterPush')({ token: 'tok-smoke-123' });
ok('unregisterPush succeeds', unreg && unreg.ok === true);
await throws('client CANNOT read the server-only pushTokens collection', getDoc(doc(P.db, `pushTokens/x`)));

// ---------- tester feedback ----------
ok('sendFeedback accepts a note', (await P.call('sendFeedback')({ text:'love the mix button!' })).ok === true);
await throws('sendFeedback rejects an empty note', P.call('sendFeedback')({ text:'' }));

// ---------- cheerleader (read-only) invite code ----------
const cheerAuth = (await getDoc(doc(P.db, `families/${fid}/private/auth`))).data();
ok('family seeds a cheer code', !!cheerAuth.cheerCode && cheerAuth.cheerCode.length >= 4);
const newCheer = await P.call('regenCheerCode')({});
ok('regenCheerCode returns a fresh code', newCheer && newCheer.cheerCode && newCheer.cheerCode !== cheerAuth.cheerCode);
ok('a kid already in a family is not re-joined as cheer', (await K.call('joinFamilyAsCheer')({ code: 'WHATEVER' })).existed === true);

// ---------- privacy-safe analytics + COPPA family deletion ----------
const famBefore = (await getDoc(doc(P.db, `families/${fid}`))).data();
ok('family has privacy-safe analytics counters (actions + lastActiveAt)', typeof famBefore.actions === 'number' && famBefore.actions > 0 && typeof famBefore.lastActiveAt === 'number');
ok('family records parental consent', !!famBefore.consent);
await P.call('deleteFamily')({});
ok('deleteFamily removes the family doc', !(await getDoc(doc(P.db, `families/${fid}`))).exists());
ok('deleteFamily wipes subcollections', (await getDocs(collection(P.db, `families/${fid}/critters`))).size === 0);

console.log(`\n${fail === 0 ? '🎉 ALL PASS' : '⚠️  FAILURES'} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
