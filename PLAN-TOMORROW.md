# Tomorrow's plan — ship Pom Pond to a real family

Goal: a parent using Pom Pond tomorrow at **https://pompond.lucidwinds.com** (with the
`*.web.app` URL working instantly as the safe fallback). We do this **one step at a
time** — each step says who does it and the checkpoint before moving on.

Status going in: branch `productionize-firebase`, 4 commits, all suites green
(harness 21 · economy 17 · rules 26 · smoke 16). Decisions locked: **full cloud,
multi-device, Firebase Hosting + custom domain.** Reference: `DEPLOY.md` (your steps),
`HANDOFF-lucidwinds.md` (DNS relay).

---

## Step 1 — (you) Create the Firebase project  ·  ~8 min
In <https://console.firebase.google.com> (full clicks in `DEPLOY.md` Part A):
- New project → upgrade to **Blaze**.
- **Auth → Sign-in method:** enable **Email/Password**, **Google**, **Anonymous**.
- **Firestore:** create (Production mode).
- **Functions:** Get started (enables APIs).
- **Project settings → Web app:** copy the `firebaseConfig` + note the **Project ID**.

▶ **Checkpoint / hand me:** the `firebaseConfig` object + the Project ID.

## Step 2 — (me) Wire the config & commit  ·  ~1 min
I paste your config into `public/js/firebase-config.js`, set Project ID in `.firebaserc`,
rebuild, commit.

▶ **Checkpoint:** I confirm "config wired, committed."

## Step 3 — (you) Firebase login  ·  ~1 min
In the terminal here, run it yourself (interactive browser auth):
`! npx firebase login`  — use the same Google account as the project.

▶ **Checkpoint:** login succeeds.

## Step 4 — (me) Deploy  ·  ~3 min
`npm install` (root + `functions/`) then `npm run deploy` (builds → hosting + rules +
functions).

▶ **Checkpoint:** I hand you the live **`https://<project>.web.app`** URL.

## Step 5 — (you) Smoke-test on real devices  ·  ~5 min
On your phone(s), against the `.web.app` URL:
- Create parent account → add a kid → in **Settings** set that kid's **4-digit code**
  (note the **join code** too).
- Do a chore → critter reveal + bucket fills.
- Second device: open same URL, sign in (or kid via join code + 4-digit code) → confirm
  it shows the same family live.

▶ **Checkpoint:** you confirm it works (or we debug — `DEPLOY.md` "If something's off").

## Step 6 — (you) Add the custom domain in Firebase  ·  ~2 min
Hosting → Add custom domain → `pompond.lucidwinds.com`. Firebase shows exact DNS
records. Also: Auth → Settings → Authorized domains → add `pompond.lucidwinds.com`.

▶ **Checkpoint / hand me:** paste the DNS records Firebase shows.

## Step 7 — (relay) lucidwinds Claude adds DNS
You pass `HANDOFF-lucidwinds.md` + those exact records to the lucidwinds Claude. They
add them to the `lucidwinds.com` zone, **DNS-only (no proxy)**.

▶ **Checkpoint:** records added; we wait on propagation + auto-SSL (minutes–hours).

## Step 8 — (you) Give it to the parent
Hand them the URL (`.web.app` now; switch to `pompond.lucidwinds.com` once SSL is green).
Parent-facing pitch is in `SHARE_GUIDE.md`.

---

## Optional / when ready
- **Push to a remote + merge `productionize-firebase` → `main`** (no remote configured
  yet; tell me to do it). Lets the lucidwinds Claude pull/deploy from `main`.
- Decide if the lucidwinds Claude will own future deploys (needs Firebase Editor access
  or a `firebase login:ci` token) — see `HANDOFF-lucidwinds.md`.

## First thing to say to me tomorrow
"Let's start step 1" (or paste the firebaseConfig if you've already made the project).
The background test server from tonight will have stopped on shutdown — that's fine.
