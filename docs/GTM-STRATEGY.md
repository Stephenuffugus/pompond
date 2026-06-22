# Pom Pond — Market, Monetization & Go-To-Market Strategy

*2026-06-22. Competitor pricing, subscription benchmarks, and regulation are research-backed
(cited). Marketing-channel effectiveness numbers did NOT survive verification — that section is
labeled judgment, not fact. Education-category benchmarks are a directional proxy, not exact comps.*

---

## 1. Competitor landscape & pricing (verified)

| App | Hook | Model / price |
|---|---|---|
| **Greenlight** | Allowance + debit card + money lessons | Sub from **$5.99/mo** (whole family, ≤5 kids) |
| **BusyKid** | Chores → real allowance + prepaid Visa | **$4/mo billed annually ($48/yr)** |
| **ClassDojo** | Classroom behavior + parent comms | **School product free forever**; parent **Plus ~$4.99/mo or $59.99/yr** |
| **Cozi** | Family calendar/organizer | Free ad-supported + **Gold $39/yr** |
| **Finch** | Self-care pet you grow by doing tasks | **Plus $9.99/mo or $69.99/yr** (~42% annual discount), **no IAP** |
| **Sago Mini World** | Open-play kids games | **~$6.99/mo or $59/yr, NO in-app purchases for subscribers** |
| **iAllowance** | Chore/allowance tracker | One-time **$2.99** (rare model) |

**The pattern that matters:** the kid/collection comparables most like us — **Finch and Sago Mini
World — both use ONE parent-paid subscription that unlocks everything, with NO à-la-carte IAP.**
ClassDojo does the same (free core, one optional parent sub). That's the parent-trusted model, and
it's exactly what our no-ads / private-by-default design already points at.

**Our moat vs all of them:** none pair a *deep collect-and-fuse game* with the chore/kindness loop.
Fintech apps need bank/card infrastructure (KYC, compliance) we don't; ClassDojo is teacher-distribution
dependent; Finch is solo-adult; Sago is open play with no behavior loop. Pom Pond's fusion/Dex depth is
genuinely differentiated.

## 2. Monetization — recommended model

**Free, generous core** (the whole kid loop: chores, kindness, earning critters, fusing, the Dex)
**+ one low-priced "Pom Pond Plus" annual subscription** that unlocks the *parent/family* layer.

- **Price: ~$29.99/yr (≈$3.49/mo), with a $4.99/mo option.** Deliberately at the LOW end. Benchmark
  data (RevenueCat 2025/26): family/education apps convert ~**2.3%** download→paid and earn only
  **~$22.82 Year-1 LTV per payer**; annual plans churn to **~44%** Year-1 retention but **low-priced
  annual plans retain far better (~53.7%)**. Cheap-annual is the math-optimal play, and we have no
  card/bank cost to cover like the fintech apps. It also undercuts Greenlight/Finch/ClassDojo.
