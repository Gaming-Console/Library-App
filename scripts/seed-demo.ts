import { readFileSync } from 'node:fs';
import { db, databasePath } from '../server/db';

try {
  const tables = db.prepare("SELECT count(*) AS count FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").get() as { count: number };
  if (tables.count > 0) throw new Error('המסד אינו ריק. לא הוחלפו ולא נמחקו נתונים. לבדיקת מסד נוסף הגדירי LIBRARY_DB לנתיב חדש.');
  db.transaction(() => {
    db.exec(readFileSync('fixtures/schema.sql', 'utf8'));
    db.exec(readFileSync('fixtures/demo.sql', 'utf8'));
  })();
  console.log(`Created fictional demo data at ${databasePath}`);
} finally {
  db.close();
}
