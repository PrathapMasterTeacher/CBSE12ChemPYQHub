"use strict";

const get = id => document.getElementById(id);
const bank = window.chemistryQuestions || [];
const chapter = get("chapter");
const filter = get("status-filter");
const summary = get("summary");
const container = get("questions");
const pageSize = 10;
const key = "chemistry-hub-progress-v1";
let saved = {};
let page = 0;
let visible = [];

try {
  const data = JSON.parse(localStorage.getItem(key) || "{}");
  if (data && typeof data === "object" && !Array.isArray(data)) saved = data;
} catch {
  get("storage-note").hidden = false;
}

function save() {
  try {
    localStorage.setItem(key, JSON.stringify(saved));
  } catch {
    get("storage-note").hidden = false;
  }
}

function entry(item) {
  return saved[item.id] || {};
}

function hasAnswer(item) {
  const answer = entry(item).answer;
  return Number.isInteger(answer) && answer >= 0 && answer < item.options.length;
}

function chapterQuestions() {
  return chapter.value ? bank.filter(item => item.chapter === chapter.value) : bank;
}

function matches(item) {
  switch (filter.value) {
    case "new": return !hasAnswer(item);
    case "correct": return entry(item).answer === item.answerIndex;
    case "wrong": return hasAnswer(item) && entry(item).answer !== item.answerIndex;
    case "starred": return entry(item).starred === true;
    default: return true;
  }
}

function updateProgress() {
  const pool = chapterQuestions();
  const attempted = pool.filter(hasAnswer).length;
  const correct = pool.filter(item => entry(item).answer === item.answerIndex).length;
  const starred = pool.filter(item => entry(item).starred).length;
  summary.textContent = attempted + " / " + pool.length + " answered · " + correct +
    " correct · " + (attempted - correct) + " incorrect · " + starred + " starred";
  get("progress").max = pool.length || 1;
  get("progress").value = attempted;
  get("resume").disabled = attempted === pool.length;
}

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function button(text, className) {
  const node = element("button", text, className);
  node.type = "button";
  return node;
}

function card(item, number) {
  const node = element("article", "", "card");
  node.id = item.id;
  node.tabIndex = -1;
  const top = element("div", "", "card-top");
  top.append(element("p", "Question " + number + " · " + item.chapter));
  const star = button("☆ Star", "star");
  function updateStar() {
    const starred = entry(item).starred === true;
    star.textContent = starred ? "★ Starred" : "☆ Star";
    star.setAttribute("aria-pressed", String(starred));
  }
  star.addEventListener("click", () => {
    saved[item.id] = { ...entry(item), starred: !entry(item).starred };
    save();
    updateStar();
    updateProgress();
  });
  updateStar();
  top.append(star);
  const title = element("h3", item.question);
  title.id = item.id + "-title";
  node.setAttribute("aria-labelledby", title.id);
  const options = element("div", "", "options");
  const actions = element("div", "", "card-actions");
  const reveal = button("Show answer & explanation", "primary");
  const retry = button("Try again");
  const feedback = element("p", "", "feedback");
  feedback.setAttribute("role", "status");
  let revealed = false;

  const choices = item.options.map((option, index) => {
    const choice = button(String.fromCharCode(65 + index) + ". " + option, "option");
    choice.addEventListener("click", () => {
      if (hasAnswer(item) || revealed) return;
      saved[item.id] = { ...entry(item), answer: index };
      save();
      updateProgress();
      refresh();
      retry.focus();
    });
    return choice;
  });

  function refresh() {
    const answered = hasAnswer(item);
    const selected = entry(item).answer;
    const show = answered || revealed;
    choices.forEach((choice, index) => {
      choice.disabled = show;
      choice.classList.toggle("correct", show && index === item.answerIndex);
      choice.classList.toggle("wrong", answered && index === selected && selected !== item.answerIndex);
    });
    feedback.hidden = !show;
    reveal.hidden = show;
    retry.hidden = !show;
    feedback.textContent = show ?
      (answered ? (selected === item.answerIndex ? "Correct. " : "Incorrect. ") : "") +
      "Answer: " + String.fromCharCode(65 + item.answerIndex) + ". " +
      item.options[item.answerIndex] + "\n\n" + item.solution : "";
  }

  reveal.addEventListener("click", () => {
    revealed = true;
    refresh();
    retry.focus();
  });
  retry.addEventListener("click", () => {
    revealed = false;
    if (hasAnswer(item)) {
      delete saved[item.id].answer;
      save();
      updateProgress();
    }
    refresh();
    choices[0].focus();
  });
  options.append(...choices);
  actions.append(reveal, retry);
  node.append(top, title, options, actions, feedback);
  refresh();
  return node;
}

function render() {
  visible = chapterQuestions().filter(matches);
  const pages = Math.ceil(visible.length / pageSize);
  page = Math.max(0, Math.min(page, pages - 1));
  const start = page * pageSize;
  get("chapter-heading").textContent = chapter.value || "Practice questions";
  get("page-info").textContent = visible.length ?
    (start + 1) + "–" + Math.min(start + pageSize, visible.length) + " of " + visible.length : "";
  container.replaceChildren(...visible.slice(start, start + pageSize).map((item, index) => card(item, start + index + 1)));
  if (!visible.length) container.append(element("p", "No questions match this filter."));
  get("pagination").hidden = pages <= 1;
  get("previous").disabled = page === 0;
  get("next").disabled = page >= pages - 1;
  updateProgress();
}

function goToTopCard() {
  container.firstElementChild?.focus();
}

if (bank.length) {
  const counts = new Map();
  for (const item of bank) counts.set(item.chapter, (counts.get(item.chapter) || 0) + 1);
  for (const [name, count] of counts) chapter.add(new Option(name + " (" + count + ")", name));
  chapter.disabled = false;
  filter.disabled = false;
  for (const control of [chapter, filter]) control.addEventListener("change", () => { page = 0; render(); });
  get("previous").addEventListener("click", () => { page--; render(); goToTopCard(); });
  get("next").addEventListener("click", () => { page++; render(); goToTopCard(); });
  get("resume").addEventListener("click", () => {
    const first = chapterQuestions().find(item => !hasAnswer(item));
    if (!first) return;
    filter.value = "new";
    page = 0;
    render();
    get(first.id)?.focus();
  });
  render();
} else {
  summary.textContent = "The question bank could not load. Refresh this page to try again.";
}
