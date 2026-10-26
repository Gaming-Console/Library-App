import { existsSync, readFileSync } from 'node:fs';
import { tasks } from '../materials/tasks.mjs';

const errors = [];
const check = (condition, message) => { if (!condition) errors.push(message); };
check(tasks.length === 12 && new Set(tasks.map((task) => task.id)).size === 12, 'Expected 12 distinct tasks');
check(tasks.filter((task) => task.api.some(([method, path]) => method === 'POST' && path.startsWith('/circulation/'))).length === 1, 'Circulation must have one owner');
for (const task of tasks) {
  check(existsSync(`docs/tasks/${task.slug}.md`), `Missing Markdown card: ${task.slug}`);
  check(existsSync(`public/workshop/cards/${task.slug}.md`), `Missing downloadable card: ${task.slug}`);
  for (const dependency of task.depends) check(tasks.some((item) => item.id === dependency), `Unknown dependency ${dependency}`);
  check(task.ui.length >= 3 && task.tests.length >= 3, `Incomplete card ${task.id}`);
}
const generated = readFileSync('public/workshop/tasks.js', 'utf8');
const json = generated.split('window.WORKSHOP_TASKS = ')[1].split(';\nwindow.WORKSHOP_GUIDES')[0];
check(JSON.stringify(JSON.parse(json)) === JSON.stringify(tasks), 'Generated tasks are stale: run npm run kit:generate');
const mockups = readFileSync('public/workshop/reference.js', 'utf8');
for (const task of tasks) check(mockups.includes(`'${task.id}':`), `Missing UI mockup ${task.id}`);
for (const file of ['public/workshop/barcode.svg', 'public/workshop/samples/books.xlsx', 'public/workshop/samples/students.xlsx']) check(existsSync(file), `Missing ${file}`);
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log('Kit OK: 12 cards, 12 reference screens, unified circulation, synchronized browser data and samples.');
