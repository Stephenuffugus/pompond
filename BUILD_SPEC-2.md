# Pom Pond — Build Spec & Claude Code Handoff

Name: **Pom Pond**  ·  localStorage key: `pomPondV1` (migrates from legacy `choreCrewV2`) (reward world = **the Pond**)
Stack: vanilla single-file PWA + Firebase (Auth + Firestore). Generative art = Lucid Winds hash-to-SVG engine.

---

## 1. Concept (locked)

A free family chore + kindness reward app. Kids earn **Poms** (the pom-pom reward system many schools use — instantly familiar to parents)
for completing chores or being helpful/kind. Poms drop **critters** (procedurally generated pond creatures) into the kid's **Pond**.
Critters and rewards both advance through a **nested 3-tier bucket economy** (small → medium → big).

Differentiators (none of the saturated chore apps have these):
- **Tiered bucket savings ladder** instead of a flat point-store.
- **Generative critter collection** as the reward currency (Lucid Winds engine).
- **AI photo-verify** of completed chores — PREMIUM (covers vision API cost).

---

## 2. Economy rules (HYBRID — locked)

Each child has three buckets with parent-set capacities (defaults):

| Bucket | Default capacity | Counts | On fill |
|--------|-----------------|--------|---------|
| Small  | 4 | Pom drops (chores/kindness) | auto-grant a SMALL reward + add a tier-1 critter + advance medium +1 |
| Medium | 3 | small-fills | auto-grant a MEDIUM reward + add a tier-2 critter + **kid CHOICE** |
| Big    | 2 | saved medium-fills | grant a BIG reward + mint a tier-3 showpiece critter |

