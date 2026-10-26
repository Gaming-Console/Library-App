import { Router } from 'express';
import type { Request, Response } from 'express';
import { db } from '../db';
import type { openDatabase } from '../db';

type Database = ReturnType<typeof openDatabase>;
type Settings = { libraryName: string; loanDays: number; maxActiveLoans: number };
type FieldErrors = Partial<Record<keyof Settings, string>>;

function readSettings(database: Database): Settings {
  const row = database.prepare(
    'SELECT libraryName, loanDays, maxActiveLoans FROM settings WHERE id = 1',
  ).get();
  if (!row) throw new Error('Missing settings row with id=1');
  return {
    libraryName: String(row.libraryName),
    loanDays: Number(row.loanDays),
    maxActiveLoans: Number(row.maxActiveLoans),
  };
}

function validateSettings(input: unknown): { settings?: Settings; errors: FieldErrors } {
  const errors: FieldErrors = {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { errors: { libraryName: 'יש להזין שם ספרייה', loanDays: 'יש להזין מספר שלם בין 1 ל־90', maxActiveLoans: 'יש להזין מספר שלם בין 1 ל־20' } };
  }

  const value = input as Record<string, unknown>;
  const libraryName = typeof value.libraryName === 'string' ? value.libraryName.trim() : '';
  if (!libraryName) errors.libraryName = 'יש להזין שם ספרייה';
  if (!Number.isInteger(value.loanDays) || Number(value.loanDays) < 1 || Number(value.loanDays) > 90) {
    errors.loanDays = 'יש להזין מספר שלם בין 1 ל־90';
  }
  if (!Number.isInteger(value.maxActiveLoans) || Number(value.maxActiveLoans) < 1 || Number(value.maxActiveLoans) > 20) {
    errors.maxActiveLoans = 'יש להזין מספר שלם בין 1 ל־20';
  }
  if (Object.keys(errors).length) return { errors };
  return {
    settings: {
      libraryName,
      loanDays: Number(value.loanDays),
      maxActiveLoans: Number(value.maxActiveLoans),
    },
    errors,
  };
}

export function createSettingsRouter(database: Database = db) {
  const router = Router();

  router.get('/settings', (_request, response) => {
    response.json(readSettings(database));
  });

  router.put('/settings', (request: Request, response: Response) => {
    const { settings, errors } = validateSettings(request.body);
    if (!settings) {
      response.status(400).json({
        error: { code: 'INVALID_INPUT', message: 'יש לתקן את השדות המסומנים' },
        fieldErrors: errors,
      });
      return;
    }

    const update = database.prepare(
      'UPDATE settings SET libraryName = ?, loanDays = ?, maxActiveLoans = ? WHERE id = 1',
    ).run(settings.libraryName, settings.loanDays, settings.maxActiveLoans);
    if (update.changes !== 1) throw new Error('Expected exactly one settings row with id=1');
    response.json(readSettings(database));
  });

  return router;
}

export default createSettingsRouter();
