# Giving Pom Pond to a Parent — Hand-off Guide (cloud version)

Pom Pond is now a real, installable app with a family account that syncs across every device —
the shared tablet, mom's phone, dad's phone, and each kid's device all see the same pond live.

## Setup (you, the developer — ~15 min, one time)

Follow **README.md → Deploy**: create a Firebase project, enable Email/Google/Anonymous auth +
Firestore + Functions, paste your web config into `public/js/firebase-config.js`, then
`npm run deploy`. You get a real HTTPS URL like `https://your-project.web.app`.

## What to tell the parent (the 60-second pitch)

1. **Open the link, create your family account** (email + password, or "Continue with Google").
   First time, it walks you through your family name, a parent PIN, and your kids.
2. **Add it to your home screen** — iPhone: Share → *Add to Home Screen*; Android: menu →
   *Install app*. It launches fullscreen like a normal app and works offline.
3. **Kids tap their face, do chores on the timer, and earn Poms** — every Pom hatches a
   collectible critter into their pond. Poms fill a **small → medium → big bucket**; each fill
   unlocks a reward **you** define (extra screen time → pick dinner → movie night). The medium
   bucket gives the kid a real choice: enjoy a medium reward now, or save toward the big one.
4. **Give a Pom anytime** — 💛 for kindness at home, or 🏫 to log Poms your kid mentions from
   school so it all lands in one pond. The school button is *just your own tracking* — the app
   never talks to the school or a teacher.
5. **Your screen is PIN-protected:** edit chores/rewards, approve completions if you turn that on,
   see the rewards you owe, and a recent-activity feed.

## Putting a kid on their own device

1. On your phone, open **Settings (⚙︎)** in the parent screen — you'll see a **kid join code**.
2. Set each kid a **4-digit code** (Settings, per kid).
3. On the kid's device, open the same link, tap **"I'm a kid"**, enter the join code + their
   4-digit code. Their device is now bound to just them — they see only their pond and can't get
   into the parent screen.

## Why it's safe

A kid can't give themselves Poms, critters, or rewards. Every Pom is awarded by the server, not
the kid's phone — the app's security rules make self-crediting impossible, and we ship automated
tests that prove it. A kid also can't see another family's data.

## Honest notes

- **Multi-device + cloud sync are real now.** Data lives in your family's Firebase project and
  syncs live. Works offline and reconciles when you're back online.
- **Backup/restore** still exists (Settings → Copy backup) as a portable code, but the cloud is
  now the source of truth — you won't lose progress by clearing a browser.
- Points are called **Poms** by default; rename to Gems/Stars/etc. in Settings. Bucket sizes
  (4 / 3 / 2) are tunable — smaller = faster rewards for younger kids.
