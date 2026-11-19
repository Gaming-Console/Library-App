import { readFileSync } from 'node:fs';
import { dailyBackup } from './autobackup';
import { createApp } from './app';
import { db, databasePath } from './db';

const port = Number(process.env.PORT ?? 3001);

// מסד חדש מקבל את המבנה הריק; מסד קיים לא נוגעים בו.
const tables = db.prepare("SELECT count(*) AS count FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").get() as { count: number };
if (tables.count === 0) db.exec(readFileSync('fixtures/schema.sql', 'utf8'));
try { dailyBackup(databasePath); } catch (error) { console.warn('הגיבוי היומי נכשל', error); }

const app = await createApp();
const server = app.listen(port, '127.0.0.1', () => {
  console.log(`מדף פועל: http://127.0.0.1:${port}`);
  console.log(`מסד הנתונים: ${databasePath}`);
});
server.on('error', (error: NodeJS.ErrnoException) => {
  console.error(error.code === 'EADDRINUSE'
    ? `הפורט ${port} תפוס. ייתכן שמדף כבר פועל בחלון אחר.`
    : `לא ניתן להפעיל את השרת: ${error.message}`);
  db.close();
  process.exitCode = 1;
});
const stop = () => server.close(() => { db.close(); process.exit(0); });
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
