import { useState } from 'react';
import readXlsxFile from 'read-excel-file';
import type { Student, StudentInput, StudentImportRow } from '../../shared/types';
import styles from './Page.module.css';

type PreviewRow = StudentImportRow & { status: 'new' | 'update' | 'error'; issue?: string };
type ImportResult = { added: number; updated: number };

const headers = ['מזהה תלמידה', 'שם מלא', 'כיתה'];

function textCell(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export default function Page() {
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [message, setMessage] = useState('');
  const [loadingFile, setLoadingFile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  async function loadFile(file?: File) {
    setRows([]);
    setMessage('');
    setResult(null);
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      setMessage('יש לבחור קובץ xlsx.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMessage('הקובץ גדול מ־5MB.');
      return;
    }

    setLoadingFile(true);
    try {
      const sheet = await readXlsxFile(file);
      if (!sheet.length || headers.some((header, index) => sheet[0][index] !== header) || sheet[0].length !== headers.length) {
        setMessage(`כותרות העמודות חייבות להיות: ${headers.join(' | ')}`);
        return;
      }

      const parsed = sheet.slice(1)
        .map((cells, index) => ({ cells, row: index + 2 }))
        .filter(({ cells }) => cells.some((cell) => cell !== null && cell !== undefined && cell !== ''));
      if (!parsed.length) {
        setMessage('לא נמצאו שורות תלמידות בקובץ.');
        return;
      }
      if (parsed.length > 1000) {
        setMessage('אפשר לייבא עד 1000 תלמידות בקובץ אחד.');
        return;
      }

      const seen = new Set<string>();
      const repeated = new Set<string>();
      const mapped = parsed.map(({ cells, row }) => {
        const schoolId = textCell(cells[0]);
        const fullName = textCell(cells[1]);
        const className = textCell(cells[2]);
        const identifierIsText = typeof cells[0] === 'string';
        let issue: string | undefined;
        if (!identifierIsText) issue = 'יש להגדיר את מזהה התלמידה כטקסט בגיליון.';
        else if (!schoolId || !fullName || !className) issue = 'יש למלא מזהה, שם מלא וכיתה.';
        else if (seen.has(schoolId)) {
          repeated.add(schoolId);
          issue = 'המזהה מופיע יותר מפעם אחת בקובץ.';
        }
        seen.add(schoolId);
        return { row, schoolId, fullName, className, issue, identifierIsText };
      });

      const duplicateMarked = mapped.map((item) => repeated.has(item.schoolId)
        ? { ...item, issue: 'המזהה מופיע יותר מפעם אחת בקובץ.' }
        : item);
      setRows(duplicateMarked.map((item) => ({
        ...item,
        status: item.issue ? 'error' : 'new',
      })));

      if (duplicateMarked.some((item) => item.issue)) return;

      const response = await fetch('/api/students');
      if (!response.ok) throw new Error('לא ניתן לבדוק אילו תלמידות כבר קיימות. ודאי שמשימה 07 מוזגה והשרת הופעל מחדש.');
      const data = await response.json() as { items: Student[] };
      const existingIds = new Set(data.items.map((student) => student.schoolId));
      setRows(duplicateMarked.map((item) => ({
        ...item,
        status: existingIds.has(item.schoolId) ? 'update' : 'new',
      })));
    } catch (error) {
      setRows((current) => current.map((row) => ({
        ...row,
        status: 'error',
        issue: error instanceof Error ? error.message : 'קריאת הקובץ נכשלה.',
      })));
      setMessage(error instanceof Error ? error.message : 'קריאת הקובץ נכשלה.');
    } finally {
      setLoadingFile(false);
    }
  }

  async function importStudents() {
    if (!canImport) return;
    setSaving(true);
    setMessage('');
    setResult(null);
    try {
      const payload: StudentInput[] = rows.map(({ schoolId, fullName, className }) => ({ schoolId, fullName, className }));
      const response = await fetch('/api/imports/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: payload }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message ?? 'הייבוא נכשל.');
      setResult(body as ImportResult);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'הייבוא נכשל.');
    } finally {
      setSaving(false);
    }
  }

  const canImport = rows.length > 0 && rows.length <= 1000 && rows.every((row) => row.status !== 'error');
  const addedCount = rows.filter((row) => row.status === 'new').length;
  const updatedCount = rows.filter((row) => row.status === 'update').length;

  return (
    <main className={styles.page} dir="rtl">
      <a className={styles.back} href="#/03-catalog">חזרה לקטלוג</a>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>ייבוא מרוכז</p>
          <h1>ייבוא תלמידות</h1>
          <p className={styles.intro}>בדקי את השורות ואת השינויים לפני שמירה.</p>
        </div>
        <a className={styles.template} href="/workshop/samples/students.xlsx" download>הורדת תבנית xlsx</a>
      </header>

      <section className={styles.upload} aria-labelledby="upload-title">
        <div>
          <h2 id="upload-title">בחירת קובץ</h2>
          <p>עמודות: מזהה תלמידה, שם מלא, כיתה. מזהים חייבים להיות מוגדרים כטקסט.</p>
        </div>
        <label className={styles.fileLabel}>
          <span>בחירת קובץ xlsx</span>
          <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => void loadFile(event.target.files?.[0])} />
        </label>
      </section>

      {loadingFile && <p className={styles.notice} role="status">קוראת את הקובץ ובודקת תלמידות קיימות…</p>}
      {message && <p className={styles.error} role="alert">{message}</p>}
      {result && <p className={styles.success} role="status">הייבוא הושלם: נוספו {result.added}, עודכנו {result.updated}.</p>}

      {rows.length > 0 && <section className={styles.preview} aria-labelledby="preview-title">
        <div className={styles.previewHead}>
          <div>
            <h2 id="preview-title">תצוגה מקדימה</h2>
            <p>{rows.length} שורות · {addedCount} חדשות · {updatedCount} לעדכון · {rows.length - addedCount - updatedCount} שגיאות</p>
          </div>
          <button className={styles.importButton} type="button" disabled={!canImport || saving || loadingFile} onClick={() => void importStudents()}>
            {saving ? 'מייבאת…' : 'אישור וייבוא'}
          </button>
        </div>
        <div className={styles.tableWrap}>
          <table>
            <thead><tr><th>שורה</th><th>מזהה תלמידה</th><th>שם מלא</th><th>כיתה</th><th>מצב</th></tr></thead>
            <tbody>{rows.map((row) => <tr key={`${row.row}-${row.schoolId}`}>
              <td>{row.row}</td>
              <td dir="ltr">{row.schoolId || '—'}</td>
              <td>{row.fullName || '—'}</td>
              <td>{row.className || '—'}</td>
              <td>
                {row.status === 'new' && <span className={styles.new}>חדשה</span>}
                {row.status === 'update' && <span className={styles.update}>עדכון</span>}
                {row.status === 'error' && <span className={styles.rowError} title={row.issue}>שגיאה: {row.issue}</span>}
              </td>
            </tr>)}</tbody>
          </table>
        </div>
      </section>}
    </main>
  );
}