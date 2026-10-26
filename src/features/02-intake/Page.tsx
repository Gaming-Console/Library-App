import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { ApiError, Book, BookInput } from '../../shared/types';
import styles from './Page.module.css';

interface IntakeCopy {
  id: string;
  bookId: string;
  barcode: string;
}

interface IntakeResponse {
  copyIds: string[];
  copies: IntakeCopy[];
}

interface BookListResponse {
  items: Book[];
}

type Mode = 'new' | 'existing';

const navItems = [
  { href: '#/03-catalog', icon: '▤', title: 'קטלוג ספרים', current: false },
  { href: '#/09-circulation', icon: '⌁', title: 'עמדת סריקה', current: false },
  { href: '#/07-students', icon: '♙', title: 'תלמידות', current: false },
  { href: '#/11-loans', icon: '≡', title: 'מעקב השאלות', current: false },
  { href: '#/02-intake', icon: '＋', title: 'קליטת ספרים', current: true },
  { href: '#/05-labels', icon: '▥', title: 'ברקודים', current: false },
  { href: '#/01-storage', icon: '↓', title: 'גיבוי ושחזור', current: false },
  { href: '#/12-settings', icon: '⚙', title: 'הגדרות', current: false },
];

export default function Page() {
  const [mode, setMode] = useState<Mode>('new');
  const [books, setBooks] = useState<Book[]>([]);
  const [booksLoading, setBooksLoading] = useState(false);
  const [booksError, setBooksError] = useState('');
  const [targetBookId, setTargetBookId] = useState('');
  const [title, setTitle] = useState('');
  const [ageGroup, setAgeGroup] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [requestError, setRequestError] = useState('');
  const [savedCopies, setSavedCopies] = useState<IntakeCopy[] | null>(null);

  useEffect(() => {
    if (mode !== 'existing') return;
    const controller = new AbortController();
    setBooksLoading(true);
    setBooksError('');
    fetch('/api/intake/books', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('לא ניתן לטעון את רשימת הספרים');
        return response.json() as Promise<BookListResponse>;
      })
      .then((data) => setBooks(data.items))
      .catch((error: unknown) => {
        if (error instanceof Error && error.name !== 'AbortError') setBooksError(error.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setBooksLoading(false);
      });
    return () => controller.abort();
  }, [mode]);

  const selectedBook = books.find((book) => book.id === targetBookId);

  function validate(): boolean {
    const errors: Record<string, string> = {};
    const parsedQuantity = Number(quantity);
    if (mode === 'new' && !title.trim()) errors.title = 'יש להזין שם ספר';
    if (mode === 'new' && !ageGroup.trim()) errors.ageGroup = 'יש להזין גיל יעד';
    if (mode === 'existing' && !targetBookId) errors.targetBookId = 'יש לבחור ספר קיים';
    if (!Number.isInteger(parsedQuantity) || parsedQuantity < 1 || parsedQuantity > 100) {
      errors.quantity = 'יש להזין כמות שלמה בין 1 ל־100';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRequestError('');
    setSavedCopies(null);
    if (!validate()) return;

    const input: BookInput = mode === 'new'
      ? { title: title.trim(), ageGroup: ageGroup.trim(), quantity: Number(quantity) }
      : {
          title: selectedBook!.title,
          ageGroup: selectedBook!.ageGroup,
          quantity: Number(quantity),
          targetBookId,
        };
    setSaving(true);
    try {
      const response = await fetch('/api/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [input] }),
      });
      const data = await response.json() as IntakeResponse | ApiError;
      if (!response.ok) {
        setRequestError('error' in data ? data.error.message : 'שמירת הספר נכשלה');
        return;
      }
      if (!('copies' in data) || data.copies.length !== data.copyIds.length) {
        throw new Error('השרת לא החזיר את פרטי העותקים שנוצרו');
      }
      setSavedCopies(data.copies);
      if (mode === 'new') {
        setTitle('');
        setAgeGroup('');
      }
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : 'שמירת הספר נכשלה');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.app} dir="rtl">
      <aside className={styles.sidebar}>
        <a className={styles.brand} href="#/03-catalog">
          <b className={styles.brandIcon}>מ</b>
          <span>מדף<small>ספריית בית הספר</small></span>
        </a>
        <span className={styles.navLabel}>מרחב העבודה</span>
        <nav aria-label="ניווט ראשי" className={styles.nav}>
          {navItems.map((item) => (
            <a key={item.href} href={item.href} aria-current={item.current ? 'page' : undefined}>
              <span className={styles.navSymbol} aria-hidden="true">{item.icon}</span>
              {item.title}
            </a>
          ))}
        </nav>
        <div className={styles.librarian}>
          <span className={styles.avatar} aria-hidden="true">ס</span>
          <div>עמדת הספרנית<small>הכול מתחיל בספר טוב</small></div>
        </div>
      </aside>

      <div className={styles.workspace}>
        <header className={styles.topbar}>
          <span>ספריית בית הספר <b aria-hidden="true">/</b> קליטה ידנית ויצירת עותקים</span>
          <span className={styles.localDot}>עמדה מקומית · SQLite</span>
        </header>

        <main className={styles.screen}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>מוסיפות למדפים</p>
          <h1>קליטה ידנית של ספרים</h1>
          <p>ספר אחד, כמה עותקים — לכל עותק קוד משלו.</p>
        </div>
        <a className={styles.importLink} href="#/10-book-import">ייבוא מאקסל ↗</a>
      </header>

      <div className={styles.layout}>
        <form className={styles.card} onSubmit={submit} noValidate>
          <div className={styles.tabs} role="group" aria-label="סוג קליטה">
            <button
              type="button"
              className={mode === 'new' ? styles.activeTab : ''}
              aria-pressed={mode === 'new'}
              onClick={() => { setMode('new'); setFieldErrors({}); setSavedCopies(null); }}
            >
              ספר חדש
            </button>
            <button
              type="button"
              className={mode === 'existing' ? styles.activeTab : ''}
              aria-pressed={mode === 'existing'}
              onClick={() => { setMode('existing'); setFieldErrors({}); setSavedCopies(null); }}
            >
              עותקים לספר קיים
            </button>
          </div>

          {mode === 'new' ? (
            <>
              <label className={styles.field}>
                <span>שם הספר</span>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  aria-invalid={Boolean(fieldErrors.title)}
                  aria-describedby={fieldErrors.title ? 'title-error' : undefined}
                  autoComplete="off"
                />
                {fieldErrors.title && <span id="title-error" className={styles.fieldError}>{fieldErrors.title}</span>}
              </label>
            </>
          ) : (
            <>
              <label className={styles.field}>
                <span>בחירת ספר קיים</span>
                <select
                  value={targetBookId}
                  onChange={(event) => setTargetBookId(event.target.value)}
                  disabled={booksLoading || Boolean(booksError)}
                  aria-invalid={Boolean(fieldErrors.targetBookId)}
                  aria-describedby={fieldErrors.targetBookId ? 'book-error' : undefined}
                >
                  <option value="">בחרי ספר מהקטלוג</option>
                  {books.map((book) => <option key={book.id} value={book.id}>{book.title} · {book.ageGroup}</option>)}
                </select>
                {fieldErrors.targetBookId && <span id="book-error" className={styles.fieldError}>{fieldErrors.targetBookId}</span>}
                {booksLoading && <span className={styles.hint}>טוענת ספרים…</span>}
                {booksError && <span role="alert" className={styles.fieldError}>{booksError}</span>}
                {!booksLoading && !booksError && books.length === 0 && (
                  <span className={styles.hint}>עדיין אין ספרים בקטלוג. אפשר ליצור ספר חדש.</span>
                )}
              </label>
            </>
          )}

          <div className={styles.formGrid}>
            {mode === 'new' && (
              <label className={styles.field}>
                <span>גיל יעד</span>
                <input
                  value={ageGroup}
                  onChange={(event) => setAgeGroup(event.target.value)}
                  aria-invalid={Boolean(fieldErrors.ageGroup)}
                  aria-describedby={fieldErrors.ageGroup ? 'age-error' : undefined}
                  placeholder="למשל: ה–ו"
                />
                {fieldErrors.ageGroup && <span id="age-error" className={styles.fieldError}>{fieldErrors.ageGroup}</span>}
              </label>
            )}
            <label className={styles.field}>
              <span>כמה עותקים הגיעו?</span>
              <input
                type="number"
                min="1"
                max="100"
                step="1"
                inputMode="numeric"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                aria-invalid={Boolean(fieldErrors.quantity)}
                aria-describedby={fieldErrors.quantity ? 'quantity-error' : 'quantity-hint'}
              />
              {fieldErrors.quantity
                ? <span id="quantity-error" className={styles.fieldError}>{fieldErrors.quantity}</span>
                : <span id="quantity-hint" className={styles.hint}>כמות שלמה בין 1 ל־100</span>}
            </label>
          </div>

          <p className={styles.notice}>
            {mode === 'new'
              ? `ייווצר כותר חדש בקטלוג. מספר העותקים: ${quantity || '0'}. הברקודים יוקצו בשמירה.`
              : 'העותקים יצורפו לספר שנבחר; שם הספר וגיל היעד לא ישתנו.'}
          </p>

          {requestError && <p className={styles.error} role="alert">{requestError}</p>}
          <button className={styles.primary} type="submit" disabled={saving || (mode === 'existing' && booksLoading)}>
            {saving ? 'שומרת…' : mode === 'new' ? 'יצירת ספר ועותקים' : 'הוספת עותקים'}
          </button>
        </form>

        <section className={styles.card} aria-label="מה קורה אחרי השמירה">
          <h2>מה קורה אחרי השמירה?</h2>
          {savedCopies ? (
            <div role="status" className={styles.success}>
              <h3>נוצרו {savedCopies.length} עותקים</h3>
              <p>הברקודים שהוקצו:</p>
              <ul className={styles.barcodeList}>
                {savedCopies.map((copy) => (
                  <li key={copy.id} dir="ltr"><code>{copy.barcode}</code></li>
                ))}
              </ul>
              <a className={styles.labelLink} href={`#/05-labels?bookId=${encodeURIComponent(savedCopies[0].bookId)}`}>
                להפקת מדבקות ←
              </a>
              <a className={styles.secondaryLink} href="#/03-catalog">חזרה לקטלוג הספרים</a>
            </div>
          ) : (
            <>
              <p className={styles.asideHint}>אפשר לפתוח את כרטיס הספר ולהפיק את המדבקות.</p>
              <div className={styles.bookStamp}>{(mode === 'existing' ? selectedBook?.title : title) || 'שם הספר'}</div>
              <hr className={styles.rule} />
              <p className={styles.bookDetail}>גיל יעד: <strong>{mode === 'existing' ? selectedBook?.ageGroup || '—' : ageGroup || '—'}</strong></p>
              <p className={styles.bookDetail}>עותקים חדשים: <strong>{quantity || '0'}</strong></p>
              <p className={styles.asideHint}>הוספה לספר קיים אינה משנה את פרטיו או את העותקים שכבר קיימים.</p>
            </>
          )}
        </section>
      </div>
        </main>
      </div>
    </div>
  );
}
