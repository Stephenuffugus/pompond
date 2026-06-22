# Pom Pond — Critter Scaling & Collectibility Breakdown

*Generated 2026-06-22 from the live engine (`src/critter-engine.js`). Numbers are exact
where counted from code, and clearly flagged where they use a perceptual assumption.*

---

## 1. The variety axes today

Every critter a kid sees is the product of these axes. "Collectible?" = can a kid
meaningfully *aim* to collect along this axis (discrete, nameable, trackable)?

| Axis | Type | Count | How it's set | Collectible? |
|---|---|---|---|---|
| **Species** | discrete | **305** | minted at random / discovered via fusion | ✅ strong (Dex: X/305) |
| **Rarity** | discrete | **4** (Common→Legendary) | earned (pond fills, fusion) → drives aura | ⚠️ partial (not surfaced per-species) |
| **Tier** | discrete | **41 rungs**, 8 visual stages | climbed by fusing | ✅ (The Climb) |
| **Shiny** | discrete | **2** | tier-scaled on fusion (~7%→75%) | ⚠️ latent (not tracked) |
| **Hue (color)** | ~continuous | 360° (281 species) / narrow band (24 species) | per-seed random | ❌ latent |
| **Accent harmony** | discrete | **6** | per-seed | ❌ latent |
| **Pattern** | discrete | **6** (plain/spots/stripes/patches/freckles/ombre) | per-seed | ❌ latent |
| **Eye style** | discrete | **6** (round/big/sleepy/wink/sparkle/happy) | per-seed | ❌ latent |
| **Blush** | discrete | **2** | per-seed | ❌ latent |
| **Accessory** | discrete | rarity-gated (~1–6 states) | per-seed + rarity | ❌ latent |
| Background | discrete | 5 | showcase views only | n/a (not pond identity) |

Composable-part vocabulary behind the 305 species: **6 shapes × 14 ears × 11 tails ×
8 noses** (× belly × eye-size) ≈ **10,000+** possible silhouettes — so the roster can
grow to many hundreds more just by adding one-line rows.

---

## 2. How many *visually distinct* critters? (the uniqueness math)

Per (species × rarity), holding shiny/tier fixed, the per-seed look multiplies out:

```
hue-buckets × harmony(6) × pattern(6) × eye(6) × blush(2) × accessory(avg ~4)
```

Using a **conservative 12 perceptual hue buckets**:

- per species, summed over 4 rarities:  ~**6,900**
- × shiny (2):                           ~**13,800**
- × 305 species:                         ~**50 million**
- × tier prestige (8 visual stages):     ~**400 million**

At a more typical 24 hue buckets it's **~100M → ~800M+**.

**Takeaway:** there are on the order of **tens to hundreds of millions** of visually
distinct critters. The chance two random critters look identical is roughly **1 in 50
million**. Duplicate-avoidance is *solved* — that is not where effort is needed.

---

## 3. The real gap: uniqueness ≠ collectibility

Uniqueness makes each critter feel *special*. Collecting needs something different:
**discrete, named, achievable goals.** Right now the collectible axes are **species,
tier, and (implicitly) rarity** — but ~80% of the variety (hue, pattern, eyes,
accessory, shiny) is **latent**: it makes critters pretty but a kid can't *pursue* it,
because it isn't named, surfaced, or tracked.

> A kid can't decide "I want to collect the spotted Fox and the golden Fox" — those
> variants exist in the math but are invisible as goals. That's the lever.

So the way to make people "want to collect more" is **less about more raw variety and
more about turning the variety we already have into visible collection targets**, plus
a window (the Dex) that shows progress at every scale.

---

## 4. The determinism constraint (what we can and can't change)

A hard rule has protected the project: **a stored critter (seed+archetype+rarity+
tier+shiny) must always render identically** — locked by the golden test (1256 cells),
so a kid's collection never silently changes. This has two consequences:

- **Per-seed trait *pools* are frozen.** We can't add a 7th pattern or more hues to the
  shared random draw — it would shift the output of *every existing* critter.
- New richness therefore arrives in one of two ways:
  - **(A) Additive** *(safe, recommended)* — new species via new parts, and new axes as
    new **stored attributes** that default to "legacy" on old critters (exactly how
    `tier` and `shiny` were added). The past collection is untouched; new critters are
    richer.
  - **(B) Re-skin** *(one-time)* — accept that existing critters' looks change, re-record
    the golden. More impressive uniformly, but **Penny's current pond would change**, and
    the app is in daily family use.

