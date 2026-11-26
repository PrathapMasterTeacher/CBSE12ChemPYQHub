"use strict";

const get = id => document.getElementById(id);
const status = get("auth-status");
const client = window.supabase?.createClient(
  "https://rytolspaeqblkeekeuqm.supabase.co",
  "sb_publishable_lbHUabh8C8bDqoWp4JilaA_zEzhjnd4",
  { auth: { flowType: "pkce" } }
);
let pendingEmail = "";
let busy = false;

function showSession(session) {
  get("sign-in").hidden = Boolean(session);
  get("signed-in").hidden = !session;
  get("identity").textContent = session?.user.email || "";
  if (session) {
    pendingEmail = "";
    get("verify-code").hidden = true;
    get("code").value = "";
    status.textContent = "";
  }
}

async function run(button, action, failure) {
  if (busy) return;
  busy = true;
  button.disabled = true;
  status.textContent = "";
  try {
    await action();
  } catch {
    status.textContent = failure;
  } finally {
    button.disabled = false;
    busy = false;
  }
}

async function initialize() {
  if (!client) {
    status.textContent = "Sign-in could not load. Refresh the page to try again.";
    return;
  }
  const { data, error } = await client.auth.getSession();
  showSession(data.session);
  const callback = new URLSearchParams(location.search);
  status.textContent = error || callback.has("error") || (callback.has("code") && !data.session)
    ? "Sign-in could not finish. Please try again." : "";
  if (callback.has("code") || callback.has("error")) {
    history.replaceState(null, "", location.pathname);
  }
  client.auth.onAuthStateChange((event, session) => {
    if (event !== "INITIAL_SESSION") showSession(session);
  });

  get("google").addEventListener("click", event => run(event.currentTarget, async () => {
    const { error } = await client.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: new URL("./account.html", location.href).href }
    });
    if (error) throw error;
  }, "Google sign-in could not start. Try again or use email."));

  get("send-code").addEventListener("submit", event => {
    event.preventDefault();
    const email = get("email").value.trim();
    run(event.submitter || get("send-code").querySelector("button"), async () => {
      pendingEmail = "";
      get("verify-code").hidden = true;
      get("code").value = "";
      const { error } = await client.auth.signInWithOtp({ email });
      if (error) throw error;
      pendingEmail = email;
      get("verify-code").hidden = false;
      get("code").focus();
      status.textContent = "Check " + email + " for your sign-in code.";
    }, "Could not send a code. Check the email address and try again in a minute.");
  });

  get("verify-code").addEventListener("submit", event => {
    event.preventDefault();
    if (!pendingEmail) return;
    run(event.submitter || get("verify-code").querySelector("button"), async () => {
      const { error } = await client.auth.verifyOtp({
        email: pendingEmail, token: get("code").value.trim(), type: "email"
      });
      if (error) throw error;
    }, "This code could not be verified. Check it or request a new code.");
  });

  get("sign-out").addEventListener("click", event => run(event.currentTarget, async () => {
    const { error } = await client.auth.signOut({ scope: "local" });
    if (error) throw error;
  }, "Could not sign out. Please try again."));
}
initialize().catch(() => { status.textContent = "Sign-in is unavailable. Try again shortly."; });
