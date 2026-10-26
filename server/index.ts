import { createApp } from './app';
import { db, databasePath } from './db';

const app = await createApp();
const server = app.listen(3001, '127.0.0.1', () => {
  console.log('Library API: http://127.0.0.1:3001');
  console.log(`SQLite: ${databasePath}`);
  console.log('Starter only: library operations are implemented during the workshop.');
});
server.on('error', (error) => {
  console.error('Cannot start library server', error);
  db.close();
  process.exitCode = 1;
});
const stop = () => server.close(() => { db.close(); process.exit(0); });
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
