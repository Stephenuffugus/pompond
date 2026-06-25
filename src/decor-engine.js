/* ============================================================
   DECOR ENGINE — predetermined cosmetic pond decorations (note 3b).
   Pure vector SVG (no images, no Firestore, no per-item generation). WHICH
   decorations a kid has is DERIVED LIVE from their stats (total Poms ever
   earned, streak, best critter tier) — so nothing new is stored anywhere.
   Each item has a FIXED slot so the scene always composes. Decorations sit
   BEHIND the critters. Add a decoration = add one row to DECOR + one render
   case. Milestones are append-only; existing ones never change.

   Browser-only (cosmetic) — NOT synced to Cloud Functions.
   ============================================================ */
(function (root, factory) {
  const mod = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
  root.DecorEngine = mod;
})(typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : this), function () {

  // need(s): unlocked when true. s = {palms, streak, maxTier, critters}.
  // x,y = slot center in pond % (art is anchored bottom-center on that point).
  // w = on-screen width in px. hint = plain-language unlock requirement.
  const DECOR = [
    { id:'lily',       name:'Lily Patch',  emoji:'🪷', x:24, y:80, w:66,  need:s=>s.palms>=3,    hint:'Earn 3 Poms', float:true },
    { id:'dock',       name:'Wooden Dock', emoji:'🪵', x:50, y:95, w:108, need:s=>s.palms>=15,   hint:'Earn 15 Poms' },
    { id:'bench',      name:'Pond Bench',  emoji:'🪑', x:85, y:82, w:54,  need:s=>s.streak>=5,   hint:'Keep a 5-day streak' },
    { id:'boat',       name:'Rowboat',     emoji:'🛶', x:66, y:60, w:72,  need:s=>s.maxTier>=3,  hint:'Grow a critter to tier 3 — combine!', float:true },
    { id:'swing',      name:'Tree Swing',  emoji:'🌳', x:14, y:48, w:78,  need:s=>s.palms>=40,   hint:'Earn 40 Poms' },
    { id:'fountain',   name:'Fountain',    emoji:'⛲', x:50, y:30, w:60,  need:s=>s.palms>=70,   hint:'Earn 70 Poms' },
    { id:'bridge',     name:'Arch Bridge', emoji:'🌉', x:50, y:22, w:118, need:s=>s.maxTier>=6,  hint:'Grow a critter to tier 6' },
    { id:'lighthouse', name:'Lighthouse',  emoji:'🗼', x:87, y:30, w:54,  need:s=>s.palms>=130,  hint:'Earn 130 Poms' }
  ];

  // ---- art: each returns an SVG (viewBox 0 0 100 100), soft pastel + white-ish
  //      outlines to match the critters. Bottom of the art ≈ y=96 so it "stands". ----
  function art(id) {
    switch (id) {
      case 'lily':
        return `<ellipse cx="50" cy="78" rx="34" ry="13" fill="#4FA86A" stroke="#fff" stroke-width="1.6"/><path d="M50 65 l3 13 -6 0z" fill="#3C8A57"/>`
          + `<ellipse cx="26" cy="86" rx="20" ry="8" fill="#5BB57A" stroke="#fff" stroke-width="1.4"/>`
          + `<g transform="translate(60,70)">${[0,60,120,180,240,300].map(d=>`<ellipse cx="${(8*Math.cos(d*Math.PI/180)).toFixed(1)}" cy="${(8*Math.sin(d*Math.PI/180)).toFixed(1)}" rx="6" ry="4" fill="#FF8FC2" transform="rotate(${d} ${(8*Math.cos(d*Math.PI/180)).toFixed(1)} ${(8*Math.sin(d*Math.PI/180)).toFixed(1)})"/>`).join('')}<circle r="5" fill="#FFD24B"/></g>`;
      case 'dock': {
        const posts = [16,38,62,84].map(x=>`<rect x="${x-3}" y="58" width="6" height="34" rx="2" fill="#8a5a36"/>`).join('');
        const planks = [60,68,76,84].map(y=>`<rect x="10" y="${y}" width="80" height="6" rx="2" fill="#b07a45" stroke="#8a5a36" stroke-width="0.8"/>`).join('');
        return posts + `<rect x="8" y="56" width="84" height="10" rx="3" fill="#c98a52" stroke="#8a5a36" stroke-width="1"/>` + planks;
      }
      case 'bench':
        return `<rect x="18" y="56" width="64" height="9" rx="3" fill="#a9743f" stroke="#7d5128" stroke-width="1"/>`
          + `<rect x="20" y="38" width="60" height="7" rx="3" fill="#bd854c" stroke="#7d5128" stroke-width="1"/>`
          + `<rect x="20" y="47" width="60" height="6" rx="3" fill="#bd854c" stroke="#7d5128" stroke-width="1"/>`
          + `<rect x="24" y="65" width="7" height="26" rx="2" fill="#7d5128"/><rect x="69" y="65" width="7" height="26" rx="2" fill="#7d5128"/>`
          + `<rect x="24" y="38" width="7" height="22" rx="2" fill="#8a5a30"/><rect x="69" y="38" width="7" height="22" rx="2" fill="#8a5a30"/>`;
      case 'boat':
        return `<path d="M14 58 q36 26 72 0 q-8 18 -36 18 q-28 0 -36 -18z" fill="#c45b4a" stroke="#fff" stroke-width="2"/>`
          + `<path d="M22 60 q28 16 56 0" fill="none" stroke="#f2d3b0" stroke-width="4"/>`
          + `<rect x="46" y="40" width="4" height="26" rx="2" fill="#8a5a36"/><rect x="50" y="58" width="30" height="4" rx="2" fill="#8a5a36" transform="rotate(20 50 58)"/>`;
      case 'swing':
        return `<rect x="40" y="40" width="10" height="52" rx="3" fill="#8a5a36"/>`
          + `<circle cx="46" cy="34" r="26" fill="#67b85e" stroke="#fff" stroke-width="2"/><circle cx="62" cy="44" r="18" fill="#5aa852" stroke="#fff" stroke-width="2"/><circle cx="30" cy="44" r="16" fill="#73c267" stroke="#fff" stroke-width="2"/>`
          + `<line x1="58" y1="50" x2="62" y2="78" stroke="#6b4423" stroke-width="2"/><line x1="74" y1="50" x2="72" y2="78" stroke="#6b4423" stroke-width="2"/><rect x="56" y="78" width="22" height="5" rx="2" fill="#a9743f"/>`;
      case 'fountain':
        return `<ellipse cx="50" cy="86" rx="36" ry="11" fill="#bcdfe6" stroke="#fff" stroke-width="2"/><path d="M16 82 q34 14 68 0 l0 4 q-34 14 -68 0z" fill="#7fc3d6"/>`
          + `<rect x="44" y="52" width="12" height="30" rx="3" fill="#cdd6da" stroke="#9aa6ab" stroke-width="1"/><ellipse cx="50" cy="52" rx="20" ry="6" fill="#dde6ea" stroke="#9aa6ab" stroke-width="1"/>`
          + `<g stroke="#8fd6ec" stroke-width="3" fill="none" stroke-linecap="round" opacity=".9"><path d="M50 50 q-12 -8 -14 -22"/><path d="M50 50 q12 -8 14 -22"/><path d="M50 48 v-26"/></g>`
          + `<circle cx="36" cy="26" r="2.4" fill="#bfeaf7"/><circle cx="64" cy="26" r="2.4" fill="#bfeaf7"/><circle cx="50" cy="20" r="2.6" fill="#bfeaf7"/>`;
      case 'bridge':
        return `<path d="M6 78 q44 -50 88 0" fill="none" stroke="#b07a45" stroke-width="9"/>`
          + `<path d="M6 86 q44 -50 88 0" fill="none" stroke="#8a5a36" stroke-width="6"/>`
          + [16,30,46,64,78].map(x=>`<line x1="${x}" y1="${78-Math.max(0,28-Math.abs(50-x)*0.9)}" x2="${x}" y2="86" stroke="#c98a52" stroke-width="3"/>`).join('');
      case 'lighthouse':
        return `<path d="M38 92 l4 -54 16 0 4 54z" fill="#f4f4f4" stroke="#cfcfcf" stroke-width="1"/>`
          + `<path d="M41 70 l18 0 M40 56 l20 0 M42 42 l16 0" stroke="#e0584e" stroke-width="7"/>`
          + `<rect x="40" y="26" width="20" height="13" rx="2" fill="#7d8a90"/><path d="M38 26 l24 0 -5 -9 -14 0z" fill="#e0584e"/>`
          + `<rect x="46" y="28" width="8" height="9" fill="#ffe9a8"/><circle cx="50" cy="20" r="3" fill="#ffd24b"/>`;
      default:
        return '';
    }
  }

  function render(id) {
    return `<svg viewBox="0 0 100 100" width="100%" height="100%" style="overflow:visible">${art(id)}</svg>`;
  }

  // which decorations are unlocked for the given derived stats
  function unlocked(stats) {
    const s = Object.assign({ palms:0, streak:0, maxTier:0, critters:0 }, stats || {});
    return DECOR.filter(d => d.need(s));
  }

  return { DECOR, render, unlocked, all: () => DECOR.slice() };
});
