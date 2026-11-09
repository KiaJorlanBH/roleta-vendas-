"use strict";

(() => {
  const SESSION_KEY = "jorlan-sales-wheel-manager-session-v1";
  const frame = document.querySelector(".manager-frame");

  async function authorizeManager() {
    try {
      const backend = window.jorlanSupabase;
      if (!backend?.isConfigured) {
        window.location.replace("login.html");
        return;
      }

      const { data: sessionData, error: sessionError } = await backend.client.auth.getSession();
      if (sessionError) throw sessionError;
      if (!sessionData.session) {
        window.sessionStorage.removeItem(SESSION_KEY);
        window.location.replace("login.html");
        return;
      }

      const { data: isManager, error: authorizationError } = await backend.client.rpc("is_manager");
      if (authorizationError) throw authorizationError;
      if (isManager !== true) {
        await backend.client.auth.signOut();
        window.sessionStorage.removeItem(SESSION_KEY);
        window.location.replace("login.html");
        return;
      }

      window.sessionStorage.setItem(SESSION_KEY, "authenticated");
      frame.src = "index.html?painel=1";
      frame.hidden = false;
    } catch {
      console.error("Manager authorization failed; details omitted.");
      window.sessionStorage.removeItem(SESSION_KEY);
      window.location.replace("login.html");
    }
  }

  authorizeManager();
})();
