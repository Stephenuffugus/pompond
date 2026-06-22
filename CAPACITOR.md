# Native app wrap (Capacitor) — Android (+ iOS)

Pom Pond is a PWA. **First try installing the PWA** — it's the fastest path and now
hardened (see below). A native Capacitor build is the Play-Store path; it needs a machine
with **Android Studio + JDK 17** (the APK can't be built/signed in the Codespace).

## The PWA is the quick win (no build needed)
On Android Chrome: open https://pom-pond.web.app → the in-app **📲 Get app** button installs
it in one tap (or Chrome ⋮ menu → *Add to Home screen → Install*). **It lands in your app
drawer** (swipe up) — long-press to drag it to the home screen. It then runs full-screen
like a real app. (Manifest now uses an absolute `start_url`/`scope` + `id` so Chrome reliably
treats it as installable.)

## Native build (Capacitor) — the wrap is configured here
`capacitor.config.json` is set up to load the live site (`server.url =
https://pom-pond.web.app`), so the native shell always mirrors the deployed PWA — no
rebuild per change. To produce an installable app on a dev machine:

```bash
# 1. install Capacitor (once)
npm i -D @capacitor/cli @capacitor/core @capacitor/android
npx cap add android            # generates the android/ project from capacitor.config.json

# 2. open in Android Studio and build
npx cap open android           # → Build > Build APK(s), or Run on a connected Pixel
# (for Play Store: Build > Generate Signed Bundle/APK → create a keystore → .aab)
```

Install the resulting APK on your Pixel via USB (Android Studio "Run") or by sideloading the
APK file. The `android/` folder is generated (git-ignored) — regenerate with `cap add android`.

## Native push (optional, later)
The web-push path (FCM, see PUSH-SETUP.md) already works in the installed PWA. For *native*
push in the Capacitor app:
1. `npm i @capacitor/push-notifications`
2. Add the Android app in the Firebase console, download **google-services.json** into
   `android/app/`.
3. Register the device token (PushNotifications.register) and send to it via the same
   `pushTokens` pipeline.

## iOS (later)
`npx cap add ios` + open in Xcode (needs a Mac + Apple Developer account). iOS push needs an
APNs key in the Firebase console.
