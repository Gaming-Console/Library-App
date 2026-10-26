import { useEffect, useMemo, useState } from 'react';
import type { Book, Copy } from '../../shared/types';
import styles from './Page.module.css';
import { createBarcodeSvg, createLabelsHtml } from './labels';

interface LabelCopy { copy: Copy; book: Book; loaned: boolean }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readLabelCopies(payload: unknown): LabelCopy[] {
  if (!isRecord(payload) || !Array.isArray(payload.items)) {
    throw new Error('השרת החזיר תשובה לא תקינה עבור העותקים.');
  }

  return payload.items.map((item: unknown) => {
    if (!isRecord(item) || !isRecord(item.copy) || !isRecord(item.book)) {
      throw new Error('השרת החזיר פרטי עותק לא תקינים.');
    }
    const { copy, book } = item;
    if (
      typeof copy.id !== 'string' || typeof copy.bookId !== 'string' ||
      typeof copy.barcode !== 'string' || typeof book.id !== 'string' ||
      typeof book.title !== 'string' || typeof book.ageGroup !== 'string'
    ) {
      throw new Error('השרת החזיר פרטי עותק לא תקינים.');
    }

    return {
      copy: { id: copy.id, bookId: copy.bookId, barcode: copy.barcode },
      book: { id: book.id, title: book.title, ageGroup: book.ageGroup },
      loaned: isRecord(item.activeLoan),
    };
  });
}

function requestedBookId(): string {
  const query = location.hash.split('?')[1] ?? '';
  return new URLSearchParams(query).get('bookId') ?? '';
}

function BarcodeImage({ barcode }: { barcode: string }) {
  const [image, setImage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    try {
      const svg = createBarcodeSvg(barcode, true);
      setImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
      setError('');
    } catch (caught) {
      setImage('');
      setError(caught instanceof Error ? caught.message : 'לא ניתן ליצור את הברקוד.');
    }
  }, [barcode]);

  if (error) return <p className={styles.barcodeError} role="alert">{error}</p>;
  if (!image) return <p className={styles.muted}>מכינה ברקוד…</p>;
  return <img className={styles.barcodeImage} src={image} alt={`ברקוד ${barcode}`} />;
}

