import { mkdir, readFile, copyFile, writeFile } from 'node:fs/promises';

const publish = new URL('./public/', import.meta.url);
await mkdir(publish, { recursive: true });
for (const file of ['index.html', 'practice.js', 'site.css']) {
  await copyFile(new URL(file, import.meta.url), new URL(file, publish));
}
const bank = JSON.parse(await readFile(new URL('./Practice_mcq_test.json', import.meta.url), 'utf8'));
if (!Array.isArray(bank) || !bank.length) throw new Error('The practice question bank is empty.');
const content = bank.map(({ id, chapter, question, options, answerIndex, solution }) => ({
  id, chapter, question, options, answerIndex, solution
}));
await writeFile(new URL('question-bank.js', publish), 'window.chemistryQuestions = ' + JSON.stringify(content) + ';\n');
