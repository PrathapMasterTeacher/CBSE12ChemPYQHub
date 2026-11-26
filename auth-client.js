"use strict";
window.caaAuth = window.supabase?.createClient(
  "https://rytolspaeqblkeekeuqm.supabase.co",
  "sb_publishable_lbHUabh8C8bDqoWp4JilaA_zEzhjnd4",
  { auth: { flowType: "pkce" } }
);
