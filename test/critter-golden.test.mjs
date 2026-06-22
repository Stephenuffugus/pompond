// Pom Pond — CritterEngine golden-snapshot test.
// Locks the deterministic render() output for the current species × rarity matrix.
// A critter is stored only as {seed, archetype, rarity} and re-rendered forever,
// so this guards the #1 invariant: existing critters must NEVER change.
//   - First run (no baseline): records test/critter-golden.json and passes.
//   - Later runs: every committed key's render hash must still match.
//   - Adding NEW species is fine (new keys are reported, not failed).
//   Usage: node test/critter-golden.test.mjs
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const CritterEngine = require('../src/critter-engine.js');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GOLD = path.join(__dirname, 'critter-golden.json');

function h(str){ let x=2166136261; for(let i=0;i<str.length;i++){ x^=str.charCodeAt(i); x=Math.imul(x,16777619); } return (x>>>0).toString(36); }

// Fixed matrix: every species × every rarity, with a stable seed per cell.
const cur = {};
for (const arch of CritterEngine.list) for (let r=0; r<=3; r++) {
  const seed = 'gold:'+arch+':'+r;
  cur[arch+'@'+r] = h(CritterEngine.render(seed, arch, r));
}
// Lock the TIER prestige overlay too (one cell per prestige stage, a few species),
// so escalating-tier visuals can't silently regress. tier 0 is already covered above.
for (const arch of ['fox','frog','dragon','owl']) for (const tier of [2,5,8,12,17,22,28,34,40]) {
  cur[arch+'@3#t'+tier] = h(CritterEngine.render('gold:'+arch+':3', arch, 3, { tier }));
}

if (!fs.existsSync(GOLD)) {
  fs.writeFileSync(GOLD, JSON.stringify(cur, null, 0));
  console.log(`📸 recorded golden baseline — ${Object.keys(cur).length} render hashes → test/critter-golden.json`);
  console.log('🎉 ALL PASS — baseline recorded');
  process.exit(0);
}

const gold = JSON.parse(fs.readFileSync(GOLD, 'utf8'));
let pass=0, fail=0, added=0;
for (const k of Object.keys(gold)) {
  const ok = cur[k] === gold[k];
  if (ok) pass++; else { fail++; console.log(`❌ render CHANGED for ${k}  (was ${gold[k]}, now ${cur[k]||'MISSING'})`); }
}
for (const k of Object.keys(cur)) if (!(k in gold)) added++;
console.log(`✅ ${pass} existing critter renders unchanged${added?`  ·  +${added} new species/rarity cells (ok)`:''}`);
console.log(`\n${fail===0 ? '🎉 ALL PASS' : '⚠️  DETERMINISM BROKEN'} — ${pass} stable, ${fail} changed`);
process.exit(fail===0 ? 0 : 1);
