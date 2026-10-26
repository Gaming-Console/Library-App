import initSqlJs, { type Database, type SqlValue } from 'sql.js';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const SQL = await initSqlJs();
export const databasePath = resolve(process.env.LIBRARY_DB ?? 'data/library.sqlite');

// SQL infrastructure only. Domain queries belong to the participant-owned routers.
export function openDatabase(path: string | null) {
  let connection: Database = path && existsSync(path) ? new SQL.Database(readFileSync(path)) : new SQL.Database();
  connection.run('PRAGMA foreign_keys = ON');
  let depth = 0;
  function snapshot() {
    const bytes = connection.export();
    connection.run('PRAGMA foreign_keys = ON');
    return bytes;
  }
  function restore(bytes: Uint8Array) {
    connection.close();
    connection = new SQL.Database(bytes);
    connection.run('PRAGMA foreign_keys = ON');
  }
  function persist() {
    if (!path) return;
    mkdirSync(dirname(path), { recursive: true });
    const temporary = `${path}.tmp`;
    writeFileSync(temporary, snapshot());
    renameSync(temporary, path);
  }
  function change(action: () => void) {
    const before = depth === 0 ? snapshot() : null;
    try {
      action();
      if (depth === 0) persist();
    } catch (error) {
      if (before) restore(before);
      throw error;
    }
  }
  return {
    prepare(sql: string) {
      function rows(params: SqlValue[]) {
        const statement = connection.prepare(sql);
        try {
          statement.bind(params);
          const result: Record<string, SqlValue>[] = [];
          while (statement.step()) result.push(statement.getAsObject());
          return result;
        } finally { statement.free(); }
      }
      return {
        all: (...params: SqlValue[]) => rows(params),
        get: (...params: SqlValue[]) => rows(params)[0],
        run: (...params: SqlValue[]) => {
          let changes = 0;
          change(() => { connection.run(sql, params); changes = connection.getRowsModified(); });
          return { changes };
        },
      };
    },
    exec(sql: string) { change(() => { connection.exec(sql); }); },
    transaction<T>(action: () => T): () => T {
      return () => {
        const before = depth === 0 ? snapshot() : null;
        const savepoint = `workshop_${depth}`;
        connection.run(`SAVEPOINT ${savepoint}`);
        depth++;
        let released = false;
        try {
          const result = action();
          if (result instanceof Promise) throw new Error('Transactions must be synchronous');
          connection.run(`RELEASE SAVEPOINT ${savepoint}`);
          released = true;
          if (depth === 1) persist();
          return result;
        } catch (error) {
          if (!released) {
            connection.run(`ROLLBACK TO SAVEPOINT ${savepoint}`);
            connection.run(`RELEASE SAVEPOINT ${savepoint}`);
          } else if (before) restore(before);
          throw error;
        } finally { depth--; }
      };
    },
    close() { connection.close(); },
  };
}

export const db = openDatabase(databasePath);
