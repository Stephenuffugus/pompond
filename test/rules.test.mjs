// Pom Pond — Firestore security rules tests (emulator).
// PROVES the integrity guarantees: a child can read its family but cannot
// self-credit (palms/critters/inventory/done), cannot flip a reward to "given",
// cannot read a sibling's secret code or another family; parents write CONFIG
// only and never economy. Run via:  npm run test:rules
//   (firebase emulators:exec --only firestore "node test/rules.test.mjs")
import fs from 'fs';
import {
  initializeTestEnvironment, assertSucceeds, assertFails
} from '@firebase/rules-unit-testing';
import {
  doc, getDoc, setDoc, updateDoc, collection, getDocs
} from 'firebase/firestore';

const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8080').split(':');
let pass = 0, fail = 0;
async function check(name, p) {
  try { await p; console.log(`✅ ${name}`); pass++; }
  catch (e) { console.log(`❌ ${name}\n   ${e.message}`); fail++; }
}

const env = await initializeTestEnvironment({
  projectId: 'pom-pond-rules-test',
  firestore: { rules: fs.readFileSync('firestore.rules', 'utf8'), host, port: Number(port) }
});

// principals
const parent  = env.authenticatedContext('p_uid',  { familyId: 'fam1', role: 'parent' }).firestore();
const child   = env.authenticatedContext('k_uid',  { familyId: 'fam1', role: 'child', memberId: 'k1' }).firestore();
const other   = env.authenticatedContext('o_uid',  { familyId: 'fam2', role: 'parent' }).firestore();
const anon    = env.unauthenticatedContext().firestore();

// seed with rules disabled
await env.withSecurityRulesDisabled(async (ctx) => {
  const d = ctx.firestore();
  await setDoc(doc(d, 'families/fam1'), { name: 'Test', setup: true, parentUids: ['p_uid'], settings: { smallCap: 4 } });
  await setDoc(doc(d, 'families/fam1/members/k1'), { name: 'Maya', role: 'child', palms: 0, buckets: { s:0,m:0,b:0 }, choices: 0, streak: 0 });
  await setDoc(doc(d, 'families/fam1/chores/c1'), { name: 'Dishes', secs: 60, palm: 1 });
  await setDoc(doc(d, 'families/fam1/rewards/r1'), { name: 'Movie', tier: 'big' });
  await setDoc(doc(d, 'families/fam1/critters/cr1'), { ownerId: 'k1', rarity: 0 });
  await setDoc(doc(d, 'families/fam1/inventory/i1'), { ownerId: 'k1', tier: 'small', status: 'ready' });
  await setDoc(doc(d, 'families/fam1/inventory/i2'), { ownerId: 'k1', tier: 'small', status: 'redeemed' });
  await setDoc(doc(d, 'families/fam1/done/k1|c1|2020-01-01'), { ownerId: 'k1' });
  await setDoc(doc(d, 'families/fam1/private/auth'), { joinCode: 'ABC123', kidCodes: { k1: '1234' } });
  await setDoc(doc(d, 'families/fam2/members/x1'), { name: 'Other', role: 'child' });
});

// ---- reads ----
await check('child CAN read its own family', assertSucceeds(getDoc(doc(child, 'families/fam1'))));
await check('child CAN read its own members', assertSucceeds(getDoc(doc(child, 'families/fam1/members/k1'))));
await check('child CAN read its own critters', assertSucceeds(getDocs(collection(child, 'families/fam1/critters'))));
await check('child CANNOT read another family', assertFails(getDoc(doc(child, 'families/fam2/members/x1'))));
await check('child CANNOT read the private kid-code doc', assertFails(getDoc(doc(child, 'families/fam1/private/auth'))));
await check('unauth CANNOT read any family', assertFails(getDoc(doc(anon, 'families/fam1'))));
await check('parent of fam2 CANNOT read fam1', assertFails(getDoc(doc(other, 'families/fam1'))));

// ---- the core integrity property: a kid cannot self-credit ----
await check('child CANNOT increment its own palms', assertFails(updateDoc(doc(child, 'families/fam1/members/k1'), { palms: 999 })));
await check('child CANNOT change its own buckets', assertFails(updateDoc(doc(child, 'families/fam1/members/k1'), { buckets: { s:3,m:9,b:9 } })));
await check('child CANNOT change its own streak', assertFails(updateDoc(doc(child, 'families/fam1/members/k1'), { streak: 100 })));
await check('child CANNOT mint a critter', assertFails(setDoc(doc(child, 'families/fam1/critters/hax'), { ownerId: 'k1', rarity: 3 })));
await check('child CANNOT grant itself a reward token', assertFails(setDoc(doc(child, 'families/fam1/inventory/hax'), { ownerId: 'k1', tier: 'big', status: 'ready' })));
await check('child CANNOT flip a token to "given"', assertFails(updateDoc(doc(child, 'families/fam1/inventory/i2'), { status: 'given' })));
await check('child CANNOT write a done marker (daily-lock is server-enforced)', assertFails(setDoc(doc(child, 'families/fam1/done/k1|c1|2099-01-01'), { ownerId: 'k1' })));
await check('child CANNOT write a ledger entry', assertFails(setDoc(doc(child, 'families/fam1/ledger/hax'), { ownerId: 'k1', type: 'chore' })));
await check('child CANNOT add/edit chores', assertFails(setDoc(doc(child, 'families/fam1/chores/hax'), { name: 'Fake', palm: 99 })));
await check('child CANNOT edit rewards', assertFails(updateDoc(doc(child, 'families/fam1/rewards/r1'), { tier: 'small' })));

// ---- parents: config yes, economy no ----
await check('parent CAN edit chores', assertSucceeds(setDoc(doc(parent, 'families/fam1/chores/c2'), { name: 'Trash', secs: 30, palm: 1 })));
await check('parent CAN edit rewards', assertSucceeds(setDoc(doc(parent, 'families/fam1/rewards/r2'), { name: 'Ice cream', tier: 'small' })));
await check('parent CAN edit family settings', assertSucceeds(updateDoc(doc(parent, 'families/fam1'), { settings: { smallCap: 5 } })));
await check('parent CAN edit a member profile (name)', assertSucceeds(updateDoc(doc(parent, 'families/fam1/members/k1'), { name: 'Maya R.' })));
await check('parent CAN read the private kid-code doc', assertSucceeds(getDoc(doc(parent, 'families/fam1/private/auth'))));
await check('parent CANNOT write member economy (palms) from client', assertFails(updateDoc(doc(parent, 'families/fam1/members/k1'), { palms: 50 })));
await check('parent CANNOT mint critters from client', assertFails(setDoc(doc(parent, 'families/fam1/critters/hax2'), { ownerId: 'k1', rarity: 3 })));
await check('parent CANNOT write inventory from client', assertFails(setDoc(doc(parent, 'families/fam1/inventory/hax2'), { ownerId: 'k1', tier: 'big', status: 'ready' })));
await check('parent CANNOT touch the parent roster', assertFails(updateDoc(doc(parent, 'families/fam1'), { parentUids: ['p_uid','evil'] })));

await env.cleanup();
console.log(`\n${fail === 0 ? '🎉 ALL PASS' : '⚠️  FAILURES'} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