- **What Plus unlocks (parent value, NOT pay-to-win):** unlimited kids (free = 1–2), **routines &
  scheduled chores**, **weekly parent recap/insights**, deeper custom reward catalog, co-parent
  seats, history/export. Optionally **cosmetic-only** extras (showcase frames/backgrounds) — never
  power. *The earning + collecting loop stays 100% free so kids stay hooked; parents pay for the
  management & insight layer + family scale.* (This is exactly ClassDojo's free-core/paid-parent split.)
- **Avoid:** paywalling the collection itself, loot-box/gacha purchases, anything that reads as
  pay-to-win or nickel-and-diming — it backfires with parents and trips kid-app store rules.

**Honest unit economics:** 2.3% × ~$23/payer means **direct B2C subscription revenue is modest
until you have a lot of families.** ~10k active families × 2.3% × $23 ≈ ~$5k/yr. This is a
lifestyle/side-income or brand-asset profile as a standalone, not a venture business — unless it
rides a bigger distribution engine (see §5, the Lucid Winds bundle angle).

## 3. Regulation & platform (verified — and we're already well-positioned)

- **COPPA (amended Rule is IN FORCE as of 2026):** verifiable parental consent before collecting
  under-13 data; **separate opt-in** before sharing kids' data with third parties / for targeted ads;
  parental deletion rights. → We already collect minimal data, are parent-gated, no ads. **Action:** a
  clear privacy policy, formalize the parent-consent step at signup, and a data-deletion path.
- **Apple Kids Category + Google Play Families:** **ban behavioral ads to kids**, ban transmitting
  device identifiers, require **parental gates before IAP/external links**, require COPPA/GDPR
  compliance. → Our design already fits this lane; the lucrative ad path is closed (fine — we're
  subscription).
- Net: the regulation that kills *ad-based* kids apps is a **tailwind** for our subscription model.

## 4. Marketing (⚠️ judgment — channel cost/effectiveness did NOT verify in research)

No reliable CAC/effectiveness numbers survived fact-checking, so treat this as reasoned hypotheses
to **test cheaply and measure**, not settled fact:

- **Reposition from "chore app" → "raise kind, responsible kids."** Warmer, more shareable, less
  commoditized. This is the headline for every channel.
- **Build an organic share loop** on the existing **Brag Card** (privacy-safe, kid-name-only): parents
  share a kid's "Certificate of Responsibility" / rare critter → relatives & other parents discover it.
  Add a referral nudge ("invite the grandparents to cheer Penny on").
- **Likely-cheapest channels to test first:** parenting Facebook groups & subreddits, Pinterest
  (chore-chart / kids-routine SEO is huge there), teacher/parent word-of-mouth, and a few micro
  parenting creators on TikTok/Instagram. **PR angle:** "screen-time that rewards real-world chores."
- **Spend nothing on paid acquisition** until the organic loop + 30-day retention are proven.

## 5. The big forks — my calls

- **PWA vs native:** Stay PWA to validate retention cheaply **now**; then wrap native (Capacitor) —
  primarily to unlock **push notifications** (the single biggest retention lever we're missing:
  "Penny has chores today", "a rare critter is close") and App Store "Kids" discovery. Native adds the
  15–30% store cut + compliance overhead, so do it *after* the loop is proven.
- **B2C-families vs B2B-schools:** **B2C-first** — it's a home/family product. Schools (ClassDojo's
  lane) is a much bigger, different build (rosters, classroom tools) — not now. A light "group/classroom"
  mode is a *future* wedge if teachers pull us there.
- **The realistic money path = the Lucid Winds bundle.** Standalone, the economics are thin. As a
  flagship in a **Lucid Winds family-games subscription** (shared acquisition + cross-promotion across
  games, one sub unlocks the suite), Pom Pond becomes a retention/marketing engine rather than a
  lonely $30/yr SKU. This is likely the highest-value framing.

## 6. Prioritized next steps
1. **Prove retention** with 5–15 real families (instrument: 7- & 30-day active, chores/wk, fusions/wk).
2. **Build the share loop + referral** (organic growth) and **routines + weekly parent recap** (the
   things parents will pay for) — see product opinion: invest in the *behavior/value* side, not critter #610.
3. **Formalize COPPA basics** (privacy policy, consent at signup, delete-my-data).
4. **Stand up Pom Pond Plus** (free core + ~$29.99/yr) once there's something worth paying for + retention signal.
5. **Native wrap for push** once the loop holds.
6. **Decide the Lucid Winds bundle** positioning — likely the real business model.

---

## DECISION — pricing & free/paid split (2026-06-22, locked by founder)

Informed by the focus group (0/13 unconditional "yes"; resistance was *conditional*, not
price-driven; the multi-kid paywall was the #1 monetization complaint):

- **Price: $10–15/year** for the optional parent layer (≈ $1/mo). Deliberately low — "we
  shouldn't overcharge." Annual only (best retention per the benchmarks). **Not** ~$3/mo.
- **All of a family's kids are FREE.** Never paywall adding a child — that punishes our
  best-fit user (the multi-kid family). The earning + collecting loop is 100% free for kids.
- **Routines stay free.** They're core to the value, not a lever.
- **Plus (paid) = the parent-convenience layer only:** the things that reduce a parent's
  mental load — automatic weekly recap push, inactivity nudges, reward-debt tracking,
  richer history/insights, multiple co-parents, export. Plus is a *convenience*, never
  pay-to-win and never gating a child's experience.
- **Guarantee (in copy + code):** lapsing a subscription **never hides or deletes a child's
  pond or critters** — consistent with "nothing is ever lost."
- **Calm Mode is free** (it's an ethics/well-being feature, not a paywall).

*Billing is intentionally NOT built yet* — it needs a payment provider (Stripe / app-store
IAP) + the founder's accounts, and should wait until 30-day retention is proven on real
families. This section is the spec for when that day comes.
