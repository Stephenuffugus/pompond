// Pom Pond regression harness.  Usage:  node pom-pond.test.mjs ./index.html
// Requires: npm i jsdom
import {JSDOM} from 'jsdom';
import fs from 'fs';

const FILE = process.argv[2] || './pom-pond.html';
const html = fs.readFileSync(FILE, 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond) => { (cond ? pass++ : fail++); console.log(`${cond ? '✅' : '❌'} ${name}`); };

function fresh() {
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/' });
  return dom;
}
const wait = ms => new Promise(r => setTimeout(r, ms));

async function run() {
  const dom = fresh();
  const { window } = dom, { document } = window;
  const errs = []; window.addEventListener('error', e => errs.push(String(e.error || e.message)));
  const click = el => el.dispatchEvent(new window.Event('click', { bubbles: true }));
  const state = () => JSON.parse(window.localStorage.getItem('pomPondV1'));
  const card = re => [...document.querySelectorAll('.lobby-card')].find(c => re.test(c.textContent));
  await wait(60);

  // --- wizard ---
  ok('boots into setup wizard', !!document.querySelector('.setup-hero'));
  ok('GO disabled with no kids', document.querySelector('#sgo').disabled === true);
  document.querySelector('#sfn').value = 'Test Family';
  document.querySelector('#spn').value = '4321';
  click(document.querySelector('#saddkid')); await wait(20);
  document.querySelector('#scrim #kn').value = 'Maya';
  click(document.querySelector('#scrim .save')); await wait(30);
  ok('family name kept after add-kid', document.querySelector('#sfn').value === 'Test Family');
  ok('GO blocked until parent consent', (click(document.querySelector('#sgo')), !(state()&&state().setup)));   // consent unticked → no setup
  document.querySelector('#sconsent').checked = true;   // parent consents (COPPA)
  click(document.querySelector('#sgo')); await wait(40);
  let s = state();
  ok('setup completes + saves under pomPondV1', s && s.setup === true && s.name === 'Test Family' && s.settings.parentPin === '4321');
  ok('parental consent recorded', s && s.consent && s.consent.v === 1);

  // --- kid loop + daily lock ---
  click(card(/Maya/)); await wait(30);
  for (let n = 0; n < 4; n++) {
    const av = [...document.querySelectorAll('#cl .chore')].filter(c => !c.classList.contains('done'));
    if (!av.length) break;
    click(av[0]); await wait(15); click(document.querySelector('#td')); await wait(40);
  }
  await wait(250);
  s = state(); let maya = s.members.find(m => m.name === 'Maya');
  ok('4 chores → 4 Poms', maya.palms === 4);
  ok('small bucket rolled into medium (s:0,m:1)', maya.buckets.s === 0 && maya.buckets.m === 1);
  ok('critters minted incl. fusion (5, rarities 0&1)', s.critters.length === 5 && new Set(s.critters.map(c => c.rarity)).size === 2);
  ok('small reward token ready', s.inventory.filter(i => i.tier === 'small' && i.status === 'ready').length === 1);
  ok('streak started', maya.streak === 1);
  ok('all chores locked for today', [...document.querySelectorAll('#cl .chore')].filter(c => !c.classList.contains('done')).length === 0);

  // --- collection book ---
  click(document.querySelector('#dex')); await wait(20);
  ok('collection book opens with progress', /Collection/.test(document.querySelector('#sheet h3').textContent) && /\d+\/\d+/.test(document.querySelector('#sheet h3').textContent));
  click(document.querySelector('#scrim .cancel')); await wait(15);

  // --- parent: PIN, kindness + school Poms, medium choice ---
  click(document.querySelector('#leave')); await wait(20);
  click(card(/Parent/)); await wait(15);
  document.querySelector('#pin').value = '4321'; click(document.querySelector('#scrim .save')); await wait(25);
  ok('parent PIN gate works', !!document.querySelector('#kidRows'));

  // drive a medium fill via Pom awards (not daily-limited): 8 more → 3 small fills total → 1 medium fill
  const giveRow = () => [...document.querySelectorAll('#kidRows .row')].find(r => /Maya/.test(r.textContent));
  for (let i = 0; i < 8; i++) {
    click(giveRow().querySelector('.mini:not(.ghost)')); await wait(8);
    click(document.querySelector('.givechip[data-cat="school"]')); await wait(10); // tap a School reason → instant give
  }
  await wait(50);
  s = state(); maya = s.members.find(m => m.name === 'Maya');
  ok('school Pom logged + tagged', s.log.some(e => e.type === 'school') && s.critters.some(c => c.tag === 'school'));
  ok('medium fill queued a choice', (maya.choices || 0) >= 1);

  // resolve choice on kid screen
  click(document.querySelector('#leave')); await wait(15);
  click(card(/Maya/)); await wait(450);
  const choiceOpen = !!document.querySelector('#scrim .choice');
  ok('choice modal appears on kid view', choiceOpen);
  if (choiceOpen) { click(document.querySelector('#scrim .choice .opt[data-c="save"]')); await wait(300); }
  s = state(); maya = s.members.find(m => m.name === 'Maya');
  ok('saving advances big bucket + clears choice', maya.buckets.b === 1 && (maya.choices || 0) === 0);

  // --- currency rename ---
  click(document.querySelector('#leave')); await wait(15);
  click(card(/Parent/)); await wait(10);
  document.querySelector('#pin').value = '4321'; click(document.querySelector('#scrim .save')); await wait(20);
  click(document.querySelector('#settings')); await wait(15);
  document.querySelector('#cy').value = 'Gem';
  click(document.querySelector('#scrim .save')); await wait(25);
  click([...document.querySelectorAll('#kidRows .row')][0].querySelector('.mini:not(.ghost)')); await wait(15);
  ok('currency rename propagates', /Gem/.test(document.querySelector('#sheet h3').textContent));
  click(document.querySelector('#scrim .cancel')); await wait(10);

  // --- backup / reset / restore (compare against the live snapshot) ---
  click(document.querySelector('#settings')); await wait(15);
  click(document.querySelector('#bkup')); await wait(15);
  const code = document.querySelector('#bktx').value;
  const before = state();
  const bPalms = before.members.find(m => m.name === 'Maya').palms;
  const bCrit = before.critters.length;
  ok('backup code produced', code.length > 100);
  click(document.querySelector('#reset')); await wait(15); click(document.querySelector('#reset')); await wait(25);
  ok('reset clears progress', state().critters.length === 0 && state().members.find(m => m.name === 'Maya').palms === 0);
  click(document.querySelector('#settings')); await wait(15);
  document.querySelector('#bktx').value = code;
  click(document.querySelector('#rstr')); await wait(25);
  s = state();
  ok('restore rebuilds family', s.members.find(m => m.name === 'Maya').palms === bPalms && s.critters.length === bCrit && bPalms > 0 && bCrit > 0);

  ok('no uncaught JS errors', errs.length === 0);
  if (errs.length) console.log('  errors:', errs.slice(0, 3));

  console.log(`\n${fail === 0 ? '🎉 ALL PASS' : '⚠️  FAILURES'} — ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}
run().catch(e => { console.error('harness crashed:', e); process.exit(1); });
