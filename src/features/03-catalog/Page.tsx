import { useEffect, useState } from 'react';
import type { ApiError, CatalogItem } from '../../shared/types';
import styles from './Page.module.css';

const DEFAULT_AGES = ['א–ב', 'ג–ד', 'ה–ו'];

async function loadCatalog(params: URLSearchParams, signal: AbortSignal): Promise<CatalogItem[]> {
  const response = await fetch(`/api/books?${params}`, { signal });
  if (!response.ok) {
    let message = 'טעינת הקטלוג נכשלה';
    try { message = ((await response.json()) as ApiError).error.message; } catch { /* keep default */ }
    throw new Error(message);
  }
  return ((await response.json()) as { items: CatalogItem[] }).items;
}

export default function Page() {
  const [q, setQ] = useState('');
  const [ageGroup, setAgeGroup] = useState('');
  const [availableOnly, setAvailableOnly] = useState(false);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [ages, setAges] = useState(DEFAULT_AGES);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ q: q.trim(), ageGroup, availableOnly: String(availableOnly) });
    setState('loading');
    const timer = setTimeout(() => {
      loadCatalog(params, controller.signal).then((result) => {
        setItems(result);
        setAges((known) => [...new Set([...known, ...result.map((i) => i.book.ageGroup)])]);
        setState('ready');
      }).catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : 'טעינת הקטלוג נכשלה');
        setState('error');
      });
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [q, ageGroup, availableOnly, attempt]);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <a href="#/03-catalog" className={styles.crumb}>קטלוג</a>
          <h1>קטלוג הספרים</h1>
        </div>
        <nav className={styles.links} aria-label="פעולות קשורות">
          <a href="#/02-intake">קליטת ספר</a>
          <a href="#/10-book-import">ייבוא ספרים</a>
          <a href="#/09-circulation">עמדת סריקה</a>
        </nav>
      </header>

      <form className={styles.filters} role="search" onSubmit={(event) => event.preventDefault()}>
        <label className={styles.grow}>
          <span>שם ספר או ברקוד</span>
          <input type="search" value={q} maxLength={100} onChange={(e) => setQ(e.target.value)} placeholder="למשל: מסע או LIB-000002" />
        </label>
        <label>
          <span>גיל</span>
          <select value={ageGroup} onChange={(e) => setAgeGroup(e.target.value)}>
            <option value="">כל הגילאים</option>
            {ages.map((age) => <option key={age} value={age}>{age}</option>)}
          </select>
        </label>
        <label className={styles.check}>
          <input type="checkbox" checked={availableOnly} onChange={(e) => setAvailableOnly(e.target.checked)} />
          <span>זמינים בלבד</span>
        </label>
      </form>

      {state === 'loading' && <p role="status">טוענת קטלוג…</p>}
      {state === 'error' && (
        <div role="alert" className={styles.error}>
          <p>{error}</p>
          <button type="button" onClick={() => setAttempt((n) => n + 1)}>נסי שוב</button>
        </div>
      )}
      {state === 'ready' && items.length === 0 && <p className={styles.empty}>לא נמצאו ספרים התואמים לחיפוש.</p>}
      {state === 'ready' && items.length > 0 && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr><th>שם הספר</th><th>גיל</th><th>עותקים</th><th>זמינים</th></tr>
            </thead>
            <tbody>
              {items.map(({ book, totalCopies, availableCopies }) => (
                <tr key={book.id}>
                  <td><a href={`#/04-book?id=${encodeURIComponent(book.id)}`}>{book.title}</a></td>
                  <td>{book.ageGroup}</td>
                  <td>{totalCopies}</td>
                  <td>
                    <span className={availableCopies > 0 ? styles.yes : styles.no}>
                      {availableCopies > 0 ? `${availableCopies} זמינים` : 'אין עותק פנוי'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
