import { useEffect, useState } from 'react';
import type { LoanView } from '../../shared/types';
import styles from './Page.module.css';
import { buildLoansCsv, localToday } from './csv';

type LoanStatus = 'active' | 'overdue' | 'all';
const statusOptions: Array<{ value: LoanStatus; label: string }> = [
  { value: 'active', label: 'פעילות' },
  { value: 'overdue', label: 'באיחור' },
  { value: 'all', label: 'הכול' },
];

async function getItems(params: URLSearchParams, signal: AbortSignal) {
  const response = await fetch(`/api/loans?${params}`, { signal });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    throw new Error(body?.error?.message || 'לא ניתן לטעון את רשימת ההשאלות.');
  }
  const body = await response.json() as { items: LoanView[] };
  return body.items;
}

function formatDate(value: string) {
  const [year, month, day] = value.split('-');
  return `${day}.${month}.${year}`;
}

export default function Page() {
  const [items, setItems] = useState<LoanView[]>([]);
  const [classes, setClasses] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [className, setClassName] = useState('');
  const [status, setStatus] = useState<LoanStatus>('active');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [classError, setClassError] = useState('');
  const today = localToday();

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ status: 'all', today });
    getItems(params, controller.signal)
      .then((allItems) => setClasses([...new Set(allItems.map((item) => item.student.className))].sort((a, b) => a.localeCompare(b, 'he'))))
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setClassError(reason instanceof Error ? reason.message : 'לא ניתן לטעון את רשימת הכיתות.');
      });
    return () => controller.abort();
  }, [today]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ q: query, className, status, today });
    setLoading(true);
    setError('');
    getItems(params, controller.signal)
      .then(setItems)
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setItems([]);
          setError(reason instanceof Error ? reason.message : 'לא ניתן לטעון את רשימת ההשאלות.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [query, className, status, today]);

  function downloadCsv() {
    const blob = new Blob([buildLoansCsv(items, today)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `loans-${today}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className={styles.page} dir="rtl">
      <header className={styles.header}>
        <div>
          <a className={styles.backLink} href="#/03-catalog">חזרה לקטלוג</a>
          <h1>מעקב השאלות</h1>
          <p>רשימת ההשאלות בספרייה</p>
        </div>
        <button className={styles.exportButton} type="button" onClick={downloadCsv} disabled={loading || !!error || items.length === 0}>
          <span aria-hidden="true">⇩</span>
          הורדת CSV
        </button>
      </header>

      <section className={styles.filters} aria-label="סינון השאלות">
        <label className={styles.searchField}>
          <span>חיפוש</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="שם תלמידה, ספר או ברקוד"
          />
        </label>
        <label className={styles.classField}>
          <span>כיתה</span>
          <select value={className} onChange={(event) => setClassName(event.target.value)}>
            <option value="">כל הכיתות</option>
            {classes.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
        <div className={styles.statusField} role="group" aria-label="סטטוס השאלה">
          <span>סטטוס</span>
          <div className={styles.segmented}>
            {statusOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={status === option.value}
                onClick={() => setStatus(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {classError && <p className={styles.warning} role="alert">{classError}</p>}
      {error ? (
        <p className={styles.error} role="alert">{error}</p>
      ) : loading ? (
        <p className={styles.message} role="status">טוענת השאלות…</p>
      ) : items.length === 0 ? (
        <p className={styles.message} role="status">לא נמצאו השאלות התואמות לסינון.</p>
      ) : (
        <div className={styles.tableRegion}>
          <table>
            <caption className={styles.caption}>נמצאו {items.length} השאלות</caption>
            <thead>
              <tr>
                <th scope="col">תלמידה</th>
                <th scope="col">כיתה</th>
                <th scope="col">ספר</th>
                <th scope="col">ברקוד</th>
                <th scope="col">מועד החזרה</th>
                <th scope="col">סטטוס</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const returned = item.loan.returnedOn !== null;
                const overdue = !returned && (item.overdue || item.loan.dueOn < today);
                return (
                  <tr key={item.loan.id}>
                    <td><a href={`#/08-student-card?id=${encodeURIComponent(item.student.id)}`}>{item.student.fullName}</a></td>
                    <td>{item.student.className}</td>
                    <td><a href={`#/04-book?id=${encodeURIComponent(item.book.id)}`}>{item.book.title}</a></td>
                    <td><span className={styles.barcode} dir="ltr">{item.copy.barcode}</span></td>
                    <td><time dateTime={item.loan.dueOn} dir="ltr">{formatDate(item.loan.dueOn)}</time></td>
                    <td>
                      <span className={`${styles.status} ${returned ? styles.returned : overdue ? styles.overdue : styles.active}`}>
                        {returned ? 'הוחזרה' : overdue ? 'באיחור' : 'פעילה'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}