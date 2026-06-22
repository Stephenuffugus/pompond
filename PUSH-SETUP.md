# Push notifications — turning them on (2 console steps)

Web push (daily chore reminders) is fully built. It stays **dormant** until you add a
Web-Push key, so nothing breaks before then. Two one-time steps:

## 1. Add the Web-Push (VAPID) key
1. Firebase console → **Project settings → Cloud Messaging** tab.
2. Under **Web Push certificates**, click **Generate key pair** (if none) and copy the
   **public** key (a long `B…` string).
3. Paste it into `public/js/firebase-config.js`:
   ```js
   export const vapidKey = "PASTE_THE_PUBLIC_KEY_HERE";
   ```
4. Redeploy hosting: `npx firebase deploy --only hosting`.

That's it — the **Settings → 🔔 Daily reminders** toggle goes live. Until then it shows a
"set it up in the console" hint.

## 2. The scheduler (auto)
The hourly reminder runs via a scheduled Cloud Function (`dailyReminder`). Deploying
functions on the **Blaze** plan auto-creates the Cloud Scheduler job. If the first
`deploy --only functions` asks you to enable the **Cloud Scheduler API**, accept it (or
enable it once in the Google Cloud console) and redeploy.

## How it works
- A parent flips **Settings → 🔔 Daily reminders** on, grants the browser permission, and
  picks a time. The device's push token + timezone + chosen hour are stored server-side
  (collection `pushTokens` — server-only, no child data).
- `dailyReminder` runs hourly and sends each opted-in device a gentle nudge at **its own
  local chosen time**. "Send a test" delivers one immediately.

## Notes
- **iOS:** web push only works for an **installed** PWA (Add to Home Screen) on iOS 16.4+.
  Android Chrome works in-browser. Use the in-app "📲 Get app" / Add-to-Home-Screen flow.
- Tokens are pruned automatically when a device unsubscribes or a token goes stale, and
  are deleted with the family on "Delete our family & data".
- A real **native app** (Capacitor wrap) would add App Store discovery + more reliable iOS
  push later, but this web-push path needs no app-store accounts and ships today.
