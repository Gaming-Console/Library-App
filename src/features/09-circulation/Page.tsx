import { useEffect, useRef, useState } from 'react';
import type { CopyView, Student } from '../../shared/types';
import styles from './Page.module.css';

function todayISO() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function displayDate(value: string) {
  const [year, month, day] = value.split('-');
  return `${day}.${month}.${year}`;
}

function addDays(value: string, days: number) {
  const [year, month, day] = value.split('-').map(Number);
  const result = new Date(year, month - 1, day + days);
  return `${result.getFullYear()}-${String(result.getMonth() + 1).padStart(2, '0')}-${String(result.getDate()).padStart(2, '0')}`;
}

export default function Page() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [barcode, setBarcode] = useState('');
  const [view, setView] = useState<CopyView | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [studentsError, setStudentsError] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [borrowedOn, setBorrowedOn] = useState(todayISO());
  const [returnedOn, setReturnedOn] = useState(todayISO());
  const [loanDays, setLoanDays] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'error' | 'success' | 'info'; text: string } | null>(null);
  const [demoState, setDemoState] = useState<'available' | 'borrowed'>('available');

  useEffect(() => {
    inputRef.current?.focus();
    void fetchStudents();
    void fetchLoanDays();
  }, []);

  async function fetchLoanDays() {
    try {
      const response = await fetch('/api/settings');
      if (!response.ok) throw new Error('No settings API');
      const settings = await response.json() as { loanDays?: number };
      if (Number.isInteger(settings.loanDays)) setLoanDays(settings.loanDays as number);
    } catch {
      setLoanDays(null);
    }
  }

  async function fetchStudents() {
    try {
      const response = await fetch('/api/students');
      if (!response.ok) throw new Error('Students request failed');
      const payload = await response.json() as { items?: Student[] };
      const next = Array.isArray(payload.items) ? payload.items : [];
      setStudents(next);
      setStudentsError(null);
      setSelectedStudentId(next[0]?.id ?? '');
    } catch {
      setStudents([]);
      setSelectedStudentId('');
      setStudentsError('לא ניתן לטעון את רשימת התלמידות, ולכן אי אפשר להשאיל. רענני את הדף ונסי שוב.');
    }
  }

  async function loadCopy(rawBarcode: string) {
    const value = rawBarcode.trim();
    if (!/^LIB-\d{6}$/.test(value)) {
      setFeedback({ kind: 'error', text: 'הברקוד חייב להיות בפורמט LIB-000001' });
      return;
    }

    setBusy(true);
    setFeedback(null);
    try {
      const response = await fetch(`/api/scan/${encodeURIComponent(value)}`);
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error?.message ?? 'לא הצלחתי לקרוא את העותק');
      }
      const nextView = await response.json() as CopyView;
      setView(nextView);
      setBarcode(value);
      setDemoState(nextView.activeLoan ? 'borrowed' : 'available');
      setFeedback({ kind: 'success', text: nextView.activeLoan ? 'העותק מושאל — אפשר להחזיר אותו.' : 'העותק פנוי — אפשר להשאיל אותו.' });
      setReturnedOn(todayISO());
      if (nextView.activeLoan) {
        setBorrowedOn(nextView.activeLoan.borrowedOn);
      } else {
        setBorrowedOn(todayISO());
      }
    } catch (error) {
      setView(null);
      setFeedback({ kind: 'error', text: error instanceof Error ? error.message : 'לא ניתן לטעון את העותק' });
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  async function handleCheckout() {
    if (!view || view.activeLoan) return;
    setBusy(true);
    setFeedback(null);
    try {
      const response = await fetch('/api/circulation/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: selectedStudentId, barcode: view.copy.barcode, borrowedOn: borrowedOn }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error?.message ?? 'לא ניתן לבצע השאלה');
      }
      setFeedback({ kind: 'success', text: 'ההשאלה נשמרה.' });
      setBarcode('');
      setView(null);
      setDemoState('available');
      setBorrowedOn(todayISO());
      inputRef.current?.focus();
    } catch (error) {
      setFeedback({ kind: 'error', text: error instanceof Error ? error.message : 'לא ניתן להשאיל עותק' });
    } finally {
      setBusy(false);
    }
  }

  async function handleReturn() {
    if (!view || !view.activeLoan) return;
    setBusy(true);
    setFeedback(null);
    try {
      const response = await fetch('/api/circulation/return', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barcode: view.copy.barcode, returnedOn: returnedOn }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error?.message ?? 'לא ניתן לבצע החזרה');
      }
      setFeedback({ kind: 'success', text: 'ההחזרה נשמרה.' });
      setBarcode('');
      setView(null);
      setDemoState('available');
      setReturnedOn(todayISO());
      inputRef.current?.focus();
    } catch (error) {
      setFeedback({ kind: 'error', text: error instanceof Error ? error.message : 'לא ניתן להחזיר עותק' });
    } finally {
      setBusy(false);
    }
  }

  const selectedStudent = students.find((student) => student.id === selectedStudentId) ?? students[0];
  const activeDemo = demoState === 'borrowed';

  return (
        <main className={styles.screen}>
        <div className={styles.pageHead}>
          <div>
            <span className={styles.eyebrow}>ליבת העבודה בספרייה</span>
            <h1>סריקה אחת. הפעולה הנכונה.</h1>
            <p>עותק זמין? משאילות. עותק מושאל? מחזירות. באותה עמדה.</p>
          </div>
          <div className={styles.actions}>
            <button type="button" className={`${styles.demoToggle} ${!activeDemo ? styles.demoActive : ''}`} onClick={() => { setDemoState('available'); setView(null); setBarcode(''); inputRef.current?.focus(); }}>עותק פנוי</button>
            <button type="button" className={`${styles.demoToggle} ${activeDemo ? styles.demoActive : ''}`} onClick={() => { setDemoState('borrowed'); setView(null); setBarcode(''); inputRef.current?.focus(); }}>עותק מושאל</button>
          </div>
        </div>

        <div className={styles.scanBox}>
          <section className={styles.panel}>
            <div className={styles.scanTitle}>
              <h2>סריקת ברקוד ספרייה</h2>
              <span className={styles.pill}>מוכנה לסריקה</span>
            </div>

            <label className={styles.field}>
              <span>סרקי או הקלידי קוד ואשרי Enter</span>
              <input
                ref={inputRef}
                className={styles.scanInput}
                value={barcode}
                onChange={(event) => setBarcode(event.target.value.toUpperCase())}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    void loadCopy(barcode);
                  }
                }}
                autoComplete="off"
                inputMode="text"
              />
            </label>

            {view ? (
            <div className={styles.scanResult}>
              <div className={styles.scanStage}>
                <div className={styles.bookStamp}>{view.book.title}</div>
                <div>
                  <h2>{view.book.title}</h2>
                  <p className={styles.muted}>גיל {view.book.ageGroup} · {view.copy.barcode}</p>
                  <span className={`${styles.pill} ${view.activeLoan ? styles.neutralPill : styles.goodPill}`}>
                    {view.activeLoan ? 'מושאל — אפשר להחזיר' : 'זמין — אפשר להשאיל'}
                  </span>
                </div>
              </div>

              {view.activeLoan ? (
                <>
                  <div className={styles.callout}>
                    <b>נמצא אצל {view.borrower?.fullName ?? 'לא נבחרה'} · {view.borrower?.className ?? ''}</b><br />
                    מועד החזרה: <span className={styles.mono}>{displayDate(view.activeLoan.dueOn)}</span><br />
                    אישור החזרה יסגור את ההשאלה וישמור אותה בהיסטוריה.
                  </div>
                  <button className={styles.primaryBtn} type="button" onClick={() => void handleReturn()} disabled={busy}>
                    אישור החזרה למדף
                  </button>
                </>
              ) : (
                <>
                  {studentsError ? (
                    <p className={styles.notice} role="alert">{studentsError}</p>
                  ) : students.length === 0 ? (
                    <p className={styles.notice} role="status">אין עדיין תלמידות במערכת. <a href="#/07-students">להוספת תלמידות</a> או <a href="#/06-student-import">לייבוא מאקסל</a>.</p>
                  ) : (
                    <label className={styles.field}>
                      <span>למי משאילות?</span>
                      <select value={selectedStudentId} onChange={(event) => setSelectedStudentId(event.target.value)}>
                        {students.map((student) => (
                          <option key={student.id} value={student.id}>{student.fullName} · {student.className} · {student.schoolId}</option>
                        ))}
                      </select>
                    </label>
                  )}

                  <div className={styles.callout}>
                    מועד ההחזרה הצפוי: <b><span className={styles.mono}>{loanDays ? displayDate(addDays(borrowedOn, loanDays)) : '—'}</span></b>
                    {loanDays ? ` · לפי מדיניות של ${loanDays} ימים` : ' · מדיניות ההשאלה לא נטענה'}
                  </div>
                  <button className={styles.primaryBtn} type="button" onClick={() => void handleCheckout()} disabled={busy || !selectedStudent}>
                    אישור השאלה ל{selectedStudent?.fullName ?? 'תלמידה'}
                  </button>
                </>
              )}
            </div>
            ) : (
              <p className={styles.emptyState}>הקלידי או סרקי ברקוד כדי להציג את פרטי העותק.</p>
            )}
          </section>

          <p className={styles.helperText}>הפעולה מתבצעת רק לאחר אישור. בסיום, המיקוד חוזר לשדה הסריקה.</p>
        </div>

        {feedback && (
          <div className={`${styles.notice} ${styles[feedback.kind]}`} role={feedback.kind === 'error' ? 'alert' : 'status'}>
            {feedback.text}
          </div>
        )}
        </main>
  );
}
