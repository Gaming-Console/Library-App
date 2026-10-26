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

const copiesLabel = (n: number) => (n === 1 ? 'עותק אחד' : `${n} עותקים`);
const availableLabel = (n: number) => (n === 1 ? 'עותק אחד זמין' : `${n} עותקים זמינים`);

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

  const totalBooks = items.length;
  const totalCopies = items.reduce((sum, item) => sum + item.totalCopies, 0);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>הספרים שלנו</span>
          <h1>מה מחפשות היום?</h1>
          <p>חיפוש לפי שם, גיל או ברקוד — וזמינות שאפשר לסמוך עליה.</p>
          <a href="#/03-catalog" className={styles.crumb}>קטלוג הספרים</a>
        </div>
        <nav className={styles.links} aria-label="פעולות קשורות">
          <a href="#/09-circulation" className={styles.secondary}>עמדת סריקה</a>
          <a href="#/10-book-import" className={styles.secondary}>ייבוא מאקסל</a>
          <a href="#/02-intake" className={styles.primary}>＋ קליטת ספר</a>
        </nav>
      </header>

      <form className={styles.filters} role="search" onSubmit={(event) => event.preventDefault()}>
        <label className={styles.grow}>
          <span className={styles.srOnly}>חיפוש ספרים לפי שם או ברקוד</span>
          <input type="search" value={q} maxLength={100} onChange={(e) => setQ(e.target.value)} placeholder="חיפוש שם ספר או סריקת ברקוד…" />
        </label>
        <label>
          <span className={styles.srOnly}>גיל יעד</span>
          <select value={ageGroup} onChange={(e) => setAgeGroup(e.target.value)}>
            <option value="">כל הגילים</option>
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
        <>
          <p className={styles.summary}>{totalBooks} ספרים בקטלוג · {totalCopies} עותקים</p>
          <div className={styles.grid}>
            {items.map(({ book, totalCopies: total, availableCopies }, index) => (
              <article key={book.id} className={`${styles.card} ${styles[`spine${index % 3}`]}`}>
                <span className={styles.shelf}>B / {String(index + 1).padStart(3, '0')}</span>
                <span className={styles.age}>גיל {book.ageGroup}</span>
                <h2>{book.title}</h2>
                <div className={styles.counts}>
                  <span>{copiesLabel(total)}</span>
                  <span className={availableCopies > 0 ? styles.yes : styles.no}>
                    {availableCopies > 0 ? availableLabel(availableCopies) : 'כל העותקים מושאלים'}
                  </span>
                </div>
                <a href={`#/04-book?id=${encodeURIComponent(book.id)}`} className={styles.open}>פתיחת כרטיס הספר ←</a>
              </article>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