**The hybrid choice happens at the medium fill:** the kid chooses to *save toward the big reward*
(advance the big bucket) or *keep the medium win* (don't advance big). Young kids get constant
small wins automatically; older kids get a real delayed-gratification decision.

**Fusion = visible evolution.** Filling a bucket spawns a higher-rarity critter in the pond, so the
"pour it into the next bucket" moment is shown as creatures leveling up.

Rewards are parent-defined per tier Currency name is **renameable per family** (settings; default "Pom" — schools also use Gems/Stars).
Rewards are parent-defined per tier (e.g. small = extra screen time, medium = pick dinner,
big = movie night). Redemption: kid taps Redeem → parent marks "given" in real life.

---

## 3. Critter system + art engine

DECISION: the app ships its **own self-contained Critter Engine** (not Lucid Winds).
A library of simple creature outlines, varied by hash-seeded traits. Lucid Winds stays
**separate and optional** — a candidate later for the big-bucket showpiece / print-on-demand
trophy, where the higher-fidelity art is worth the extra cost.

Critters = **archetype** (cosmetic species variety) × **hash-seeded traits** × **rarity** (tier).

- Archetypes: 18 in the prototype (frog, duck, turtle, koi, snail, cat, bunny, bear, owl, fox,
  bee, crab, axolotl, penguin, mushroom, slime, chick, ladybug). Add a species = add one
  function to the `ARCH` registry. Aim for 30–50 over time; the engine multiplies them.
- Hash seeds: hue + color harmony, pattern (plain/spots/stripes/patches), eye style
  (round/big/sleepy/wink/sparkle), blush, and an accessory (bow/hat/flower/leaf/crown).
- Rarity 0=common (chore drop), 1=small-fill, 2=medium-fill, 3=big showpiece (gold aura +
  crown). Kindness awards drop a "special"-flagged critter.

**Engine interface (already built, self-contained):**
```
CritterEngine.render(seed, archetype, rarity) -> SVG string  // viewBox "0 0 100 100", deterministic
CritterEngine.randomArchetype() -> key
CritterEngine.list -> [keys]
CritterEngine.name(key) / CritterEngine.rarityName(n)
seed = `${kidId}:${choreId|kindnessId}:${timestamp}`
```
In the code space: lift the engine into its own module/file and keep adding species there.

---

## 4. Data model (Firestore-shaped)

```
families/{familyId}
  name, createdAt, parentUids[], settings{ smallCap, medCap, bigCap, approvalMode }

families/{familyId}/members/{memberId}
  name, role: "parent"|"child", emoji, color, pin?(parent),
  pomsLifetime (data field `palms` — kept for save compat), buckets{ small:{count}, medium:{count}, big:{count} }

families/{familyId}/chores/{choreId}
  name, emoji, secs, pomValue (data field currently `palm` — kept for save/backup compat), assignedTo: memberId|null

families/{familyId}/rewards/{rewardId}
  name, emoji, tier: "small"|"medium"|"big", createdBy

families/{familyId}/critters/{critterId}
  ownerId, seed, archetype, rarity, special:bool, createdAt

families/{familyId}/ledger/{eventId}
  ownerId, type:"chore"|"kindness"|"redeem", choreId?, note?, palms, byUid, at

families/{familyId}/inventory/{itemId}
  ownerId, rewardId, tier, status:"ready"|"redeemed"|"given", at
```

## 5. Roles & security (Firestore rules)

- Parent (admin) UID: full read/write on the family doc tree.
- Child account: read its family; **cannot write** its own `buckets`, `pomsLifetime (data field `palms` — kept for save compat)`, `critters`,
  or `inventory.status` beyond `ready→redeemed`. Palm credit ONLY via a parent UID or the
  verified-photo Cloud Function.
- Enforce in rules, not just UI. (Prototype fakes this with a parent/kid mode + PIN.)

## 5b. The 🏫 source tag is a PARENT feature, not a school integration

DECISION (deliberate, do not expand): Pom Pond has **no teacher-facing anything** and never
integrates with school systems. Rationale — schools are tightening security hard (staff often
can't use personal email on school machines); any teacher-facing step is dead on arrival and a
liability. We do NOT pursue ClassDojo's space.

What stays: the give-a-Pom sheet's 🏫 source button. This is the parent's own bookkeeping —
when a kid comes home saying "I earned 3 Poms today," the parent logs them. The teacher never
knows the app exists, no school account, no QR, no link, no data leaves the family device.

What was explicitly cut: per-kid teacher links/QR, classroom mode, any "schools adopt this"
roadmap. Do not build these. If demand ever appears, it reopens real compliance scope
(COPPA/FERPA, district agreements) and must be treated as a separate product decision.

## 6. Free vs Premium

- **Free:** full core loop — members, chores, timer, palms, critters, pond, 3-tier buckets,
  parent rewards, family account + roles, redemption.
- **Premium:** photo-verify (vision API has real per-call cost = the honest gate), rarer
  evolution tiers, custom bucket tuning, multi-parent, history/analytics, print-on-demand
  trophy of a showpiece critter, Suno per-kid theme songs.

## 7. Build phases (Claude Code)

1. Drop the prototype in; lift `CritterEngine` into its own module and keep adding species.
2. Wire Firebase: Auth (parent email + child sign-in), Firestore reads/writes to the model above.
3. Firestore security rules + tests (kids can't self-credit poms).
4. Approval mode + ledger UI.
5. Premium gate scaffold (photo-verify Cloud Function calling the vision model; entitlement flag).
6. Polish: animations, sound, PWA manifest + service worker, offline.

## 8. What the prototype already does

- Lobby → parent or child mode (parent PIN, default 0000). Critter Gallery preview from lobby.
- Parent: manage kids/chores/rewards-by-tier, award kindness (+special critter & note),
  approval queue, **rewards-to-deliver** queue (mark given), **recent activity** log,
  settings (bucket sizes, approval, PIN, reset-progress).
- Kid: do a chore (timer) → earn palm → **animated critter reveal** → pond + buckets fill →
  hybrid **choice** (queued, resolved one at a time) → redeem rewards. Daily streak (🔥) and
  **once-per-day** chore lock (no palm farming). Tap any pond critter to inspect.
- Built-in `CritterEngine`: 18 species, hash-seeded color/pattern/eyes/accessory + rarity auras
  & crowns. Deterministic.
- In-memory state + try/catch localStorage (persists standalone, no-ops in the artifact sandbox).
  State is Firestore-shaped; `store` helpers + `CritterEngine` are the two clean swap points.
- Mobile-web-app meta tags (installable feel). Sound (Web Audio), confetti, vibration.

Give-a-Pom sheet has a source picker (💛 Kindness / 🏫 School).

Verified via headless DOM test: full chore loop, daily-done lock, kindness → small/medium fills,
choice queue + resolution, fusion rarities — all pass with zero JS errors.

## 9. Launch-ready layer (added for direct hand-off to a family)

- **First-run setup wizard**: family name, parent PIN, add kids — no developer defaults ship.
- **Collection book (📖)** per kid: species found X/18, best specimen shown, ??? silhouettes.
- **Backup & restore**: settings produces a copy-able code; pasting restores the whole family
  (the single-device → new-device migration path until Firebase).
- Two-tap destructive confirm (no window.confirm, sandbox-safe). Favicon + apple-touch-icon +
  runtime-injected manifest for Add-to-Home-Screen.
- Distribution: see SHARE_GUIDE.md (host on Netlify Drop / GitHub Pages, or send the file).
- Known limits stated honestly: single device per family, localStorage persistence,
  no service worker yet — all resolved by the Firebase phase.
