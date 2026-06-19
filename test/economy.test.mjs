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

console.log(`\n${fail === 0 ? '🎉 ALL PASS' : '⚠️  FAILURES'} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
