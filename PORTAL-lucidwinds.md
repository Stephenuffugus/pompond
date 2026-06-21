# Hand-off: add Pom Pond to the lucidwinds games portal

For the **lucidwinds portal owner/Claude**. Goal: add **Pom Pond** as a tile in the
**Creative** section, with a short intro screen, that **opens in its own tab**.

Pom Pond is already live and hosted on Firebase (Google's servers) — it runs 24/7,
independent of any dev machine. Nothing to host on your side; you're just linking to it.

## The tile

- **Section:** Games → **Creative**
- **Title:** Pom Pond
- **Subtitle / one-liner:** Chore tracker & reward center
- **Launch URL:** https://pom-pond.web.app
- **Open behavior:** **NEW TAB / full window — do NOT embed in an iframe.**
  Pom Pond uses Google/email sign-in (OAuth popups) and the "Add to Home Screen"
  install prompt; both are blocked inside iframes. It must launch out.
- **Tile image / thumbnail (hosted, use directly):** https://pom-pond.web.app/portal-thumb.png
  (512×512 cover art — a frog napping in a pod under the stars; high-res
  1024×1024 at https://pom-pond.web.app/portal-thumb-1024.png)
- **App icon (square logo, if you want a small mark instead of the cover):**
  https://pom-pond.web.app/icons/icon-512.png (or the inline SVG at the bottom of this file)

## Short description (for the tile / catalog)

> Chore tracker & reward center for families. Kids do chores and kind things, earn
> "Poms," and grow a pond full of collectible critters. Parents set the chores and
> choose the rewards kids unlock. Works on any phone — and can be added to the home
> screen so it opens like a real app.

## Intro screen copy (the little screen before launch)

**🐸 Pom Pond — Chore tracker & reward center**

Kids do chores and kind things → earn Poms → hatch collectible critters into their
own pond → fill buckets to unlock rewards a parent chooses.

- A grown-up signs up first, sets a Parent PIN, and adds the kids.
- Each kid can use it on their own phone (a join code + their 4-digit code).
- More than one grown-up? A partner or grandparent can join as a co-parent.

**[ Open Pom Pond → ]**  (links to https://pom-pond.web.app, target=_blank)

*Tip: once it opens, tap "📲 Get app" to add it to your home screen so it opens
full-screen like a real app.*

## Notes

- Free to run (Firebase free tier covers this usage).
- Stephen will share the same link directly with families too; saving to the home
  screen is optional and prompted inside the app.
- Optional future upgrade: a branded URL **pompond.lucidwinds.com** pointing at the
  same app (needs a few DNS records in the lucidwinds zone + Firebase custom-domain
  setup). Not required — the .web.app link works the same. Ask Stephen if he wants it.

## Inline tile icon (SVG, if you prefer embedding over the PNG URL)

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="22" fill="#3FA7A1"/><ellipse cx="50" cy="62" rx="28" ry="21" fill="#78d6a8"/><ellipse cx="50" cy="68" rx="15" ry="10" fill="#d9f7e4"/><circle cx="37" cy="40" r="10" fill="#78d6a8"/><circle cx="63" cy="40" r="10" fill="#78d6a8"/><circle cx="37" cy="40" r="5" fill="#fff"/><circle cx="63" cy="40" r="5" fill="#fff"/><circle cx="37" cy="41" r="2.6" fill="#222"/><circle cx="63" cy="41" r="2.6" fill="#222"/></svg>
```
