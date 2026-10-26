import { useEffect, useState } from 'react';
import type { ChangeEvent } from 'react';
import type { LibraryData } from '../../shared/types';
import styles from './Page.module.css';

type BackupCounts = { books: number; copies: number; students: number; loans: number };

async function responseError(response: Response) {
  const body = await response.json().catch(() => null);
  return body?.error?.message ?? `הבקשה נכשלה (קוד ${response.status}).`;
}

function localDate() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function Page() {
  const [counts, setCounts] = useState<BackupCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [fileName, setFileName] = useState('');
  const [backup, setBackup] = useState<LibraryData | null>(null);
  const [preview, setPreview] = useState<BackupCounts | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    fetch('/api/backup')
      .then(async (response) => {
        if (!response.ok) throw new Error(await responseError(response));
        return response.json() as Promise<LibraryData>;
      })
      .then((data) => {
        if (active) setCounts({
          books: data.books.length,
          copies: data.copies.length,
          students: data.students.length,
          loans: data.loans.length,
        });
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'טעינת נתוני המאגר נכשלה.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function downloadBackup() {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/backup');
      if (!response.ok) throw new Error(await responseError(response));
      const data = await response.json() as LibraryData;
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `library-backup-${localDate()}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setCounts({
        books: data.books.length,
        copies: data.copies.length,
        students: data.students.length,
        loans: data.loans.length,
      });
      setMessage('הגיבוי ירד בהצלחה.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'הורדת הגיבוי נכשלה.');
    } finally {
      setBusy(false);
    }
  }

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    setBackup(null);
    setPreview(null);
    setConfirmed(false);
    setFileName('');
    setError('');
    setMessage('');
    if (!file) return;

    setBusy(true);
    setFileName(file.name);
    try {
      const data: unknown = JSON.parse(await file.text());
      const response = await fetch('/api/backup/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data }),
      });
      if (!response.ok) throw new Error(await responseError(response));
      const result = await response.json() as { counts: BackupCounts };
      setBackup(data as LibraryData);
      setPreview(result.counts);
      setMessage('הקובץ תקין. בדקי את הכמויות לפני אישור השחזור.');
    } catch (reason) {
      setError(reason instanceof SyntaxError
        ? 'הקובץ אינו JSON תקין.'
        : reason instanceof Error ? reason.message : 'בדיקת קובץ הגיבוי נכשלה.');
    } finally {
      setBusy(false);
      input.value = '';
    }
  }

  async function restoreBackup() {
    if (!backup || !confirmed) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/backup/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: backup, confirm: true }),
      });
      if (!response.ok) throw new Error(await responseError(response));
      const result = await response.json() as { restored?: boolean };
      if (result.restored !== true) throw new Error('השרת לא אישר שהשחזור הושלם.');
      setCounts(preview);
      setBackup(null);
      setPreview(null);
      setConfirmed(false);
      setFileName('');
      setMessage('המאגר שוחזר בהצלחה מהגיבוי שנבדק.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'שחזור הגיבוי נכשל.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.page} dir="rtl">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>המידע של הספרייה</p>
          <h1>גיבוי ושחזור</h1>
          <p className={styles.intro}>שומרות עותק בטוח. בודקות לפני שמחליפות נתונים.</p>
        </div>
        <a className={styles.catalogLink} href="#/03-catalog">חזרה לקטלוג הספרים ←</a>
      </header>

      {loading && <p className={styles.notice} role="status">טוענת את נתוני המאגר…</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      {message && <p className={styles.success} role="status">{message}</p>}

      <div className={styles.grid}>
        <section className={styles.card} aria-labelledby="download-heading">
          <div className={styles.cardIcon} aria-hidden="true">↓</div>
          <h2 id="download-heading">הורדת גיבוי</h2>
          <p className={styles.description}>כל הספרים, העותקים, התלמידות, ההשאלות וההגדרות בקובץ אחד.</p>
          {loading ? (
            <p className={styles.empty}>טוענת את מצב המאגר…</p>
          ) : counts ? (
            <dl className={styles.counts}>
              <div><dt>ספרים</dt><dd>{counts.books}</dd></div>
              <div><dt>עותקים</dt><dd>{counts.copies}</dd></div>
              <div><dt>תלמידות</dt><dd>{counts.students}</dd></div>
              <div><dt>השאלות והיסטוריה</dt><dd>{counts.loans}</dd></div>
            </dl>
          ) : (
            <p className={styles.empty}>לא ניתן לטעון את מצב המאגר.</p>
          )}
          <button className={styles.primaryButton} type="button" onClick={downloadBackup} disabled={busy || loading}>
            ↓ הורדת גיבוי JSON
          </button>
          <p className={styles.hint}>שמרי גם עותק מחוץ למחשב הספרנית.</p>
        </section>

        <section className={styles.card} aria-labelledby="restore-heading">
          <div className={styles.cardIcon} aria-hidden="true">↥</div>
          <h2 id="restore-heading">שחזור מקובץ</h2>
          <label className={styles.filePicker}>
            <span className={styles.uploadIcon} aria-hidden="true">＋</span>
            <strong>{fileName || 'בחרי גיבוי לבדיקה'}</strong>
            <span>קובץ גיבוי JSON של הספרייה</span>
            <input type="file" accept="application/json,.json" onChange={chooseFile} disabled={busy} />
          </label>

          {preview && (
            <div className={styles.preview} role="status">
              <strong>✓ הקובץ תקין</strong>
              <span>{preview.books} ספרים · {preview.copies} עותקים · {preview.students} תלמידות · {preview.loans} השאלות</span>
            </div>
          )}
          {backup && (
            <>
              <p className={styles.warning}>השחזור יחליף את כל הנתונים הנוכחיים. הורידי גיבוי לפני האישור.</p>
              <label className={styles.confirmation}>
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(event) => setConfirmed(event.currentTarget.checked)}
                  disabled={busy}
                />
                אני מאשרת להחליף את המאגר הנוכחי
              </label>
              <button
                className={styles.dangerButton}
                type="button"
                onClick={restoreBackup}
                disabled={busy || !confirmed}
              >
                {busy ? 'משחזרת…' : 'אישור שחזור'}
              </button>
            </>
          )}
          {!backup && !preview && <p className={styles.hint}>הקובץ ייבדק ויוצגו כמויות לפני שתוכלי לאשר שחזור.</p>}
        </section>
      </div>
      <footer className={styles.footer}>מסד מקומי · גיבוי הכולל נתוני ספרייה והגדרות</footer>
    </main>
  );
}
