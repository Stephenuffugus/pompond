# Hand-off: pointing pompond.lucidwinds.com at Pom Pond

**To:** the Claude that manages the lucidwinds.com site/infra/DNS.
**From:** the Pom Pond build (a separate repo Stephen owns).
**Ask:** add DNS so **`pompond.lucidwinds.com`** serves the Pom Pond app, which is
deployed on **Firebase Hosting**. Stephen is relaying this and the exact records.

## TL;DR of what you need to do

Pom Pond is a static SPA + Cloud Functions hosted on Firebase. Stephen will run the
Firebase deploy himself and then, in the Firebase console, add the custom domain
`pompond.lucidwinds.com`. Firebase will generate the **exact DNS records** to use.
**Your job is just to add those records to the lucidwinds.com DNS zone.**

They'll be one of:
- **A subdomain CNAME** — `pompond` → `<project>.web.app` (simplest if your DNS allows
  CNAME on the subdomain and there's no conflicting record), **or**
- **Two A records** for `pompond` (Firebase-provided IPv4s, e.g. `151.101.x.x`) **plus
  a TXT record** on `pompond` for domain verification.

Stephen will paste you the precise values from the Firebase console — please add them
verbatim to the `lucidwinds.com` zone. After propagation Firebase auto-provisions the
SSL cert; nothing to do on your side for HTTPS.

## Important: do NOT proxy/rewrite it through the main lucidwinds app

This subdomain should resolve **directly to Firebase Hosting**, not be reverse-proxied
by the lucidwinds server. The app relies on Firebase Auth + Firestore from the browser;
a proxy that strips headers or changes the origin will break sign-in (the auth domain
must match). A plain DNS subdomain pointing at Firebase is correct.

## What it is (context)

- Family chore/kindness reward PWA. Static front-end (`public/`) + Firebase Auth,
  Cloud Firestore, and Cloud Functions (server-authoritative economy). Security is in
  `firestore.rules` + the functions; the web config in the front-end is public and not
  a secret.
- Repo layout, architecture, and full deploy steps: `README.md` and `DEPLOY.md` in the
  Pom Pond repo (Stephen can share access — he says you already have his repos).

## If you'll be doing the *deploys* (not just DNS)

Stephen's default plan is to deploy from his Codespace. If instead you'll deploy from
CI/your environment on `main`, you'll need:
- access to the **Firebase project** Stephen creates (he can add your Google account as
  an Editor, or generate a CI token: `firebase login:ci`), and
- `npm install` at root **and** in `functions/`, then `npm run deploy` (it builds first).
- Required tests to gate a deploy: `npm test` (harness 21 + economy 17),
  `npm run test:rules` (26), `npm run smoke` (16). All currently green.

## One question back to Stephen (please confirm before DNS)

- Is `lucidwinds.com` DNS managed somewhere that supports adding a subdomain record
  (Cloudflare / registrar / etc.), and is `pompond` currently unused? If it's behind
  Cloudflare, set the `pompond` record to **DNS-only (grey cloud)** so Firebase can
  issue its own cert.
