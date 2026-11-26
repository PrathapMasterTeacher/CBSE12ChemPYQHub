import { spawnSync } from 'node:child_process';
import { mkdir, readFile, copyFile, writeFile } from 'node:fs/promises';

const root = name => new URL(name, import.meta.url);
const publish = new URL('./public/', import.meta.url);
await mkdir(publish, { recursive: true });

for (const file of ['practice.js', 'site.css', 'account.html', 'account.js', 'auth-client.js', 'history.js']) {
  await copyFile(root(file), new URL(file, publish));
}

const template = await readFile(root('index.html'), 'utf8');
const sections = [
  {
    file: 'index.html', source: '2026.json', bank: 'board-2026',
    title: '2026 Board Exam PYQs',
    description: 'Practise past exam questions by chapter and review the solutions.',
    pyqCurrent: 'aria-current="page"', practiceCurrent: ''
  },
  {
    file: 'practice.html', source: 'Practice_mcq_test.json', bank: 'practice-bank',
    title: 'Practice MCQ Test',
    description: '500 MCQs across 10 chapters with instant feedback and explanations.',
    pyqCurrent: '', practiceCurrent: 'aria-current="page"'
  }
];

for (const section of sections) {
  const source = JSON.parse(await readFile(root(section.source), 'utf8'));
  const questions = Array.isArray(source) ? source : source.questions;
  if (!Array.isArray(questions) || !questions.length) {
    throw new Error('Question bank is empty: ' + section.source);
  }
  const board = section.bank === 'board-2026';
  const content = questions.map((item, index) => {
    const options = Array.isArray(item.options) ? item.options.map(String) : [];
    const type = String(item.type ?? '');
    const label = type + ' ' + (item.tag ?? '');
    const marks = Number.parseInt(item.marks ?? type, 10);
    const category = marks === 4 || /case[ -]based|competenc.*passage/i.test(label) ? 'Case-Based'
      : /assertion|a\s*[-–/]\s*r\b/i.test(label) || /^\s*(?:<[^>]+>\s*)*assertion\b/i.test(item.question ?? '') ? 'Assertion–Reason'
      : [2, 3, 5].includes(marks) ? marks + ' Marks'
      : 'MCQ';
    const scored = !board || (marks === 1 && ['MCQ', 'Assertion–Reason'].includes(category));
    const answerIndex = scored && Number.isInteger(item.answerIndex) &&
      item.answerIndex >= 0 && item.answerIndex < options.length ? item.answerIndex : null;
    return {
      id: String(item.id ?? section.bank + '-' + index),
      chapter: String(item.chapter ?? 'Mixed topics'),
      question: String(item.question ?? ''),
      options, answerIndex, category,
      solution: String(item.solution || item.answer || ''),
      paperCode: item.paperCode, marks: Number.isFinite(marks) ? marks : undefined,
      originalQuestionNumber: item.originalQuestionNumber
    };
  });
  await writeFile(new URL(section.file, publish), template.replace(/\{\{(\w+)\}\}/g, (_, name) => section[name]));
  await writeFile(new URL(section.bank + '.js', publish),
    'window.chemistryQuestions = ' + JSON.stringify(content) + ';\n');
}

const papers = spawnSync('python3', [root('build-papers.py').pathname, publish.pathname], { stdio: 'inherit' });
if (papers.error || papers.status !== 0) throw new Error('Could not build the papers page.');
