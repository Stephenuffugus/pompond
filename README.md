# Pom Pond 🐸

A free family chore + kindness reward app. Kids do chores or kind things, earn **Poms**, and
each Pom hatches a procedurally‑generated **critter** into their pond. Poms climb a nested
3‑tier bucket ladder (small → medium → big) that unlocks rewards the parent defines.

This repo is the **productionized** build of the original single‑file prototype: same behavior
and economy, now with Firebase Auth, live Cloud Firestore sync across devices, a
server‑authoritative economy (kids can't credit themselves), an offline‑first installable PWA,
and Firebase Hosting deploy.

---

## What's here

```
src/                     source modules (one source of truth)
  critter-engine.js      deterministic hash→SVG critter art (lifted out, append-only)
  economy.js             PURE hybrid bucket ladder — shared by browser AND server
  store.js               local/cloud store seam
  app.js                 state, router, views, sheets, FX, PP bridge
  shell.html             HTML/CSS shell with build markers
build.mjs                inlines core modules → public/index.html, syncs shared → functions/
public/                  the deployable site (Firebase Hosting root)
  index.html             BUILT — local-first core inline (this is what the harness loads)
  js/cloud.js            Firebase layer: auth gate, onSnapshot sync, migration, callables
  js/firebase-config.js  YOUR web config (placeholder until you fill it in)
  manifest.json, sw.js, icons/   PWA: installable, offline app shell
functions/               Cloud Functions — server-authoritative economy (Admin SDK)
  index.js               createFamily, bindDevice, completeChore, givePom, resolveChoice,
                         redeem, approve/deny, markGiven, resetProgress, verifyChorePhoto(stub)
  shared/                critter-engine.js + economy.js (synced from src/ by build.mjs)
firestore.rules          security rules (kids can't self-credit; no cross-family reads)
firestore.indexes.json   composite indexes
firebase.json / .firebaserc   hosting + firestore + functions + emulator config
test/
  pom-pond.test.mjs      jsdom regression harness (21/21) — the behavior contract
  economy.test.mjs       Node: shared economy reproduces the ladder exactly (17/17)
  rules.test.mjs         emulator: proves the security guarantees (26/26)
scripts/gen-icons.mjs    rasterizes PNG icons from the frog mark (no image deps)
```

## Architecture in one paragraph

The **core app is local‑first** and inlined into `public/index.html` (no network, no build‑step
bloat) — that's exactly what the jsdom harness runs, so behavior stays verifiable. The
**Firebase layer (`js/cloud.js`) is progressive enhancement**: loaded only when hosted, dormant
while `firebase-config.js` holds placeholders. When active it shows an auth gate and then drives
the same app via `window.PomPond`. The **economy lives in one pure module (`src/economy.js`)**
that runs in the browser (local mode) *and* inside the Cloud Functions (cloud mode) — identical
math, so the port is mechanical. In cloud mode every Pom/critter/bucket mutation is performed by
a **Cloud Function with the Admin SDK inside a transaction**; the security rules deny *all* client
writes to economy collections, which is why a child (or even a parent's browser) can never
fabricate a result. The critter engine is deterministic and **append‑only** — add species, never
edit existing ones, or every kid's existing pond changes.

---

## Develop & test

```bash
npm install
npm test            # build + jsdom harness (21/21) + economy unit test (17/17)
npm run test:rules  # spins up the Firestore emulator and runs the rules suite (26/26)  [needs Java]
npm run test:all    # everything
```

`npm run build` regenerates `public/index.html` from `src/` and syncs `functions/shared/`. Run it
after editing anything in `src/`.

### Run the whole thing locally (emulators)

```bash
cd functions && npm install && cd ..
# set  export const useEmulators = true  in public/js/firebase-config.js (and a non-REPLACE_ME apiKey)
npm run dev         # auth + firestore + functions + hosting emulators
```

---

## Deploy (one-time setup)

1. **Create a Firebase project** at <https://console.firebase.google.com> (Blaze plan — Cloud
   Functions require it; Pom Pond's usage is trivially within free quotas).
2. **Enable Auth providers:** Authentication → Sign‑in method → enable **Email/Password**,
   **Google**, and **Anonymous** (anonymous powers kid devices).
3. **Create Firestore** (production mode) and **enable Cloud Functions**.
4. **Paste your web config** into `public/js/firebase-config.js` (Project settings → Your apps →
   Web). These values are not secrets — real security is in the rules + functions.
5. Put your project id in `.firebaserc` (replace `pom-pond`).
6. Install the CLI and log in: `npm i -g firebase-tools && firebase login`.

Then:

```bash
cd functions && npm install && cd ..
npm run deploy            # builds, then deploys hosting + firestore rules + functions
```

Your app is live at `https://<project-id>.web.app`. On a phone: open it in Safari/Chrome →
**Add to Home Screen** → it launches fullscreen like a native app.

Granular deploys: `npm run deploy:hosting`, `npm run deploy:rules`, `npm run deploy:functions`.

### Generating PNG icons

`node scripts/gen-icons.mjs` rebuilds `public/icons/*.png` from the frog mark (no image
libraries needed).

---

## How sign-in works

- **Parent** creates a family account (email/password or Google). On first sign‑in they're
  offered to **migrate an existing local pond** (the prototype's `pomPondV1` data) into the
  cloud, so the prototype tester isn't stranded. `createFamily` mints a parent custom claim
  `{familyId, role:'parent'}`.
- **Kid** signs in on their own device with the **family join code** (shown in the parent's
  Settings) + their **4‑digit code** (parent‑set, per kid). The device authenticates anonymously
  and `bindDevice` validates the codes server‑side and mints a child claim
  `{familyId, memberId, role:'child'}`. A kid principal maps to exactly one child member and can
  never enter the parent screen or write economy state.

## Security model (the heart of the build)

- Identity = **custom claims** minted only by Cloud Functions.
- **All economy writes go through Cloud Functions** (Admin SDK, transactional). Rules deny client
  writes to `members` economy fields, `critters`, `inventory`, `ledger`, and `done` — for kids
  *and* parents. Parents may write **config** (chores, rewards, member profile, settings).
- The daily‑done lock is **server‑enforced** in a transaction, so it holds across devices and
  can't be bypassed by clearing local storage.
- `test/rules.test.mjs` proves all of this against the emulator (26 assertions).

## Not in this build (Phase 2)

Premium photo‑verify (the `verifyChorePhoto` Function seam exists), rarer evolution tiers,
multi‑parent admin, print‑on‑demand showpiece trophies, per‑kid theme songs. **No school/teacher
integration, ever** — the 🏫 button is the *parent's own* logging of points a kid mentions from
school and touches no external system.

See **QA.md** for the on-device launch checklist.
