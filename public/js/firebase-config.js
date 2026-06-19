/* Pom Pond — Firebase web config.
   Replace these placeholder values with your project's config from
   Firebase console → Project settings → Your apps → Web app (SDK config).

   While the apiKey still reads "REPLACE_ME", the cloud layer stays DORMANT and
   the app runs in local-first mode (localStorage) — so you can open index.html
   and use it offline before wiring Firebase. Filling this in turns on auth +
   cloud sync automatically. These values are NOT secrets (web config is public);
   real security lives in firestore.rules + the Cloud Functions. */
export const firebaseConfig = {
  apiKey: "REPLACE_ME",
  authDomain: "REPLACE_ME.firebaseapp.com",
  projectId: "REPLACE_ME",
  storageBucket: "REPLACE_ME.appspot.com",
  messagingSenderId: "REPLACE_ME",
  appId: "REPLACE_ME"
};

// Set true while developing against the local emulator suite (firebase emulators:start).
export const useEmulators = false;
