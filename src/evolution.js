/* ============================================================
   EVOLUTION ladder — the "tiers" a critter climbs by combining.
   PURE data + helpers, no DOM. Dual-loaded into the browser build AND the
   Cloud Functions (synced to functions/shared by build.mjs), so client preview
   and the server agree on a fused critter's tier.

   `tier` is a SEPARATE integer field on a critter (NOT rarity). rarity (0–3)
   still drives the visual aura; tier is the prestige "stage" shown on cards.
   The ladder is extensible — add names freely; old critters keep their tier.
   ============================================================ */
(function (root, factory) {
  const mod = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
  root.Evolution = mod;
})(typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : this), function () {
  // The ladder. The FIRST 12 are the original names in their original order —
  // never reorder them or existing critters' tier LABELS would shift. New rungs
  // are APPEND-ONLY after index 11, giving a very high ceiling (years of climbing).
  const TIERS = [
    'Hatchling','Sprout','Bloom','Sprite','Glimmer','Radiant','Prism','Mythic','Ancient','Astral','Celestial','Eternal',
    'Empyrean','Phoenix','Drake','Primal','Titan','Colossus','Aurora','Stellar','Nebula','Quasar','Pulsar','Seraph',
    'Empyreal','Divine','Cosmic','Galactic','Vortex','Zenith','Paragon','Sovereign','Immortal','Transcendent','Infinite',
    'Omega','Genesis','Eclipse','Singularity','Apex'
  ];
  const MAX = TIERS.length - 1;                 // top of the ladder (clamp target) = 40
  function tierName(t){ t = Math.max(0, t|0); return TIERS[t] || ('Tier ' + (t + 1)); }
  // Where a fused child lands: climb +1 (2-fuse) or +2 (3-fuse) above the best parent, capped.
  function childTier(parentTiers, n){
    const best = (parentTiers || []).reduce((m, t) => Math.max(m, t || 0), 0);
    return Math.min(MAX, best + (n >= 3 ? 2 : 1));
  }
  return { TIERS, MAX, tierName, childTier };
});
