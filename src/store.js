/* ============================================================
   STORE SEAM — the single swap point between local-first and cloud.

   Local mode (default, and the ONLY mode the jsdom harness exercises):
   whole-family blob in localStorage under `pomPondV1`, exactly like
   the prototype. Cloud mode is layered on at runtime by js/cloud.js
   (Firebase), which sets `Backend.cloud` — economy mutations then
   route to Cloud Functions and live state arrives via onSnapshot.
   The local code path below is unchanged so behavior + the harness
   stay identical.
   ============================================================ */
  const LS_KEY = "pomPondV1";
  const store = {
    get(k,f){ try{ const v=localStorage.getItem(k); return v?JSON.parse(v):f; }catch(e){ return f; } },
    set(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){} }
  };

  // Backend.cloud is null until js/cloud.js (deploy-only module) activates it.
  // When active, the app routes all economy-affecting actions to the server
  // (kids can't self-credit) and receives state via snapshots.
  const Backend = {
    cloud: null,
    cloudActive(){ return !!(this.cloud && this.cloud.active); },
    loadLocal(){ return store.get(LS_KEY, null) || store.get("choreCrewV2", null); },
    saveLocal(fam){ store.set(LS_KEY, fam); }
  };
