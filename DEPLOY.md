# Deploy Pom Pond to production (cloud, multi-device)

Goal: a real family using it tomorrow at **https://pompond.lucidwinds.com**, with
accounts and live sync across devices. ~15 minutes. The only steps that need *you*
(a human with the Google account) are the Firebase console clicks in Part A.

There are two roles:
- **You** — create the Firebase project, paste config, run the deploy (Parts A–C).
- **The lucidwinds Claude** — add the DNS records for the subdomain (see
  `HANDOFF-lucidwinds.md`). You can use the app on the `*.web.app` URL the second
  the deploy finishes; the custom domain just makes it pretty.

---

## Part A — Firebase project (console, ~8 min)

1. Go to <https://console.firebase.google.com> → **Add project**. Name it e.g.
   `pom-pond` (note the **Project ID** it generates — you'll need it).
2. **Upgrade to Blaze** (pay-as-you-go): ⚙️ → Usage and billing → Modify plan →
   Blaze. Cloud Functions require it. Pom Pond's usage sits comfortably in the free
   monthly allotment — set a budget alert (e.g. $5) for peace of mind.
3. **Authentication** → Get started → **Sign-in method**, enable all three:
   - **Email/Password**
   - **Google** (set a support email when prompted)
   - **Anonymous** (this powers kid devices — don't skip it)
4. **Firestore Database** → Create database → **Production mode** → pick a location
   (e.g. `nam5` / `us-central`). Done — our `firestore.rules` lock it down on deploy.
5. **Build → Functions** → Get started (just enables the APIs; we deploy the code in
   Part C).
6. **Project settings (⚙️) → General → Your apps → Web app (`</>`)**. Register an app
   (nickname "Pom Pond", Hosting not required here). Copy the **`firebaseConfig`**
   object it shows.

## Part B — wire the config (2 min)

1. Paste the copied values into **`public/js/firebase-config.js`** (replace every
   `REPLACE_ME`). Leave `useEmulators = false`.
2. Put your **Project ID** in **`.firebaserc`** (replace `pom-pond`).

```bash
# from the repo root, in this codespace:
npm install
cd functions && npm install && cd ..
npx firebase login          # opens a browser auth flow; use the same Google account
```

## Part C — deploy (2 min)

```bash
npm run deploy              # builds, then deploys hosting + firestore rules + functions
```

When it finishes it prints a **Hosting URL** like `https://pom-pond.web.app`.
**That URL works immediately** — open it on your phone, create your parent account,
add kids, and it's live. (Granular: `npm run deploy:hosting|:rules|:functions`.)

## Part D — custom domain + auth (5 min, overlaps DNS)

1. **Hosting → Add custom domain → `pompond.lucidwinds.com`.** Firebase shows the
   exact DNS records to add (usually two A records + a TXT to verify). **Copy those
   records and send them to the lucidwinds Claude** (`HANDOFF-lucidwinds.md`).
2. **Authentication → Settings → Authorized domains → Add domain →
   `pompond.lucidwinds.com`.** (The `*.web.app` domain is added automatically.)
   ⚠️ Without this, Google/email sign-in fails *on the custom domain*.
3. DNS propagation + Firebase's automatic SSL cert can take anywhere from minutes to
   a few hours. Until it's ready, the family uses the `*.web.app` URL — same app, same
   data.

---

## Give it to the family (tomorrow)

1. Send the parent the URL. On their phone: open it → **Add to Home Screen**.
2. They create an account, add kids, and in **Settings (⚙︎)** they'll see the
   **kid join code** and a **4-digit code per kid**. Put each kid on their own
   device: open the app → "I'm a kid" → enter the join code + their 4-digit code.
3. Full parent-facing pitch is in `SHARE_GUIDE.md`.

## If something's off

- **Sign-in popup blocked / fails on the domain** → you missed Part D step 2
  (authorized domains).
- **`functions` deploy errors about APIs** → Blaze not enabled, or first deploy needs
  a minute for Artifact Registry/Cloud Build to turn on; re-run `npm run deploy:functions`.
- **Kid can't sign in** → set their 4-digit code in Settings first (codes must be
  unique per kid).
- Verify the security model anytime: `npm run test:rules` (26/26) and `npm run smoke`
  (16/16).
