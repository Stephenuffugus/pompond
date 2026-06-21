// Pom Pond — 60-day multi-family simulation + "focus group".
// Drives the REAL shared economy (src/economy.js, the same code the Cloud
// Functions run) and CritterEngine across several family personas, with a
// controlled clock so daily locks / streaks behave like real calendar days.
//   Usage: node scripts/sim-families.mjs
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const Economy = require('../src/economy.js');
const CritterEngine = require('../src/critter-engine.js');

// ---- controlled clock so each simulated day is a distinct calendar day ----
let CLOCK = Date.UTC(2026, 0, 1, 9, 0, 0);
const realNow = Date.now;
Date.now = () => CLOCK;

// ---- seeded RNG for reproducible "behavior" decisions ----
let _s = 123456789;
const rnd = () => { _s = (Math.imul(_s ^ (_s >>> 15), 2246822507) ^ Math.imul(_s ^ (_s >>> 13), 3266489909)) >>> 0; return _s / 4294967296; };
const chance = p => rnd() < p;
const pickN = (arr, n) => { const a = arr.slice(); const out = []; while (out.length < n && a.length) out.push(a.splice(Math.floor(rnd() * a.length), 1)[0]); return out; };

const CHORES = [
  { id:'c_room', name:'Tidy Room', secs:600, palm:1 },
  { id:'c_dish', name:'Dishes', secs:300, palm:1 },
  { id:'c_teeth', name:'Brush Teeth', secs:120, palm:1 },
  { id:'c_pet', name:'Feed Pet', secs:180, palm:1 },
  { id:'c_big', name:'Deep clean (big)', secs:1200, palm:3 }  // weighted chore
];
const GIVE = [ // (category, label) bonus reasons
  ['kindness','Shared without being asked'],['kindness','Was kind to someone'],
  ['helping','Helped without being asked'],['helping','Helped a sibling'],
  ['effort','Tried really hard'],['effort','Didn\'t give up'],
  ['respect','Used good manners'],['school','Great day at school'],
  ['family','Big helper today'],['custom','Practiced piano',2]
];

function makeFamily(p) {
  const members = [{ id:'p1', name:'Parent', role:'parent' }];
  for (let i = 0; i < p.kids; i++) members.push({ id:'k'+i, name:'Kid'+i, role:'child', buckets:{s:0,m:0,b:0}, palms:0, choices:0, streak:0, lastActive:null });
  return {
    name: p.name,
    settings: { smallCap:4, medCap:3, bigCap:2, approval:!!p.approval },
    members, chores: CHORES.slice(0, p.chores || 4),
    critters: [], inventory: [], log: [], pending: [], done: {},
    _p: p,
    _m: { chores:0, bonus:0, weightedPoms:0, fills:{small:0,medium:0,big:0}, choices:0, saves:0, keeps:0,
          redeemed:{small:0,medium:0,big:0}, combines:0, consumed:0, firstReward:{}, errors:[] }
  };
}
const kidsOf = f => f.members.filter(m => m.role === 'child');

function recordFills(f, beforeInv) {
  for (const tier of ['small','medium','big']) {
    const now = f.inventory.filter(i => i.tier === tier).length;
    const was = beforeInv[tier] || 0;
    if (now > was) { f._m.fills[tier] += (now - was); if (!f._m.firstReward[tier]) f._m.firstReward[tier] = f._day; }
  }
}
const invCount = f => ({ small:f.inventory.filter(i=>i.tier==='small').length, medium:f.inventory.filter(i=>i.tier==='medium').length, big:f.inventory.filter(i=>i.tier==='big').length });

function simulate(f, days) {
  for (let d = 0; d < days; d++) {
    CLOCK = Date.UTC(2026, 0, 1, 9, 0, 0) + d * 86400000;
    f._day = d + 1;
    for (const kid of kidsOf(f)) {
      try {
        // 1) chores (respect daily lock; persona completion rate)
        for (const chore of f.chores) {
          if (!chance(f._p.chore)) continue;
          const before = invCount(f);
          const r = Economy.completeChore(f, kid, chore, [], { byUid:'p1' });
          if (r.status === 'earned') { f._m.chores++; f._m.weightedPoms += (chore.palm||1); }
          recordFills(f, before);
        }
        // 2) parent approves pending (approval-mode families)
        if (f.settings.approval && f.pending.length) {
          for (const p of f.pending.slice()) {
            if (!chance(f._p.approve)) continue;
            const k = f.members.find(m => m.id === p.ownerId); const ch = f.chores.find(c => c.id === p.choreId);
            const before = invCount(f);
            Economy.earnTimes(f, k, { type:'chore', note: ch?ch.name:'' }, [], ch?ch.palm:1);
            f._m.chores++; f._m.weightedPoms += (ch?ch.palm:1);   // approved chores count too
            f.pending = f.pending.filter(x => x.id !== p.id);
            recordFills(f, before);
          }
        }
        // 3) bonus Poms (freely given)
        let gives = 0; while (chance(f._p.bonus) && gives < 3) {
          const g = GIVE[Math.floor(rnd() * GIVE.length)]; const n = g[2] || 1;
          const before = invCount(f);
          Economy.earnTimes(f, kid, { type:g[0], special:true, note:g[1], byUid:'p1' }, [], n);
          f._m.bonus++; f._m.weightedPoms += n; gives++;
          recordFills(f, before);
        }
        // 4) resolve any queued save-vs-keep choice
        while ((kid.choices||0) > 0) {
          const before = invCount(f);
          const save = chance(f._p.save);
          Economy.resolveChoice(f, kid, save, []);
          f._m.choices++; save ? f._m.saves++ : f._m.keeps++;
          recordFills(f, before);
        }
        // 5) redeem ready reward tokens (parent then delivers)
        for (const it of f.inventory) {
          if (it.status === 'ready' && chance(f._p.redeem)) { it.status = 'given'; f._m.redeemed[it.tier]++; }
        }
        // 6) combining (fusion) — persona-driven
        if (f._p.combine && chance(f._p.combine)) {
          const mine = f.critters.filter(c => c.ownerId === kid.id);
          if (mine.length >= 3) {
            const ids = pickN(mine, chance(0.4) ? 3 : 2).map(c => c.id);
            const r = Economy.combine(f, kid, ids, [], { byUid:'p1' });
            if (r.child) { f._m.combines++; f._m.consumed += ids.length; }
          }
        }
      } catch (e) { f._m.errors.push(String(e && e.message || e)); }
    }
  }
  return f;
}

