(() => {
  "use strict";
  const client = window.caaAuth;
  if (!client) return;
  const get = id => document.getElementById(id);
  const panel = get("history");
  const status = get("history-status");
  const rows = get("history-rows");
  const previous = get("history-prev");
  const next = get("history-next");
  const pageSize = 25;
  let userId;
  let teacher = false;
  let page = 0;
  let request = 0;

  async function load() {
    const id = ++request;
    rows.replaceChildren();
    previous.disabled = next.disabled = true;
    if (!userId) return;
    status.textContent = "Loading practice history…";
    let query = client.from("caa_practice_attempts")
      .select("attempted_at,email,quiz,chapter,question_id,correct")
      .order("attempted_at", { ascending: false }).order("user_id").order("quiz").order("question_id");
    if (!teacher) query = query.eq("user_id", userId);
    const email = get("student-email").value.trim();
    if (teacher && email) query = query.eq("email", email);
    const { data, error } = await query.range(page * pageSize, page * pageSize + pageSize);
    if (id !== request) return;
    previous.disabled = page === 0;
    if (error) {
      status.textContent = "Practice history is unavailable. Check that the Supabase database setup is complete.";
      return;
    }
    next.disabled = data.length <= pageSize;
    status.textContent = data.length
      ? "Page " + (page + 1) + " · First submitted answers from signed-in practice."
      : "No practice attempts found.";
    for (const entry of data.slice(0, pageSize)) {
      const row = document.createElement("tr");
      const values = [new Date(entry.attempted_at).toLocaleString()];
      if (teacher) values.push(entry.email || "—");
      values.push(entry.quiz === "board-2026" ? "2026 Board PYQs" : entry.question_id.startsWith("mcq-test-1-") ? "MCQ Test 1" : "MCQ Practice", entry.chapter, entry.correct ? "1 / 1" : "0 / 1");
      for (const value of values) {
        const cell = document.createElement("td");
        cell.textContent = value;
        row.append(cell);
      }
      rows.append(row);
    }
  }

  async function update(session) {
    const id = ++request;
    userId = null;
    panel.hidden = !session;
    rows.replaceChildren();
    get("history-filter").hidden = true;
    get("student-column").hidden = true;
    if (!session) {
      get("student-email").value = "";
      return;
    }
    status.textContent = "Checking access…";
    const { data } = await client.from("caa_teachers").select("user_id")
      .eq("user_id", session.user.id).maybeSingle();
    if (id !== request) return;
    teacher = Boolean(data);
    userId = session.user.id;
    page = 0;
    get("history-heading").textContent = teacher ? "Teacher Dashboard" : "My practice history";
    get("history-filter").hidden = !teacher;
    get("student-column").hidden = !teacher;
    await load();
  }

  previous.addEventListener("click", () => { if (page) { page--; void load(); } });
  next.addEventListener("click", () => { page++; void load(); });
  get("history-filter").addEventListener("submit", event => { event.preventDefault(); page = 0; void load(); });
  client.auth.onAuthStateChange((event, session) => {
    if (event !== "TOKEN_REFRESHED") setTimeout(() => void update(session), 0);
  });
})();
