import { Router } from 'express';
import type { Student, StudentInput } from '../../src/shared/types';
import { db } from '../db';

type SaveStudent = (input: StudentInput, id?: string) => Student;
type SaveStudentResolver = () => Promise<SaveStudent>;
const task07ModulePath = './07-students';

async function resolveTask07SaveStudent(): Promise<SaveStudent> {
  const studentsFeature = await import(task07ModulePath) as { saveStudent?: SaveStudent };
  if (typeof studentsFeature.saveStudent !== 'function') {
    throw new Error('Task 07 does not export saveStudent');
  }
  return studentsFeature.saveStudent;
}

function invalidInput(message: string) {
  return { error: { code: 'INVALID_INPUT', message } };
}

export function createStudentImportRouter(resolveSaveStudent: SaveStudentResolver = resolveTask07SaveStudent) {
  const router = Router();
  router.post('/imports/students', async (req, res) => {
    const rows: unknown = req.body?.rows;
    if (!Array.isArray(rows) || rows.length < 1 || rows.length > 1000) {
      res.status(400).json(invalidInput('יש לייבא בין תלמידה אחת ל־1000 תלמידות'));
      return;
    }

    const seen = new Set<string>();
    const inputs: StudentInput[] = [];
    for (const row of rows) {
      if (!row || typeof row !== 'object' || Array.isArray(row)) {
        res.status(400).json(invalidInput('מבנה שורת תלמידה אינו תקין'));
        return;
      }
      const candidate = row as Record<string, unknown>;
      const schoolId = typeof candidate.schoolId === 'string' ? candidate.schoolId.trim() : '';
      const fullName = typeof candidate.fullName === 'string' ? candidate.fullName.trim() : '';
      const className = typeof candidate.className === 'string' ? candidate.className.trim() : '';
      if (!schoolId || !fullName || !className) {
        res.status(400).json(invalidInput('יש למלא מזהה תלמידה, שם מלא וכיתה בכל שורה'));
        return;
      }
      if (seen.has(schoolId)) {
        res.status(400).json(invalidInput(`המזהה ${schoolId} מופיע יותר מפעם אחת בקובץ`));
        return;
      }
      seen.add(schoolId);
      inputs.push({ schoolId, fullName, className });
    }

    try {
      const saveStudent = await resolveSaveStudent();
      let added = 0;
      let updated = 0;
      db.transaction(() => {
        for (const input of inputs) {
          const existing = db.prepare('SELECT id FROM students WHERE schoolId = ?').get(input.schoolId) as { id: string } | undefined;
          saveStudent(input, existing?.id);
          if (existing) updated++;
          else added++;
        }
      })();
      res.json({ added, updated });
    } catch (error) {
      if (error instanceof Error && (error.message.includes('07-students') || error.message.includes('Task 07'))) {
        res.status(503).json({ error: { code: 'DEPENDENCY_NOT_READY', message: 'ייבוא תלמידות יהיה זמין לאחר חיבור משימה 07.' } });
        return;
      }
      console.error('Student import failed', error);
      res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'ייבוא התלמידות נכשל. לא נשמרו שינויים.' } });
    }
  });
  return router;
}

export default createStudentImportRouter();