import express from 'express';
import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Server } from 'node:http';
import { openDatabase } from '../db';
import { createSettingsRouter } from './12-settings';

const servers: Server[] = [];
const databases: ReturnType<typeof openDatabase>[] = [];
const directories: string[] = [];

async function serve(database: ReturnType<typeof openDatabase>) {
  const app = express();
  app.use(express.json());
  app.use('/api', createSettingsRouter(database));
  const server = app.listen(0, '127.0.0.1');
  servers.push(server);
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No test listener');
  return { server, base: `http://127.0.0.1:${address.port}/api/settings` };
}

async function setup(path: string | null = null) {
  const database = openDatabase(path);
  databases.push(database);
  database.exec(readFileSync('fixtures/schema.sql', 'utf8'));
  database.exec(readFileSync('fixtures/demo.sql', 'utf8'));
  return { database, ...await serve(database) };
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  })));
  databases.splice(0).forEach((database) => database.close());
  directories.splice(0).forEach((directory) => rmSync(directory, { recursive: true }));
});

describe('settings API', () => {
  it('loads and saves the single settings row without changing existing loans', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'library-settings-test-'));
    directories.push(directory);
    const path = join(directory, 'library.sqlite');
    const { database, server, base } = await setup(path);
    const existingDueDates = database.prepare('SELECT id, dueOn FROM loans ORDER BY id').all();

    const initial = await fetch(base);
    expect(initial.status).toBe(200);
    expect(await initial.json()).toEqual({
      libraryName: 'מדף — ספריית בית הספר',
      loanDays: 14,
      maxActiveLoans: 3,
    });

    const saved = await fetch(base, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ libraryName: 'ספריית נחל', loanDays: 21, maxActiveLoans: 5 }),
    });
    expect(saved.status).toBe(200);
    expect(await saved.json()).toEqual({ libraryName: 'ספריית נחל', loanDays: 21, maxActiveLoans: 5 });
    expect(database.prepare('SELECT count(*) AS count FROM settings').get()?.count).toBe(1);
    expect(database.prepare('SELECT id, dueOn FROM loans ORDER BY id').all()).toEqual(existingDueDates);

    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    servers.splice(servers.indexOf(server), 1);
    database.close();
    databases.splice(databases.indexOf(database), 1);
    const reopenedDatabase = openDatabase(path);
    databases.push(reopenedDatabase);
    const reopened = await serve(reopenedDatabase);
    const reloaded = await fetch(reopened.base);
    expect(await reloaded.json()).toEqual({ libraryName: 'ספריית נחל', loanDays: 21, maxActiveLoans: 5 });
  });

  it.each([0, 1.5, 91])('rejects loanDays=%s', async (loanDays) => {
    const { base } = await setup();
    const response = await fetch(base, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ libraryName: 'ספרייה', loanDays, maxActiveLoans: 3 }),
    });
    expect(response.status).toBe(400);
    expect((await response.json()).fieldErrors.loanDays).toBeTruthy();
  });

  it('rejects a blank name and maxActiveLoans outside the supported range', async () => {
    const { base } = await setup();
    const response = await fetch(base, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ libraryName: '  ', loanDays: 14, maxActiveLoans: 21 }),
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      fieldErrors: {
        libraryName: expect.any(String),
        maxActiveLoans: expect.any(String),
      },
    });
  });
});