// ---- personas ----
const PERSONAS = [
  { name:'The Diligent Harpers', kids:2, chores:5, chore:0.85, bonus:0.5, save:0.7, redeem:0.8, combine:0.25, approve:1 },
  { name:'The Busy Riveras',     kids:3, chores:4, chore:0.40, bonus:0.2, save:0.4, redeem:0.5, combine:0.05, approve:1 },
  { name:'The Okafor Six (approval on)', kids:4, chores:4, chore:0.60, bonus:0.3, save:0.5, redeem:0.6, combine:0.15, approve:0.8, approval:true },
  { name:'The Gentle Lows',      kids:1, chores:4, chore:0.30, bonus:0.7, save:0.15, redeem:0.2, combine:0.1, approve:1 },
  { name:'The Competitive Twins',kids:2, chores:5, chore:0.80, bonus:0.4, save:0.85, redeem:0.7, combine:0.6, approve:1 }
];

const DAYS = 60;
const fams = PERSONAS.map(p => simulate(makeFamily(p), DAYS));

// ---- report ----
const pct = (a,b) => b ? Math.round(a/b*100) : 0;
console.log(`\n================  POM POND — ${DAYS}-DAY SIMULATION (${fams.length} families)  ================`);
let totHeld=0, totLife=0, totErr=0, totRedeemBacklog=0, anyBig=0;
for (const f of fams) {
  const m = f._m, kn = kidsOf(f).length;
  const held = f.critters.length;
  const life = held + m.consumed;
  const species = new Set(f.critters.map(c=>c.archetype)).size;
  const legend = f.critters.filter(c=>c.rarity===3).length;
  const tokens = f.inventory.length;
  const readyBacklog = f.inventory.filter(i=>i.status==='ready').length;
  const palms = kidsOf(f).reduce((s,k)=>s+(k.palms||0),0);
  totHeld+=held; totLife+=life; totErr+=m.errors.length; totRedeemBacklog+=readyBacklog; if(m.fills.big) anyBig++;
  console.log(`\n● ${f.name}  (${kn} kid${kn>1?'s':''}${f.settings.approval?', approval ON':''})`);
  console.log(`   Poms earned: ${palms}  (chores ${m.chores}, bonus ${m.bonus}, weighted total ${m.weightedPoms})  ·  ~${(palms/kn/DAYS).toFixed(1)}/kid/day`);
  console.log(`   Rewards unlocked: small ${m.fills.small} · medium ${m.fills.medium} · big ${m.fills.big}   |  redeemed s${m.redeemed.small}/m${m.redeemed.medium}/b${m.redeemed.big}  ·  unredeemed backlog ${readyBacklog}`);
  console.log(`   First reward day → small d${m.firstReward.small||'—'}, medium d${m.firstReward.medium||'—'}, big d${m.firstReward.big||'—'}`);
  console.log(`   Choices: ${m.choices} (save ${m.saves} / keep ${m.keeps})`);
  console.log(`   Critters: held ${held} (≈Firestore docs) · lifetime ${life} · combines ${m.combines} (consumed ${m.consumed}) → ${pct(life-held,life)}% fewer docs via fusion`);
  console.log(`   Collection: ${species}/${CritterEngine.list.length} species · ${legend} legendary`);
  if (m.errors.length) console.log(`   ⚠ ERRORS (${m.errors.length}): ${[...new Set(m.errors)].slice(0,3).join(' | ')}`);
}
console.log(`\n----------------  AGGREGATE  ----------------`);
console.log(`Total critters HELD across all families: ${totHeld}  (lifetime ${totLife}; fusion removed ${totLife-totHeld}, ${pct(totLife-totHeld,totLife)}%)`);
console.log(`Avg critters held per kid @ ${DAYS}d: ${(totHeld/fams.reduce((s,f)=>s+kidsOf(f).length,0)).toFixed(0)}`);
console.log(`Families that reached a BIG reward: ${anyBig}/${fams.length}`);
console.log(`Total unredeemed reward backlog: ${totRedeemBacklog}`);
console.log(`Total errors / invalid states: ${totErr}`);
// invariant checks
let bad = 0;
for (const f of fams) for (const k of kidsOf(f)) {
  if (k.palms<0 || k.buckets.s<0 || k.buckets.m<0 || k.buckets.b<0 || k.choices<0) { bad++; console.log(`   ✗ negative state in ${f.name}/${k.id}`, k.buckets, k.palms, k.choices); }
  if (!Number.isFinite(k.palms)) { bad++; console.log(`   ✗ non-finite palms in ${f.name}/${k.id}`); }
}
console.log(`Economy invariant violations (negative/NaN): ${bad}`);
Date.now = realNow;
process.exit(totErr + bad === 0 ? 0 : 1);
