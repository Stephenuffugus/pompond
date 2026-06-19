# Pom Pond — launch QA checklist

Automated (run before every deploy — all green in this repo):

- [x] `npm test` — jsdom regression harness **21/21** + shared economy unit test **17/17**
- [x] `npm run test:rules` — Firestore rules suite **26/26** against the emulator

On-device QA (do once on **real iOS Safari + Android Chrome** before giving it to a family).
This part requires your live Firebase project (config filled in, deployed) and physical devices —
it can't be automated in CI.

- [ ] Parent creates account → family; reload / re-login keeps everything (now from cloud).
- [ ] Second device (other parent / shared tablet) shows the same family live; a chore done on
      one device appears on the other within seconds.
- [ ] Kid signs in on their own device with the join code + 4-digit code, sees only their family,
      does a chore → Pom + critter reveal; cannot open the parent screen (no parent claim, PIN gate).
- [ ] Daily-done lock holds **across devices** (server-enforced in a transaction).
- [ ] Small → medium → big ladder + the medium save/keep choice behave exactly as the prototype.
- [ ] Redeem → parent "Rewards to deliver" queue → Mark given, synced.
- [ ] 💛 kindness and 🏫 parent-logged Poms work; activity log shows them.
- [ ] Currency rename; backup/restore (still available as a portable code; cloud is source of truth).
- [ ] Collection book progress; offline use then reconnect reconciles with no dupes/loss.
- [ ] Installs to home screen (manifest + icons), launches fullscreen, opens offline.
- [ ] **Security:** signed in as a kid, attempts to write palms/critters/inventory are rejected
      (verify in the browser console network tab + the passing `rules.test.mjs`).

## Manual cloud smoke test (emulator, no real project)

```bash
cd functions && npm install && cd ..
# firebase-config.js: set useEmulators = true and any non-placeholder apiKey
npm run dev
```

Open <http://localhost:5000>, create a parent account in the Auth emulator, walk the loop, then
open a second browser/profile to watch live sync. The Emulator UI (<http://localhost:4000>) shows
the Firestore writes coming only from the functions.
