// מפעיל את מדף בלחיצה אחת: בונה אם צריך, מפעיל מחדש אם השרת נופל, ופותח את הדפדפן.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, statSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const port = Number(process.env.PORT ?? 3001);
const url = `http://127.0.0.1:${port}`;
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const run = (args) => spawnSync(npx, args, { stdio: 'inherit', shell: process.platform === 'win32' });

function newest(dir) {
  let latest = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    latest = Math.max(latest, entry.isDirectory() ? newest(path) : statSync(path).mtimeMs);
  }
  return latest;
}

const built = existsSync('dist/index.html') ? statSync('dist/index.html').mtimeMs : 0;
if (built < Math.max(newest('src'), statSync('index.html').mtimeMs)) {
  console.log('בונה את האפליקציה (פעם אחת, כדקה)…');
  if (run(['vite', 'build']).status !== 0) { console.error('הבנייה נכשלה.'); process.exit(1); }
}
if (!existsSync('data/library.sqlite') && process.argv.includes('--demo')) run(['tsx', 'scripts/seed-demo.ts']);

async function alreadyRunning() {
  try { return (await fetch(`${url}/api/health`)).ok; } catch { return false; }
}
function openBrowser() {
  const [cmd, args] = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]]
    : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  spawn(cmd, args, { stdio: 'ignore', detached: true }).on('error', () => console.log(`פתחי בדפדפן: ${url}`)).unref();
}

if (await alreadyRunning()) { console.log('מדף כבר פועל. פותח את הדפדפן.'); openBrowser(); process.exit(0); }

let opened = false;
let stopping = false;
function start() {
  const child = spawn(npx, ['tsx', 'server/index.ts'], { stdio: 'inherit', shell: process.platform === 'win32' });
  const poll = setInterval(async () => {
    if (await alreadyRunning()) { clearInterval(poll); if (!opened) { opened = true; openBrowser(); } }
  }, 500);
  child.on('exit', (code) => {
    clearInterval(poll);
    if (stopping || code === 0) process.exit(code ?? 0);
    console.error('השרת נעצר בלי התרעה. מפעיל מחדש בעוד שנייה…');
    setTimeout(start, 1000);
  });
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { stopping = true; child.kill(signal); });
}
start();
