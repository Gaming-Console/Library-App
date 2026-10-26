import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { ApiError, BookDetails } from '../../shared/types';
import { availableText, formatDate, readBookId } from './helpers';
import styles from './Page.module.css';

type State =
  | { kind: 'loading' }
  | { kind: 'missing' }
  | { kind: 'notFound' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; details: BookDetails };

async function errorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json() as ApiError;
    return body.error.message;
  } catch {
    return 'הפעולה נכשלה. נסי שוב.';
  }
}

export default function Page() {
  const id = readBookId(location.hash);
  const [state, setState] = useState<State>(id ? { kind: 'loading' } : { kind: 'missing' });
  const [title, setTitle] = useState('');
  const [ageGroup, setAgeGroup] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [saved, setSaved] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    (async () => {
      try {
        const response = await fetch(`/api/books/${encodeURIComponent(id)}`, { signal: controller.signal });
        if (response.status === 404) return setState({ kind: 'notFound' });
        if (!response.ok) return setState({ kind: 'error', message: await errorMessage(response) });
        const details = await response.json() as BookDetails;
        setTitle(details.book.title);
        setAgeGroup(details.book.ageGroup);
        setState({ kind: 'ready', details });
      } catch (error) {
        if (!controller.signal.aborted) setState({ kind: 'error', message: 'לא ניתן להתחבר לשרת. בדקי שהשרת פועל.' });
      }
    })();
    return () => controller.abort();
  }, [id]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (state.kind !== 'ready' || !id) return;
    setFormError('');
    setSaved(false);
    if (!title.trim() || !ageGroup.trim()) {
      setFormError('יש למלא שם ספר וגיל יעד');
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(`/api/books/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, ageGroup }),
      });
      if (!response.ok) {
        setFormError(await errorMessage(response));
        return;
      }
      const { book } = await response.json() as { book: BookDetails['book'] };
      setTitle(book.title);
      setAgeGroup(book.ageGroup);
      setState({ kind: 'ready', details: { ...state.details, book } });
      setSaved(true);
      setEditing(false);
    } catch {
      setFormError('לא ניתן להתחבר לשרת. השינויים לא נשמרו.');
    } finally {
      setSaving(false);
    }
  }

  const backLink = <a className={styles.link} href="#/03-catalog">חזרה לקטלוג ←</a>;

  if (state.kind === 'loading') {
    return <main className={styles.page}><div className={styles.inner}><p className={styles.lead}>טוענת כרטיס ספר…</p></div></main>;
  }
  if (state.kind === 'missing' || state.kind === 'notFound') {
    return (
      <main className={styles.page}><div className={styles.inner}>
        <div className={styles.head}><div>
          <span className={styles.eyebrow}><a href="#/03-catalog">קטלוג</a> / כרטיס ספר</span>
          <h1 className={styles.title}>הספר לא נמצא</h1>
        </div></div>
        <section className={styles.panel}>
          <p role="alert" className={styles.notice}>
            {state.kind === 'missing' ? 'לא נבחר ספר. פתחי ספר מתוך הקטלוג.' : 'המזהה שהתקבל אינו מוכר בספרייה.'}
          </p>
        </section>
        <p className={styles.backRow}>{backLink}</p>
      </div></main>
    );
  }
  if (state.kind === 'error') {
    return (
      <main className={styles.page}><div className={styles.inner}>
        <div className={styles.head}><div>
          <span className={styles.eyebrow}><a href="#/03-catalog">קטלוג</a> / כרטיס ספר</span>
          <h1 className={styles.title}>כרטיס ספר</h1>
        </div></div>
        <section className={styles.panel}>
          <p role="alert" className={styles.notice}>{state.message}</p>
        </section>
        <p className={styles.backRow}>{backLink}</p>
      </div></main>
    );
  }

  const { book, copies } = state.details;
  const availableCount = copies.filter((c) => c.activeLoan === null).length;
  return (
    <main className={styles.page}>
      <div className={styles.inner}>
      <div className={styles.head}>
        <div>
          <span className={styles.eyebrow}><a href="#/03-catalog">קטלוג</a> / כרטיס ספר</span>
          <h1 className={styles.title}>{book.title}</h1>
          <p className={styles.lead}>כל העותקים של הספר, במקום אחד.</p>
        </div>
        <div className={styles.actions}>
          <button type="button" className={`${styles.btn} ${styles.secondary}`} onClick={() => { setEditing(!editing); setSaved(false); setFormError(''); }}>עריכת פרטים</button>
          <a className={styles.btn} href={`#/02-intake?targetBookId=${encodeURIComponent(book.id)}`}>＋ הוספת עותקים</a>
        </div>
      </div>

      {saved && <p role="status" className={styles.success}>הפרטים נשמרו</p>}

      <section className={`${styles.panel} ${styles.hero}`} aria-label="פרטי הספר">
        <div className={styles.stamp}>{book.title}</div>
        <div>
          <h2>{book.title}</h2>
          <p className={styles.muted}>גיל יעד {book.ageGroup} · <span className={styles.mono}>{book.id}</span></p>
          <div className={styles.actions}>
            <span className={`${styles.pill} ${styles.neutral}`}>{copies.length === 1 ? 'עותק אחד' : `${copies.length} עותקים`}</span>
            <span className={styles.pill}>{availableText(availableCount)}</span>
            <a className={styles.link} href={`#/05-labels?bookId=${encodeURIComponent(book.id)}`}>למדבקות הספר ←</a>
          </div>
        </div>
      </section>

      {editing && <section className={styles.panel} aria-labelledby="edit-heading">
        <h2 id="edit-heading">עריכת פרטי הספר</h2>
        <form className={styles.form} onSubmit={save}>
          <label className={styles.field}>שם הספר
            <input className={styles.input} value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className={styles.field}>גיל יעד
            <input className={styles.input} value={ageGroup} onChange={(e) => setAgeGroup(e.target.value)} />
          </label>
          {formError && <p role="alert" className={styles.error}>{formError}</p>}
          <div className={styles.actions}>
            <button className={styles.btn} type="submit" disabled={saving}>{saving ? 'שומרת…' : 'שמירה'}</button>
            <button className={`${styles.btn} ${styles.secondary}`} type="button" onClick={() => { setEditing(false); setTitle(book.title); setAgeGroup(book.ageGroup); setFormError(''); }}>ביטול</button>
          </div>
        </form>
      </section>}

      <section className={`${styles.panel} ${styles.tablePanel}`} aria-labelledby="copies-heading">
        <div className={styles.tableTitle}><h2 id="copies-heading">העותקים על המדף ובדרך אליו</h2></div>
        {copies.length === 0 ? <p className={styles.tableTitle}>לספר זה אין עדיין עותקים.</p> : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr><th>ברקוד העותק</th><th>סטטוס</th><th>נמצא אצל</th><th>מועד החזרה</th></tr>
              </thead>
              <tbody>
                {copies.map((c) => (
                  <tr key={c.copy.id}>
                    <td><span className={styles.mono}>{c.copy.barcode}</span></td>
                    <td>{c.activeLoan
                      ? <span className={`${styles.pill} ${styles.neutral}`}>מושאל</span>
                      : <span className={styles.pill}>זמין</span>}</td>
                    <td>{c.borrower
                      ? <a className={styles.link} href={`#/08-student-card?id=${encodeURIComponent(c.borrower.id)}`}>{c.borrower.fullName}</a>
                      : '—'}</td>
                    <td>{c.activeLoan ? <span className={styles.mono}>{formatDate(c.activeLoan.dueOn)}</span> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      </div>
    </main>
  );
}
