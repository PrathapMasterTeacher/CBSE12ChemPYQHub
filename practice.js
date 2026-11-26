"use strict";

const get = id => document.getElementById(id);
const bank = window.chemistryQuestions || [];
const chapter = get("chapter");
const filter = get("status-filter");
const summary = get("summary");
const container = get("questions");
const pageSize = 10;
const isBoard = !!document.querySelector('script[src="./board-2026.js"]');
const key = isBoard ? "chemistry-hub-pyq-2026-v1" : "chemistry-hub-progress-v1";
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
    case "new": return item.answerIndex !== null && !hasAnswer(item);
    case "correct": return entry(item).answer === item.answerIndex;
    case "wrong": return hasAnswer(item) && entry(item).answer !== item.answerIndex;
    case "starred": return entry(item).starred === true;
    default: return true;
  }
}

function updateProgress() {
  const pool = chapterQuestions().filter(item => item.answerIndex !== null);
  const attempted = pool.filter(hasAnswer).length;
  const correct = pool.filter(item => entry(item).answer === item.answerIndex).length;
  const starred = chapterQuestions().filter(item => entry(item).starred).length;
  summary.textContent = attempted + " / " + pool.length + " MCQs answered · " + correct +
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

const formattingTags = new Set(["sub", "sup", "br", "p", "div", "span", "b", "strong", "i", "em", "small", "ul", "ol", "li", "table", "thead", "tbody", "tr", "td", "th"]);
const svgTags = new Set(["svg", "g", "path", "text", "line", "polyline", "polygon", "circle", "ellipse", "rect"]);
const svgAttributes = new Set(["viewBox", "width", "height", "d", "fill", "stroke", "stroke-width", "points", "x", "y", "x1", "y1", "x2", "y2", "cx", "cy", "r", "rx", "ry", "font-size", "text-anchor", "transform", "role", "aria-label"]);

function copyQuestionNode(source, target) {
  if (source.nodeType === 3) {
    target.append(document.createTextNode(source.textContent));
    return;
  }
  if (source.nodeType !== 1) return;
  const tag = source.localName;
  if (["script", "style", "iframe", "object", "foreignObject"].includes(tag)) return;
  let copy;
  if (source.namespaceURI === "http://www.w3.org/2000/svg" && svgTags.has(tag)) {
    copy = document.createElementNS(source.namespaceURI, tag);
    for (const { name, value } of source.attributes) {
      if (svgAttributes.has(name) && !/url\s*\(/i.test(value)) copy.setAttribute(name, value);
    }
  } else if (tag === "img") {
    const src = source.getAttribute("src") || "";
    if (!/^data:image\/(?:png|jpe?g|gif|webp);base64,[A-Za-z0-9+/=\s]+$/i.test(src)) return;
    copy = document.createElement("img");
    copy.alt = source.getAttribute("alt") || "Question illustration";
    copy.src = src;
    copy.loading = "lazy";
  } else if (formattingTags.has(tag)) {
    copy = document.createElement(tag);
  }
  for (const child of source.childNodes) copyQuestionNode(child, copy || target);
  if (copy) target.append(copy);
}

function setChemistryText(node, text) {
  const template = document.createElement("template");
  template.innerHTML = text;
  node.replaceChildren();
  for (const child of template.content.childNodes) copyQuestionNode(child, node);
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
  const details = ["Question " + number, item.chapter];
  if (item.paperCode) details.push("Paper " + item.paperCode);
  if (item.originalQuestionNumber) details.push("Q" + item.originalQuestionNumber);
  if (item.marks) details.push(item.marks + (Number(item.marks) === 1 ? " mark" : " marks"));
  top.append(element("p", details.join(" · ")));
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
  const title = element("h3");
  setChemistryText(title, item.question);
  title.id = item.id + "-title";
  node.setAttribute("aria-labelledby", title.id);
  const options = element("div", "", "options");
  const actions = element("div", "", "card-actions");
  const reveal = button("Show answer & explanation", "primary");
  const retry = button("Try again");
  const feedback = element("p", "", "feedback");
  feedback.setAttribute("role", "status");
  let revealed = false;
  const graded = item.answerIndex !== null;
  if (!graded) options.append(element("p", "Work out your answer, then reveal the solution to check it."));

  const choices = item.options.map((option, index) => {
    const choice = button("", "option");
    setChemistryText(choice, String.fromCharCode(65 + index) + ". " + option);
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
      choice.disabled = show || !graded;
      choice.classList.toggle("correct", show && index === item.answerIndex);
      choice.classList.toggle("wrong", answered && index === selected && selected !== item.answerIndex);
    });
    feedback.hidden = !show;
    reveal.hidden = show;
    retry.hidden = !show;
    setChemistryText(feedback, show ?
      (answered ? (selected === item.answerIndex ? "Correct. " : "Incorrect. ") : "") +
      (graded ? "Answer: " + String.fromCharCode(65 + item.answerIndex) + ".<br>" : "") +
      (item.solution || (graded ? item.options[item.answerIndex] : "Solution unavailable.")) : "");
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
    (graded ? choices[0] : reveal).focus();
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
    const first = chapterQuestions().find(item => item.answerIndex !== null && !hasAnswer(item));
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
