# Giving Pom Pond to a Parent — Hand-off Guide

The whole app is one file: **pom-pond.html**. No accounts, no server, nothing to install
on your end. Their family's data lives in their own browser on their own device.

## Best way: host it, send a link (5 minutes)

A hosted link is the smoothest experience — the parent just opens a URL and adds it to
their home screen like a real app.

**Option A — Netlify Drop (fastest, free, no account needed to start)**
1. Rename the file to `index.html`.
2. Put it in a folder, go to https://app.netlify.com/drop and drag the folder in.
3. Send the parent the URL Netlify gives you.

**Option B — GitHub Pages (your usual stack)**
1. New repo → add the file as `index.html` → Settings → Pages → deploy from main.
2. Send `https://<you>.github.io/<repo>/`.

Then tell the parent:
- **iPhone:** open the link in Safari → Share button → **Add to Home Screen**.
- **Android:** open in Chrome → menu (⋮) → **Add to Home Screen** / **Install app**.
It launches fullscreen with a frog icon, like a normal app.

## Quick way: just send them the file

Email / AirDrop / text `pom-pond.html`. They open it in a browser and it works.
This is fine for a quick look, but hosting is better for daily use — opening a local
file is clunkier on phones and browser storage for local files is less dependable.

## What to tell the parent (the 30-second pitch)

1. First open walks you through setup: family name, a parent PIN, and your kids.
2. Kids tap their face, do chores on the timer, and earn **Poms** (yes, like the school pom system — it works the same way at home) — every Pom hatches
   a collectible critter into their pond.
3. Palms fill a **small bucket → medium bucket → big bucket**. Each fill unlocks a reward
   **you** define (extra screen time → pick dinner → movie night). Filling the medium
   bucket gives the kid a real choice: enjoy a medium reward now, or save toward the big one.
4. You can also give a Pom anytime — for kindness at home (💛), or to log Poms your kid earned
   at school (🏫) so it all lands in one pond. This is just your own tracking; the app never
   talks to the school or the teacher. Both hatch special critters.
5. Your screen (PIN-protected): edit chores/rewards, approve completions if you turn that
   on, see what rewards you owe, and a recent-activity feed.

## Honest limitations of this version

- **One device per family.** Data lives in that device's browser. The lobby is designed
  for a shared family tablet/phone. (Multi-device sync is the planned Firebase version.)
- **Back up occasionally.** Settings → "Copy backup" gives a code; pasting it into
  another device's Restore moves the whole family over. Clearing browser data without a
  backup loses progress.
- Works offline once loaded, but it isn't a full offline-installable PWA yet (that comes
  with the hosted Firebase build).

## Defaults

- Points are called **Poms** by default; if their school uses Gems/Stars/etc., rename it in Settings.

- Parent PIN is whatever they set in the wizard (fallback 0000).
- Starter chores and rewards are pre-loaded and fully editable.
- Bucket sizes (4 / 3 / 2) are tunable in Settings — smaller numbers = faster rewards
  for younger kids.
