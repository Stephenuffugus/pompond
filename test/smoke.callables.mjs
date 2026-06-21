// Pom Pond — end-to-end callable smoke test (against the emulator suite).
// Drives the REAL Cloud Functions through the client SDK exactly as the app does:
// parent signs up -> createFamily -> add kid/chore -> completeChore -> daily lock
// -> drive the ladder via givePom -> kid binds device -> resolveChoice -> redeem
// -> parent markGiven. Proves the server-authoritative economy works as a whole.
//   Run:  npm run smoke   (firebase emulators:exec auth,firestore,functions ...)
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signInAnonymously } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, doc, setDoc, getDoc, getDocs, collection } from 'firebase/firestore';
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

await K.call('resolveChoice')({ saveUp:true });
k = await kidDoc();
ok('kid SAVE advanced the big bucket + cleared the choice', k.buckets.b === 1 && (k.choices||0) === 0);

await throws('a kid CANNOT grant itself a reward token', setDoc(doc(K.db,`families/${fid}/inventory/hax`), { ownerId:'k1', tier:'big', status:'ready' }));

// ---------- kid fuses two of their OWN critters (server-authoritative sink) ----------
const critDocs = (await getDocs(collection(P.db,`families/${fid}/critters`))).docs;
const myCrit = critDocs.filter(d=>d.data().ownerId==='k1').slice(0,2).map(d=>d.id);
const beforeN = critDocs.length;
const fz = await K.call('combineCritters')({ critterIds: myCrit });
ok('combineCritters returns the fused child as a reveal', Array.isArray(fz.reveals) && fz.reveals.length===1 && fz.reveals[0].tag==='combo');
const afterDocs = (await getDocs(collection(P.db,`families/${fid}/critters`))).docs;
ok('fusion is a Firestore sink (2 consumed, 1 created → net -1)', afterDocs.length === beforeN-1);
ok('parents gone + combo child persisted', !afterDocs.find(d=>d.id===myCrit[0]) && !afterDocs.find(d=>d.id===myCrit[1]) && afterDocs.some(d=>d.data().tag==='combo'));
await throws('combine rejects fewer than 2 critters', K.call('combineCritters')({ critterIds:[myCrit[0]] }));
await throws('combine rejects critters that are not the kid\'s', K.call('combineCritters')({ critterIds:['nope1','nope2'] }));

// ---------- redeem (kid) → deliver (parent) ----------
const smallReady = inv.find(i => i.tier==='small' && i.status==='ready');
const smallId = (await getDocs(collection(P.db,`families/${fid}/inventory`))).docs.find(d=>d.data().tier==='small'&&d.data().status==='ready').id;
await K.call('redeem')({ itemId: smallId, rewardId: null });
let item = (await getDoc(doc(P.db,`families/${fid}/inventory/${smallId}`))).data();
ok('kid redeem flips ready → redeemed', item.status === 'redeemed');
await P.call('markGiven')({ itemId: smallId });
item = (await getDoc(doc(P.db,`families/${fid}/inventory/${smallId}`))).data();
ok('parent markGiven flips redeemed → given', item.status === 'given');

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

console.log(`\n${fail === 0 ? '🎉 ALL PASS' : '⚠️  FAILURES'} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
