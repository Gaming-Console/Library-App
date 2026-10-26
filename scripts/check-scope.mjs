import { execFileSync } from 'node:child_process';
import { tasks } from '../materials/tasks.mjs';

const slug = process.argv[2];
if (!tasks.some((task) => task.slug === slug)) throw new Error('Usage: npm run check:scope -- 09-circulation');
function git(args) { return execFileSync('git', args, { encoding: 'utf8' }).trim(); }
let base = 'origin/main';
try { git(['rev-parse', '--verify', base]); }
catch { base = 'main'; git(['rev-parse', '--verify', base]); }
const files = new Set([
  ...git(['diff', '--name-only', `${base}...HEAD`]).split('\n'),
  ...git(['diff', '--name-only', 'HEAD']).split('\n'),
  ...git(['ls-files', '--others', '--exclude-standard']).split('\n'),
].filter(Boolean));
const allowed = (file) => file.startsWith(`src/features/${slug}/`) || file === `server/features/${slug}.ts` || file === `server/features/${slug}.test.ts`;
const invalid = [...files].filter((file) => !allowed(file));
if (invalid.length) {
  console.error('Changes outside assigned task:\n' + invalid.join('\n'));
  process.exitCode = 1;
} else console.log(`Scope OK: ${slug} (${files.size} changed files)`);
