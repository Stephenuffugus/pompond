// Pom Pond — shared economy unit test (Node).
// Proves src/economy.js (the SAME module the Cloud Functions run) reproduces the
// prototype's hybrid ladder exactly: earn -> small -> medium -> choice -> big,
// fusion critters, reward tokens, streak, and the once-per-day chore lock.
//   Usage: node test/economy.test.mjs
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const Economy = require('../src/economy.js');           // also loads critter-engine

let pass = 0, fail = 0;
const ok = (n, c) => { (c ? pass++ : fail++); console.log(`${c ? '✅' : '❌'} ${n}`); };

function freshFam(over = {}) {
  return {
    settings: Object.assign({ smallCap:4, medCap:3, bigCap:2, approval:false }, over),
    members: [{ id:'k1', name:'Maya', role:'child', buckets:{s:0,m:0,b:0}, choices:0, streak:0, lastActive:null, palms:0 }],
    chores: [{ id:'c1', name:'Dishes', secs:60, palm:1 }],
    critters: [], inventory: [], log: [], pending: [], done: {}
  };
}
const kid = f => f.members[0];

// --- 4 chore earns = one full small bucket ---
let f = freshFam();
const reveals = [];
for (let i = 0; i < 4; i++) Economy.earn(f, kid(f), { type:'chore' }, reveals);
ok('4 earns → palms 4', kid(f).palms === 4);
ok('small rolled into medium (s:0,m:1)', kid(f).buckets.s === 0 && kid(f).buckets.m === 1);
ok('5 critters minted incl. fusion', f.critters.length === 5);
ok('two rarities present (0 & 1)', new Set(f.critters.map(c=>c.rarity)).size === 2 && f.critters.some(c=>c.rarity===1));
ok('one small reward token ready', f.inventory.filter(i=>i.tier==='small'&&i.status==='ready').length === 1);
ok('streak started at 1', kid(f).streak === 1);

// --- drive to a medium fill (3 small fills) → queues a choice + tier-2 critter ---
f = freshFam();
for (let i = 0; i < 12; i++) Economy.earn(f, kid(f), { type:'kindness', special:true }, []);
ok('medium fill queues a choice', (kid(f).choices||0) === 1);
ok('medium reward token granted', f.inventory.filter(i=>i.tier==='medium').length === 1);
ok('tier-2 critter exists', f.critters.some(c=>c.rarity===2));
ok('special/kindness critters tagged', f.critters.some(c=>c.special && c.rarity>=1));

// --- resolve choice: SAVE advances big bucket ---
Economy.resolveChoice(f, kid(f), true, []);
ok('save → big bucket +1, choice cleared', kid(f).buckets.b === 1 && kid(f).choices === 0);

// --- KEEP does not advance big ---
let g = freshFam();
for (let i = 0; i < 12; i++) Economy.earn(g, kid(g), { type:'chore' }, []);
Economy.resolveChoice(g, kid(g), false, []);
ok('keep → big bucket unchanged', kid(g).buckets.b === 0 && kid(g).choices === 0);

// --- big bucket fill mints a tier-3 showpiece + big token ---
let h = freshFam();
// 2 medium fills, both saved, = big cap 2
for (let i = 0; i < 12; i++) Economy.earn(h, kid(h), { type:'chore' }, []);
Economy.resolveChoice(h, kid(h), true, []);
for (let i = 0; i < 12; i++) Economy.earn(h, kid(h), { type:'chore' }, []);
Economy.resolveChoice(h, kid(h), true, []);
ok('big fill grants a big token', h.inventory.filter(i=>i.tier==='big').length === 1);
ok('big fill mints a tier-3 showpiece', h.critters.some(c=>c.rarity===3));

// --- once-per-day chore lock ---
let d = freshFam();
const r1 = Economy.completeChore(d, kid(d), d.chores[0], []);
const r2 = Economy.completeChore(d, kid(d), d.chores[0], []);
ok('first completion earns', r1.status === 'earned' && kid(d).palms === 1);
ok('second same-day completion is locked', r2.status === 'already' && kid(d).palms === 1);

// --- approval mode defers (no immediate credit) ---
let ap = freshFam({ approval:true });
const ra = Economy.completeChore(ap, kid(ap), ap.chores[0], []);
ok('approval mode → pending, no palm yet', ra.status === 'pending' && kid(ap).palms === 0 && ap.pending.length === 1);

