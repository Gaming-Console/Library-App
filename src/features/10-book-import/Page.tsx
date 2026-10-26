import { useRef, useState } from 'react';
import readXlsxFile from 'read-excel-file';
import type { BookInput, CatalogItem } from '../../shared/types';
import { buildBookInputs, parseBookRows, type ParsedBookImport } from './import';
import styles from './Page.module.css';

type CatalogStatus = 'idle' | 'loading' | 'ready' | 'error';

function responseMessage(body: unknown, fallback: string) {
  if (body && typeof body === 'object' && 'error' in body) {
    const error = body.error;
    if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') return error.message;
  }
  return fallback;
}

function isCatalogItem(value: unknown): value is CatalogItem {
  if (!value || typeof value !== 'object' || !('book' in value)) return false;
  const book = value.book;
  return Boolean(book && typeof book === 'object' && 'id' in book && typeof book.id === 'string'
    && 'title' in book && typeof book.title === 'string'
    && 'ageGroup' in book && typeof book.ageGroup === 'string');
}

export default function Page() {
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState<ParsedBookImport | null>(null);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [catalogStatus, setCatalogStatus] = useState<CatalogStatus>('idle');
  const [catalogError, setCatalogError] = useState('');
  const [fileError, setFileError] = useState('');
  const [decisions, setDecisions] = useState<Record<number, string>>({});
  const [acknowledged, setAcknowledged] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submittedCount, setSubmittedCount] = useState<number | null>(null);
  const requestNumber = useRef(0);
  const submitLock = useRef(false);

  async function chooseFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;

    const request = ++requestNumber.current;
    setFileName(file.name);
    setPreview(null);
    setCatalog([]);
    setCatalogStatus('idle');
    setCatalogError('');
    setFileError('');
    setSubmitError('');
    setSubmittedCount(null);
    setDecisions({});
    setAcknowledged(false);

    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      setFileError('יש לבחור קובץ Excel מסוג ‎.xlsx');
      return;
    }

    setIsReading(true);
    try {
      const parsed = parseBookRows(await readXlsxFile(file));
      if (request !== requestNumber.current) return;
      setPreview(parsed);
      if (parsed.rows.length === 0) return;

      setCatalogStatus('loading');
      try {
        const response = await fetch('/api/books');
        const body: unknown = await response.json().catch(() => null);
        if (!response.ok) throw new Error(responseMessage(body, 'לא ניתן לטעון את קטלוג הספרים'));
        if (!body || typeof body !== 'object' || !('items' in body) || !Array.isArray(body.items) || !body.items.every(isCatalogItem)) {
          throw new Error('השרת החזיר קטלוג ספרים במבנה לא תקין');
        }
        if (request !== requestNumber.current) return;
        setCatalog(body.items);
        setCatalogStatus('ready');
      } catch (error) {
        if (request !== requestNumber.current) return;
        setCatalogStatus('error');
        setCatalogError(error instanceof Error ? error.message : 'לא ניתן לטעון את קטלוג הספרים');
      }
    } catch {
      if (request === requestNumber.current) setFileError('לא ניתן לקרוא את קובץ ה־Excel. בדקי שהוא תקין ונסי שוב.');
    } finally {
      if (request === requestNumber.current) setIsReading(false);
    }
  }

  const validRows = preview?.validRows ?? [];
  const totalCopies = validRows.reduce((sum, row) => sum + row.quantity, 0);
  const decisionResult = catalogStatus === 'ready'
    ? buildBookInputs(validRows, catalog, decisions)
    : { items: [] as BookInput[], issues: [] };
  const canSubmit = Boolean(preview && preview.issues.length === 0 && catalogStatus === 'ready'
    && decisionResult.issues.length === 0 && acknowledged && !isReading && !isSubmitting && submittedCount === null);

  async function submitImport() {
    if (!canSubmit || submitLock.current) return;
    submitLock.current = true;
    setIsSubmitting(true);
    setSubmitError('');
    try {
      const response = await fetch('/api/imports/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: decisionResult.items }),
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(responseMessage(body, 'הייבוא נכשל. בדקי את החיבור לשרת.'));
      if (!body || typeof body !== 'object' || !('copyIds' in body) || !Array.isArray(body.copyIds)
        || body.copyIds.length !== totalCopies || !body.copyIds.every((id) => typeof id === 'string')) {
        throw new Error('השרת החזיר אישור ייבוא לא תקין. לא ניתן לאשר שהעותקים נוצרו.');
      }
      setSubmittedCount(body.copyIds.length);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'הייבוא נכשל. בדקי את החיבור לשרת.');
    } finally {
      submitLock.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>קליטה מרוכזת</p>
          <h1>מאקסל אל מדפי הספרייה</h1>
          <p className={styles.intro}>ייבוא ספרים וכמויות, עם בדיקת התאמות לפני יצירת העותקים.</p>
        </div>
        <nav className={styles.headerLinks} aria-label="קישורים קשורים">
          <a className={styles.catalogLink} href="#/03-catalog">מעבר לקטלוג הספרים</a>
          <a className={styles.templateLink} href="/workshop/samples/books.xlsx" download>
            <span aria-hidden="true">↓</span> הורדת תבנית Excel
          </a>
        </nav>
      </header>

      <section className={styles.panel} aria-labelledby="file-heading">
        <div className={styles.panelHeading}>
          <div>
            <p className={styles.eyebrow}>שלב 1</p>
            <h2 id="file-heading">בחירת קובץ</h2>
          </div>
          {fileName && <span className={styles.fileName} dir="ltr">{fileName}</span>}
        </div>
        <label className={styles.filePicker}>
          <span>קובץ ספרים ‎(.xlsx)</span>
          <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={chooseFile} disabled={isReading || isSubmitting} />
        </label>
        <p className={styles.fieldHint}>העמודות הנדרשות: שם ספר, גיל יעד, כמות עותקים. עד 100 שורות ועד 500 עותקים.</p>
        {isReading && <p className={styles.status} role="status">קוראת את הקובץ…</p>}
        {fileError && <p className={styles.error} role="alert">{fileError}</p>}
      </section>

      {preview && (
        <section className={styles.panel} aria-labelledby="preview-heading">
          <div className={styles.panelHeading}>
            <div>
              <p className={styles.eyebrow}>שלב 2</p>
              <h2 id="preview-heading">בדיקה והחלטה על התאמות</h2>
            </div>
            <span className={styles.rowCount}>{preview.rows.length} שורות</span>
          </div>

          {preview.issues.length > 0 && (
            <div className={styles.issueList} role="alert">
              <strong>יש לתקן את הקובץ לפני הייבוא</strong>
              <ul>{preview.issues.map((issue, index) => <li key={`${issue.row}-${index}`}>שורה {issue.row}: {issue.message}</li>)}</ul>
            </div>
          )}

          {catalogStatus === 'loading' && <p className={styles.status} role="status">בודקת התאמות מול קטלוג הספרים…</p>}
          {catalogStatus === 'error' && <p className={styles.error} role="alert">{catalogError}. לא ניתן לאשר את הייבוא בלי בדיקת התאמות.</p>}
          {catalogStatus === 'ready' && preview.rows.length > 0 && (
            <div className={styles.tableWrap}>
              <table>
                <thead><tr><th scope="col">שורה</th><th scope="col">שם הספר</th><th scope="col">גיל יעד</th><th scope="col">עותקים</th><th scope="col">החלטה</th></tr></thead>
                <tbody>
                  {preview.rows.map((row) => {
                    const validRow = validRows.find((item) => item.row === row.row);
                    const matches = validRow ? catalog.filter(({ book }) => book.title.trim() === validRow.title.trim() && book.ageGroup.trim() === validRow.ageGroup.trim()) : [];
                    return (
                      <tr key={row.row}>
                        <td className={styles.rowNumber}>{row.row}</td>
                        <td>{row.title || <span className={styles.invalidValue}>חסר</span>}{row.issues.length > 0 && <small className={styles.rowIssue}>{row.issues.join(' · ')}</small>}</td>
                        <td>{row.ageGroup || <span className={styles.invalidValue}>חסר</span>}</td>
                        <td dir="ltr">{row.quantity ?? <span className={styles.invalidValue}>לא תקין</span>}</td>
                        <td>
                          {!validRow ? <span className={styles.muted}>נדרשת בדיקת שורה</span> : matches.length === 0
                            ? <span className={styles.newBook}>ספר חדש · לא נמצאה התאמה</span>
                            : <label className={styles.decisionField}>
                              <span className={styles.visuallyHidden}>בחירת פעולה לשורה {row.row}</span>
                              <select value={decisions[row.row] ?? ''} onChange={(event) => setDecisions((current) => ({ ...current, [row.row]: event.target.value }))}>
                                <option value="">יש לבחור פעולה</option>
                                <option value="new">יצירת ספר חדש</option>
                                {matches.map(({ book }) => <option key={book.id} value={book.id}>הוספת עותקים ל־{book.title} · {book.ageGroup}</option>)}
                              </select>
                            </label>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className={styles.summary}>
            <span><strong>{validRows.length}</strong> שורות תקינות</span>
            <span><strong dir="ltr">{totalCopies}</strong> עותקים לייבוא</span>
          </div>

          <div className={styles.warning}>
            <strong>שימי לב לפני אישור</strong>
            <p>ייבוא חוזר של אותם ספרים יוצר עותקים נוספים. בדקי את הכמויות ובחרי במפורש אם להוסיף לספר קיים.</p>
            <label className={styles.acknowledgment}>
              <input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} disabled={submittedCount !== null} />
              <span>בדקתי את הרשימה ואני מאשרת ליצור {totalCopies} עותקים</span>
            </label>
          </div>

          {decisionResult.issues.length > 0 && catalogStatus === 'ready' && (
            <p className={styles.error} role="alert">{decisionResult.issues.map((issue) => `שורה ${issue.row}: ${issue.message}`).join(' ')}</p>
          )}
          {submitError && <p className={styles.error} role="alert">{submitError}</p>}
          {submittedCount !== null && (
            <div className={styles.success} role="status">
              <span>נוצרו {submittedCount} עותקים.</span>
              <a href="#/05-labels">מעבר למדבקות ולברקודים ←</a>
              <p>לביצוע ייבוא נוסף יש לבחור קובץ מחדש.</p>
            </div>
          )}
          <div className={styles.actions}>
            <button type="button" onClick={submitImport} disabled={!canSubmit}>
              {isSubmitting ? 'מייבאת…' : `אישור קליטת ${totalCopies} עותקים`}
            </button>
          </div>
        </section>
      )}
    </main>
  );
}