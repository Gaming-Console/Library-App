import { useEffect, useRef, useState } from 'react';
import type { CopyView, Student } from '../../shared/types';
import styles from './Page.module.css';

const fallbackStudents: Student[] = [
  { id: 'student-1', schoolId: 'S001', fullName: 'תמר לדוגמה', className: 'ד1' },
  { id: 'student-2', schoolId: 'S002', fullName: 'נועה לדוגמה', className: 'ה2' },
  { id: 'student-3', schoolId: 'S003', fullName: 'ליה לדוגמה', className: 'ג1' },
];

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

export default function Page() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [barcode, setBarcode] = useState('');
  const [view, setView] = useState<CopyView | null>(null);
  const [students, setStudents] = useState<Student[]>(fallbackStudents);
  const [selectedStudentId, setSelectedStudentId] = useState(fallbackStudents[0]?.id ?? '');
  const [borrowedOn, setBorrowedOn] = useState(todayISO());
  const [returnedOn, setReturnedOn] = useState(todayISO());
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'error' | 'success' | 'info'; text: string } | null>(null);
  const [demoState, setDemoState] = useState<'available' | 'borrowed'>('available');

  useEffect(() => {
    inputRef.current?.focus();
    void fetchStudents();
  }, []);

  async function fetchStudents() {
    try {
      const response = await fetch('/api/students');
      if (!response.ok) throw new Error('No students API');
      const payload = await response.json() as { items?: Student[] };
      const next = Array.isArray(payload.items) && payload.items.length > 0 ? payload.items : fallbackStudents;
      setStudents(next);
      if (next[0]) setSelectedStudentId(next[0].id);
    } catch {
      setStudents(fallbackStudents);
      if (fallbackStudents[0]) setSelectedStudentId(fallbackStudents[0].id);
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
    <div className={styles.appShell}>
      <aside className={styles.sidebar}>
        <a className={styles.brand} href="/workshop/mockups.html#03">
          <b className={styles.brandIcon}>מ</b>
          <span>מדף<small>ספריית בית הספר</small></span>
        </a>
        <span className={styles.navLabel}>מרחב העבודה</span>
        <nav className={styles.navigation} aria-label="מרחב העבודה">
          <a href="/workshop/mockups.html#03"><span className={styles.navSymbol}>▤</span>קטלוג ספרים</a>
          <a href="/workshop/mockups.html#09" aria-current="page"><span className={styles.navSymbol}>⌁</span>עמדת סריקה</a>
          <a href="/workshop/mockups.html#07"><span className={styles.navSymbol}>♙</span>תלמידות</a>
          <a href="/workshop/mockups.html#11"><span className={styles.navSymbol}>≡</span>מעקב השאלות</a>
          <a href="/workshop/mockups.html#02"><span className={styles.navSymbol}>＋</span>קליטת ספרים</a>
          <a href="/workshop/mockups.html#05"><span className={styles.navSymbol}>▥</span>ברקודים</a>
          <a href="/workshop/mockups.html#01"><span className={styles.navSymbol}>↓</span>גיבוי ושחזור</a>
          <a href="/workshop/mockups.html#12"><span className={styles.navSymbol}>⚙</span>הגדרות</a>
        </nav>
        <div className={styles.librarian}>
          <span className={styles.avatar}>ס</span>
          <div>עמדת הספרנית<small>הכול מתחיל בספר טוב</small></div>
        </div>
      </aside>

      <main className={styles.appMain}>
        <header className={styles.topBar}>
          <div className={styles.localSummary}>
            <span>ספריית בית הספר</span>
            <span className={styles.divider}>/</span>
            <span>עמדת סריקה — השאלה והחזרה</span>
          </div>
          <div className={styles.localMeta}><span className={styles.localDot} />עמדה מקומית · SQLite</div>
        </header>

        <div className={styles.screen}>
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
                  <label className={styles.field}>
                    <span>למי משאילות?</span>
                    <select value={selectedStudentId} onChange={(event) => setSelectedStudentId(event.target.value)}>
                      {students.map((student) => (
                        <option key={student.id} value={student.id}>{student.fullName} · {student.className} · {student.schoolId}</option>
                      ))}
                    </select>
                  </label>

                  <div className={styles.callout}>
                    מועד ההחזרה הצפוי: <b><span className={styles.mono}>09.11.2026</span></b> · לפי מדיניות של 14 ימים
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
        </div>
        <footer className={styles.footer}>נתוני דוגמה בלבד · 26 באוקטובר 2026</footer>
      </main>
    </div>
  );
}
