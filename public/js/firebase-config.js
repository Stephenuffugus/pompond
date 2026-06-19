/* Pom Pond — Firebase web config.
   Replace these placeholder values with your project's config from
   Firebase console → Project settings → Your apps → Web app (SDK config).

   While the apiKey still reads "REPLACE_ME", the cloud layer stays DORMANT and
   the app runs in local-first mode (localStorage) — so you can open index.html
   and use it offline before wiring Firebase. Filling this in turns on auth +
   cloud sync automatically. These values are NOT secrets (web config is public);
   real security lives in firestore.rules + the Cloud Functions. */
export const firebaseConfig = {
  apiKey: "AIzaSyBQehiZrzCvikQ7ry8Bs0vTczaaCYRRVv0",
  authDomain: "pom-pond.firebaseapp.com",
  projectId: "pom-pond",
  storageBucket: "pom-pond.firebasestorage.app",
  messagingSenderId: "802506405237",
  appId: "1:802506405237:web:e976c8b7f213fec1c18f3c",
  measurementId: "G-LXZWC8MVP0"
};

// Set true while developing against the local emulator suite (firebase emulators:start).
export const useEmulators = false;