This is the one decision that gates *how* we build out the art.

---

## 5. Where to build — ranked by leverage for "collect more"

1. **Collection Dex, leveled up** *(highest leverage, all additive)*. The Dex already
   shows species X/305. Add the sub-collections that turn latent variety into goals:
   per-species **rarity stars** (1–4 filled), a **shiny** checkmark, **highest tier**
   badge, and a **"variants seen"** count. Completion meters at every scale = the
   "gotta find them all" engine.
2. **Named, tracked variants** *(additive via stored attribute)*. Promote a few discrete
   axes to named collectibles — e.g. a small set of color **morphs** ("Golden", "Azure",
   "Albino", "Dusk") and the 6 **patterns** as named — stored on the critter and shown in
   the Dex. Suddenly each species has *N* sub-critters to chase (305 × variants).
3. **Build the art out** *(additive)* — new composable **feature layers** (manes, horns,
   wings, fins, spikes, markings) → more striking silhouettes + more species, and richer
   bespoke detailing. This is the "build them out more" itch, done golden-safe.
4. **Goals & rewards** — milestone **badges** ("50 species", "first shiny", "reached
   Mythic"), set/family **collection bonuses**, surfaced on the Brag Card / Wall of Fame.
   Goals convert variety into *reasons to keep going*.
5. **Directed acquisition** — themed ways to chase specific critters (habitats, "today's
   featured species", fusion hints) so collecting feels *aimed*, not purely random.

---

## 6. Recommended next build (proposal)

A two-part push, both **additive** (Penny's pond stays intact):

- **Art:** add 3–5 new composable feature layers (wings/horns/mane/markings) + ~100 new
  species rows that use them, and richer detail on the plainer composed shapes. Verified
  sighted. → roster ~400+, more striking.
- **Collectibility:** add a **named variant** axis (morph + pattern), stored at mint, and
  upgrade the **Dex** into a real collection screen (rarity stars, shiny, tier, variant
  counts, completion %), plus a few **milestone badges**.

Net effect: the art gets richer *and* — more importantly — every critter becomes a set of
visible goals, which is what actually drives "collect more."

---

## 7. BUILD UPDATE — 2026-06-22 (the above proposal, shipped)

All of section 6 was built. The render constraint was lifted (no live collections to
protect), so the enrichment applies to **every** critter, not just future ones.

**Axes now (counted from the engine):**

| Axis | Then | Now |
|---|---|---|
| Species | 305 | **609** |
| Patterns | 6 | **10** (+rosette, dapple, tiger, starspot) |
| Eye styles | 6 | **8** (+starry, shimmer) |
| Part shapes / ears / tails / noses | 6 / 14 / 11 / 8 | same vocab + **8 feature layers** (wings, bat-wings, fae, back-spike, mane, horns, antlers, halo) |
| **Colour morphs** | — | **10** named, collectible (Classic + 9: Golden/Azure/Rose/Jade/Ember/Violet/Aqua/Shadow/Albino) |
| Shading | flat 3-stop | 4-stop with bright highlight (richer form) |

**Updated uniqueness math** (conservative 12 hue buckets):
`12 × harmony(6) × pattern(10) × eye(8) × blush(2) × accessory(~4)` ≈ **46k** per
species-rarity → × 4 rarities × 2 shiny × 609 species ≈ **2.2 billion**, × 8 tier
prestige stages ≈ **~18 billion** visually distinct critters, with **10 named morphs** as
a discrete overlay on top. Duplicate odds are effectively nil.

**Collectibility shipped (the actual "collect more" engine):**
- **Colour morphs** — a named, tracked variant axis assigned at mint; high-tier fusions
  bias toward the rarer morphs (Shadow/Albino), so morphs are *earned*.
- **Dex → collection screen** — completion bar (X/609), header stats (shiny count,
  morphs N/9, top tier), per-species **rarity stars + shiny + tier + variant-count**
  badges, tap-to-inspect, and **11 milestone badges** (species counts, first shiny,
  5 morphs, first fusion, tier 10/20/Apex).
- **Critter of the Day** — a deterministic daily spotlight in the Dex (a reason to return
  + a discovery target).
- **Fusion discovery hints** — the Mix preview flags **🔭 NEW!** when a fusion would
  produce an unowned species, plus the morph/shiny it will yield, so mixing becomes a
  way to *aim* at gaps in the collection.

**Not done (future, needs structured data):** real habitat groupings per species
(arbitrary hashing would be hollow; worth doing only with curated habitat tags).
