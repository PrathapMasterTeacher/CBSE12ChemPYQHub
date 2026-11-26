"use strict";

const byId = id => document.getElementById(id);
const chapter = byId("chapter");
const status = byId("status");
const test = byId("test");
const result = byId("result");
const next = byId("next");
let bank = [];
let questions = [];
let current = 0;
let correct = 0;
let answered = false;

async function loadBank() {
  try {
    const response = await fetch("./Practice_mcq_test.json");
    if (!response.ok) throw new Error("Question bank request failed");
    bank = await response.json();
    for (const name of new Set(bank.map(item => item.chapter))) {
      chapter.add(new Option(name, name));
    }
    chapter.disabled = false;
    byId("start").disabled = false;
    showAvailable();
  } catch {
    status.textContent = "The question bank could not load. Refresh the page to try again.";
  }
}

function availableQuestions() {
  return chapter.value ? bank.filter(item => item.chapter === chapter.value) : bank;
}

function showAvailable() {
  status.textContent = availableQuestions().length + " questions available.";
}

function showQuestion() {
  const item = questions[current];
  answered = false;
  byId("position").textContent = "Question " + (current + 1) + " of " + questions.length;
  byId("progress").max = questions.length;
  byId("progress").value = current;
  byId("question").textContent = item.question;
  byId("options").replaceChildren(...item.options.map((option, index) => {
    const label = document.createElement("label");
    label.className = "option";
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "answer";
    input.value = index;
    input.required = true;
    const text = document.createElement("span");
    text.textContent = String.fromCharCode(65 + index) + ". " + option;
    label.append(input, text);
    return label;
  }));
  byId("choices").disabled = false;
  byId("check").disabled = false;
  byId("feedback").hidden = true;
  next.hidden = true;
  byId("question").focus();
}

chapter.addEventListener("change", showAvailable);

byId("setup").addEventListener("submit", event => {
  event.preventDefault();
  if (!bank.length) return;
  const candidates = [...availableQuestions()];
  for (let index = candidates.length - 1; index > 0; index--) {
    const other = Math.floor(Math.random() * (index + 1));
    [candidates[index], candidates[other]] = [candidates[other], candidates[index]];
  }
  const count = byId("count").value;
  questions = candidates.slice(0, count === "all" ? candidates.length : Number(count));
  current = 0;
  correct = 0;
  result.hidden = true;
  test.hidden = false;
  showQuestion();
});

byId("question-form").addEventListener("submit", event => {
  event.preventDefault();
  const picked = event.currentTarget.querySelector("input:checked");
  if (!picked || answered) return;
  answered = true;
  const item = questions[current];
  const isCorrect = Number(picked.value) === item.answerIndex;
  correct += Number(isCorrect);
  byId("progress").value = current + 1;
  byId("choices").disabled = true;
  byId("check").disabled = true;
  const feedback = byId("feedback");
  feedback.classList.toggle("correct", isCorrect);
  feedback.hidden = false;
  feedback.textContent = (isCorrect ? "Correct." : "Incorrect.") + " Answer: " +
    item.options[item.answerIndex] + "\n\n" + item.solution;
  next.textContent = current + 1 === questions.length ? "View score" : "Next question";
  next.hidden = false;
  next.focus();
});

next.addEventListener("click", () => {
  if (!answered) return;
  current++;
  if (current < questions.length) {
    showQuestion();
    return;
  }
  test.hidden = true;
  result.hidden = false;
  const score = byId("score");
  score.textContent = correct + " out of " + questions.length + " correct (" +
    Math.round(100 * correct / questions.length) + "%)";
  score.focus();
});

byId("again").addEventListener("click", () => {
  result.hidden = true;
  chapter.focus();
});

loadBank();
