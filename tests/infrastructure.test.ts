import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../server/db';

const databases: ReturnType<typeof openDatabase>[] = [];
const directories: string[] = [];
function memory() {
  const db = openDatabase(null);
  databases.push(db);
  db.exec(readFileSync('fixtures/schema.sql', 'utf8'));
  return db;
}
afterEach(() => {
  databases.splice(0).forEach((db) => db.close());
  directories.splice(0).forEach((directory) => rmSync(directory, { recursive: true }));
});

describe('shared SQL infrastructure, not product features', () => {
  it('loads the agreed fixture and stores no separate availability status', () => {
    const db = memory();
    db.exec(readFileSync('fixtures/demo.sql', 'utf8'));
    expect(db.prepare('SELECT count(*) AS n FROM books').get()?.n).toBe(3);
    expect(db.prepare('SELECT count(*) AS n FROM copies').get()?.n).toBe(4);
    expect(db.prepare('SELECT count(*) AS n FROM loans WHERE returnedOn IS NULL').get()?.n).toBe(2);
    expect(db.prepare('PRAGMA table_info(copies)').all().some((row) => row.name === 'status')).toBe(false);
  });
  it('enforces foreign keys even after exporting a persistence snapshot', () => {
    const db = memory();
    expect(() => db.prepare('INSERT INTO copies VALUES (?, ?, ?)').run('c', 'missing', 'LIB-000001')).toThrow();
    expect(db.prepare('SELECT count(*) AS n FROM copies').get()?.n).toBe(0);
  });
  it('rejects duplicate barcodes and simultaneous active loans', () => {
    const db = memory();
    db.exec(readFileSync('fixtures/demo.sql', 'utf8'));
    expect(() => db.prepare('INSERT INTO copies VALUES (?, ?, ?)').run('new', 'book-1', 'LIB-000001')).toThrow();
    expect(() => db.prepare('INSERT INTO loans VALUES (?, ?, ?, ?, ?, ?)').run('new', 'student-2', 'copy-2', '2026-10-26', '2026-11-09', null)).toThrow();
    expect(db.prepare('SELECT count(*) AS n FROM loans').get()?.n).toBe(3);
  });
  it('rolls back an entire failed transaction', () => {
    const db = memory();
    expect(() => db.transaction(() => {
      db.prepare('INSERT INTO books VALUES (?, ?, ?)').run('b', 'תקין', 'ג–ד');
      db.prepare('INSERT INTO books VALUES (?, ?, ?)').run('b', 'כפול', 'ג–ד');
    })()).toThrow();
    expect(db.prepare('SELECT count(*) AS n FROM books').get()?.n).toBe(0);
  });
  it('supports nested transactions without breaking outer rollback', () => {
    const db = memory();
    expect(() => db.transaction(() => {
      db.prepare('INSERT INTO books VALUES (?, ?, ?)').run('a', 'ראשון', 'א–ב');
      db.transaction(() => db.prepare('INSERT INTO books VALUES (?, ?, ?)').run('b', 'שני', 'ג–ד'))();
      throw new Error('cancel outer');
    })()).toThrow('cancel outer');
    expect(db.prepare('SELECT count(*) AS n FROM books').get()?.n).toBe(0);
  });
  it('persists to a real SQLite file and reads it after reopening', () => {
    const directory = mkdtempSync(join(tmpdir(), 'library-workshop-test-'));
    directories.push(directory);
    const path = join(directory, 'library.sqlite');
    const first = openDatabase(path);
    first.exec(readFileSync('fixtures/schema.sql', 'utf8'));
    first.prepare('INSERT INTO books VALUES (?, ?, ?)').run('b', 'נשמר', 'ה–ו');
    first.close();
    const reopened = openDatabase(path);
    databases.push(reopened);
    expect(reopened.prepare('SELECT title FROM books WHERE id=?').get('b')?.title).toBe('נשמר');
    expect(readFileSync(path).subarray(0, 15).toString()).toBe('SQLite format 3');
  });
  it('does not report success or change memory when persistence fails', () => {
    const directory = mkdtempSync(join(tmpdir(), 'library-workshop-test-'));
    directories.push(directory);
    const block = join(directory, 'not-a-directory');
    writeFileSync(block, 'blocked');
    const db = openDatabase(join(block, 'library.sqlite'));
    databases.push(db);
    expect(() => db.exec('CREATE TABLE example (id TEXT)')).toThrow();
    expect(db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name='example'").get()?.n).toBe(0);
  });
});
