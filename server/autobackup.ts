import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';

const KEEP = 14;

/** גיבוי יומי אוטומטי של קובץ המסד. נשמרים 14 הגיבויים האחרונים, בתיקייה backups לצד המסד. */
export function dailyBackup(databasePath: string, now = new Date()): string | null {
  if (!existsSync(databasePath)) return null;
  const folder = join(dirname(databasePath), 'backups');
  mkdirSync(folder, { recursive: true });
  const stamp = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
  const target = join(folder, `library-${stamp}.sqlite`);
  if (!existsSync(target)) copyFileSync(databasePath, target);
  const old = readdirSync(folder).filter((name) => /^library-\d{4}-\d{2}-\d{2}\.sqlite$/.test(name)).sort().slice(0, -KEEP);
  for (const name of old) rmSync(join(folder, name), { force: true });
  return target;
}