// --- combining (fusion) ---
let cf = freshFam();
cf.critters = [
  { id:'a', ownerId:'k1', seed:'s-a', archetype:'frog', rarity:0 },
  { id:'b', ownerId:'k1', seed:'s-b', archetype:'duck', rarity:1 },
  { id:'c', ownerId:'k1', seed:'s-c', archetype:'koi',  rarity:0 },
  { id:'x', ownerId:'k2', seed:'s-x', archetype:'cat',  rarity:0 }   // another kid's
];
const cr = [];
const cres = Economy.combine(cf, kid(cf), ['a','b'], cr);
ok('combine consumes parents, mints 1 child (3→2 critters)', cf.critters.length === 3 && !cf.critters.find(c=>c.id==='a') && !cf.critters.find(c=>c.id==='b'));
ok('child is special combo with a "Combined from" reason', cres.child.tag==='combo' && cres.child.special===true && /Combined from/.test(cres.child.reason));
ok('2-fuse rarity = max+1 (1→2)', cres.child.rarity === 2);
ok('combine logs a ledger event', cf.log.some(e=>e.type==='combine'));
ok('child appears in reveals', cr.length===1 && cr[0].id===cres.child.id);
// determinism: same parent seeds → same child seed/archetype
const m1 = Economy.makeCombo([{seed:'s-a',archetype:'frog',rarity:0},{seed:'s-b',archetype:'duck',rarity:1}]);
const m2 = Economy.makeCombo([{seed:'s-b',archetype:'duck',rarity:1},{seed:'s-a',archetype:'frog',rarity:0}]);
ok('combine is deterministic + order-independent', m1.seed===m2.seed && m1.archetype===m2.archetype);
// 3-fuse jumps rarity further (max+2), capped at 3
const m3 = Economy.makeCombo([{seed:'1',archetype:'frog',rarity:1},{seed:'2',archetype:'duck',rarity:0},{seed:'3',archetype:'koi',rarity:0}]);
ok('3-fuse rarity = max+2 (1→3)', m3.rarity === 3);
// evolution tier climbs: 2-fuse = best+1, 3-fuse = best+2
ok('hatched critters start at tier 0', addCritterTier() === 0);
ok('2-fuse of tier-0 → tier 1', cres.child.tier === 1);
ok('3-fuse of tier-0 → tier 2', m3.tier === 2);
ok('combining higher tiers climbs (t2 + t2 → t3)', Economy.makeCombo([{seed:'x',archetype:'frog',rarity:0,tier:2},{seed:'y',archetype:'koi',rarity:0,tier:2}]).tier === 3);
function addCritterTier(){ const f=freshFam(); const rv=[]; Economy.earn(f, kid(f), {type:'chore'}, rv); return f.critters[0].tier; }
// can't fuse another kid's critter / need 2+
let cf2 = freshFam(); cf2.critters = cf.critters.slice();
ok('rejects fusing a non-owned critter', !!Economy.combine(cf2, kid(cf2), ['c','x'], []).reject);
ok('rejects fewer than 2', !!Economy.combine(cf2, kid(cf2), ['c'], []).reject);

// --- weighted Poms (per-chore / per-reason value) ---
let wf = freshFam(); wf.chores = [{ id:'c1', name:'Big clean', secs:60, palm:3 }];
const wrev = [];
const wres = Economy.completeChore(wf, kid(wf), wf.chores[0], wrev);
ok('chore worth 3 → 3 palms + earned', wres.status==='earned' && kid(wf).palms===3);
ok('chore worth 3 → mints 3 critters (1 Pom = 1 critter held)', wrev.length===3);
let ef = freshFam(); Economy.earnTimes(ef, kid(ef), { type:'kindness', special:true }, [], 99);
ok('earnTimes clamps runaway values (99 → 9)', kid(ef).palms===9);
let e1 = freshFam(); Economy.earnTimes(e1, kid(e1), { type:'chore' }, [], 0);
ok('earnTimes floors to 1 (0 → 1)', kid(e1).palms===1);

console.log(`\n${fail === 0 ? '🎉 ALL PASS' : '⚠️  FAILURES'} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