export default function Page() {
  const [copies, setCopies] = useState<LabelCopy[]>([]);
  const [bookId, setBookId] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [previewId, setPreviewId] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [retry, setRetry] = useState(0);
  const [downloadError, setDownloadError] = useState('');
  const [downloadMessage, setDownloadMessage] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    async function loadCopies() {
      setLoading(true);
      setLoadError('');
      try {
        const response = await fetch('/api/copies', { signal: controller.signal });
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('הנתיב /copies עדיין לא זמין. זו תלות של משימה 03; אין נתוני עותקים להצגה עדיין.');
          }
          throw new Error(`טעינת העותקים נכשלה (שגיאת שרת ${response.status}).`);
        }
        const items = readLabelCopies(await response.json());
        const requested = requestedBookId();
        const initialBook = items.some(({ book }) => book.id === requested)
          ? requested
          : requested ? '' : items[0]?.book.id ?? '';
        const first = items.find(({ book }) => book.id === initialBook);
        setCopies(items);
        setBookId(initialBook);
        setSelectedIds(first ? [first.copy.id] : []);
        setPreviewId(first?.copy.id ?? '');
      } catch (caught) {
        if (controller.signal.aborted) return;
        setLoadError(caught instanceof Error
          ? caught.message
          : 'טעינת העותקים נכשלה בגלל שגיאה לא צפויה.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadCopies();
    return () => controller.abort();
  }, [retry]);

  const books = useMemo(() => {
    const unique = new Map(copies.map(({ book }) => [book.id, book]));
    return [...unique.values()];
  }, [copies]);
  const visibleCopies = useMemo(() => copies.filter(({ book }) => book.id === bookId), [copies, bookId]);
  const selectedCopies = visibleCopies.filter(({ copy }) => selectedIds.includes(copy.id));
  const preview = visibleCopies.find(({ copy }) => copy.id === previewId) ?? visibleCopies[0];
  const requested = requestedBookId();
  const requestedMissing = Boolean(requested && !books.some((book) => book.id === requested));

  function clearMessages() {
    setDownloadError('');
    setDownloadMessage('');
  }

  function chooseBook(id: string) {
    const first = copies.find(({ book }) => book.id === id);
    setBookId(id);
    setSelectedIds(first ? [first.copy.id] : []);
    setPreviewId(first?.copy.id ?? '');
    clearMessages();
  }

  function toggleCopy(copyId: string) {
    const checked = selectedIds.includes(copyId);
    setSelectedIds(checked ? selectedIds.filter((id) => id !== copyId) : [...selectedIds, copyId]);
    if (!checked) setPreviewId(copyId);
    clearMessages();
  }

  function downloadLabels() {
    clearMessages();
    try {
      const labels = selectedCopies.map(({ copy, book }) => ({
        title: book.title,
        ageGroup: book.ageGroup,
        barcode: copy.barcode,
        barcodeSvg: createBarcodeSvg(copy.barcode),
      }));
      const file = new Blob([createLabelsHtml(labels)], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(file);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'library-labels.html';
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      setDownloadMessage(`הקובץ מוכן עם ${labels.length} ${labels.length === 1 ? 'מדבקה' : 'מדבקות'}.`);
    } catch (caught) {
      setDownloadError(caught instanceof Error
        ? `לא ניתן ליצור את קובץ המדבקות: ${caught.message}`
        : 'לא ניתן ליצור את קובץ המדבקות בגלל שגיאה לא צפויה.');
    }
  }

  return (
    <main className={styles.page} dir="rtl">
      <div className={styles.head}>
        <div>
          <a className={styles.eyebrow} href="#/03-catalog" aria-label="מהמסך למדף, חזרה לקטלוג">מהמסך למדף</a>
          <h1>ברקודים ומדבקות</h1>
          <p>בוחרות עותקים, מציגות קודים אמיתיים וסורקות.</p>
        </div>
        <button
          className={styles.btn}
          type="button"
          onClick={downloadLabels}
          disabled={selectedCopies.length === 0}
        >
          ↓ הורדת דף מדבקות
        </button>
      </div>

      {downloadError && <p className={styles.error} role="alert">{downloadError}</p>}
      {downloadMessage && <p className={styles.success} role="status">{downloadMessage}</p>}

      {loading && <section className={styles.panel} role="status"><p className={styles.muted}>טוענת עותקים…</p></section>}

      {!loading && loadError && (
        <section className={`${styles.panel} ${styles.errorPanel}`} role="alert">
          <h2>לא ניתן לטעון עותקים</h2>
          <p className={styles.muted}>{loadError}</p>
          <button className={`${styles.btn} ${styles.secondary}`} type="button" onClick={() => setRetry((value) => value + 1)}>
            ניסיון חוזר
          </button>
        </section>
      )}

      {!loading && !loadError && copies.length === 0 && (
        <section className={styles.panel}>
          <h2>עדיין אין עותקים להצגה</h2>
          <p className={styles.muted}>כשתהיה בספרייה רשימת עותקים, אפשר יהיה לבחור אותם כאן.</p>
        </section>
      )}

      {!loading && !loadError && copies.length > 0 && (
        <div className={styles.split}>
          <section className={styles.panel}>
            <h2>בחירת עותקים</h2>
            <label className={styles.field}>
              ספר
              <select value={bookId} onChange={(event) => chooseBook(event.target.value)}>
                {!bookId && <option value="">בחרי ספר…</option>}
                {books.map((book) => <option key={book.id} value={book.id}>{book.title}</option>)}
              </select>
            </label>
            {requestedMissing && (
              <p className={styles.warning} role="status">הספר שבקישור לא נמצא ברשימת העותקים.</p>
            )}
            {visibleCopies.map(({ copy, loaned }, index) => (
              <div className={styles.item} key={copy.id}>
                <label className={styles.check}>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(copy.id)}
                    onChange={() => toggleCopy(copy.id)}
                  />
                  עותק {index + 1}
                </label>
                <span>
                  <span className={loaned ? `${styles.pill} ${styles.neutral}` : styles.pill}>
                    {loaned ? 'מושאל' : 'זמין'}
                  </span>
                  <small>{copy.barcode}</small>
                </span>
              </div>
            ))}
            {bookId && visibleCopies.length === 0 && <p className={styles.muted}>לא נמצאו עותקים לספר הזה.</p>}
            <p className={styles.muted}>הברקודים כבר קיימים. הפקת מדבקה לא משנה את מזהה העותק.</p>
          </section>

          <section className={styles.preview}>
            {preview ? (
              <div className={styles.label}>
                <strong>{preview.book.title}</strong>
                <small>ספריית בית הספר · גיל {preview.book.ageGroup}</small>
                <BarcodeImage barcode={preview.copy.barcode} />
              </div>
            ) : (
              <div className={styles.label}><small>בחרי ספר כדי לראות מדבקה.</small></div>
            )}
            <p className={styles.muted}>תצוגה מוגדלת לסריקה מהמסך. נדרש סורק שתומך בקריאה ממסך.</p>
            <a className={styles.btn} href="#/09-circulation">לעמדת הסריקה ←</a>
          </section>
        </div>
      )}
    </main>
  );
}
