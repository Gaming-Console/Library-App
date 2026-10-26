import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { StudentDetails, LoanView } from '../../shared/types';
import styles from './Page.module.css';

type Tab = 'active' | 'history';
const navigation = [
  ['03-catalog', '▤', 'קטלוג ספרים'],
  ['09-circulation', '⌁', 'עמדת סריקה'],
  ['07-students', '♙', 'תלמידות'],
  ['11-loans', '≡', 'מעקב השאלות'],
  ['02-intake', '＋', 'קליטת ספרים'],
  ['05-labels', '▥', 'ברקודים'],
  ['01-storage', '↓', 'גיבוי ושחזור'],
  ['12-settings', '⚙', 'הגדרות'],
] as const;

function AppFrame({ children }: { children: ReactNode }) {
  const [captureToolsVisible, setCaptureToolsVisible] = useState(true);
  const today = new Intl.DateTimeFormat('he-IL', {
    day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date());

  useEffect(() => {
    const showCaptureTools = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCaptureToolsVisible(true);
    };
    window.addEventListener('keydown', showCaptureTools);
    return () => window.removeEventListener('keydown', showCaptureTools);
  }, []);

  return (
    <>
      {captureToolsVisible && (
        <div className={styles.captureTools}>
          <a href="/workshop/index.html">← לערכת הסדנה</a>
          <label>הדמיית משימה
            <select aria-label="בחירת הדמיה" value="08" disabled>
              <option value="08">08 · כרטיס תלמידה והשאלותיה</option>
            </select>
          </label>
          <button type="button" onClick={() => setCaptureToolsVisible(false)}>מצב צילום</button>
          <span>הדמיה חזותית בלבד · לא מערכת עובדת · Esc מחזיר את הכלים</span>
        </div>
      )}
      <div className={`${styles.appShell} ${captureToolsVisible ? '' : styles.captureMode}`}>
      <aside className={styles.sidebar}>
        <a className={styles.brand} href="#/03-catalog">
          <b className={styles.brandIcon}>מ</b>
          <span><strong>מדף</strong><small>ספריית בית הספר</small></span>
        </a>
        <span className={styles.navLabel}>מרחב העבודה</span>
        <nav className={styles.sideNav} aria-label="מרחב העבודה">
          {navigation.map(([route, icon, label]) => (
            <a href={`#/${route}`} key={route}>
              <span className={styles.navSymbol} aria-hidden="true">{icon}</span>{label}
            </a>
          ))}
        </nav>
        <div className={styles.librarian}>
          <span className={styles.librarianAvatar}>ס</span>
          <div>עמדת הספרנית<small>הכול מתחיל בספר טוב</small></div>
        </div>
      </aside>
      <div className={styles.mainArea}>
        <header className={styles.topbar}>
          <span>ספריית בית הספר <b>/</b> כרטיס תלמידה והשאלותיה</span>
          <span className={styles.localLabel}>עמדה מקומית · SQLite</span>
        </header>
        {children}
        <footer className={styles.footer}>נתוני דוגמה בלבד · {today}</footer>
      </div>
      </div>
    </>
  );
}

function localDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function formatDate(value: string) {
  const [year, month, day] = value.split('-');
  return `${day}.${month}.${year}`;
}

function LoanEntry({ item, history }: { item: LoanView; history: boolean }) {
  const date = history ? item.loan.returnedOn! : item.loan.dueOn;
  const status = history ? 'הוחזר' : item.overdue ? 'באיחור' : 'מושאל';
  return (
    <tr className={item.overdue ? styles.overdue : undefined}>
      <td><a href={`#/04-book?id=${encodeURIComponent(item.book.id)}`}>{item.book.title}</a></td>
      <td><span className={styles.barcode} dir="ltr">{item.copy.barcode}</span></td>
      <td>
        <div className={styles.dueDate}>
          <time dir="ltr">{formatDate(date)}</time>
          <small className={styles.statusCaption}>
            <span className={`${styles.statusPill} ${item.overdue ? styles.overduePill : ''}`}>{status}</span>
          </small>
        </div>
      </td>
    </tr>
  );
}

export default function Page() {
  const [details, setDetails] = useState<StudentDetails | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('active');
  const studentId = new URLSearchParams(location.hash.split('?')[1] ?? '').get('id');

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!studentId) {
        setError('לא נבחרה תלמידה להצגה.');
        setStatus('error');
        return;
      }
      try {
        const response = await fetch(`/api/students/${encodeURIComponent(studentId)}/card?today=${localDate()}`);
        const payload = await response.json().catch(() => null) as { error?: { message?: string } } | StudentDetails | null;
        if (!response.ok) {
          throw new Error(payload && 'error' in payload ? payload.error?.message : 'טעינת הכרטיס נכשלה.');
        }
        if (mounted) {
          setDetails(payload as StudentDetails);
          setStatus('ready');
        }
      } catch (reason) {
        if (mounted) {
          setError(reason instanceof Error ? reason.message : 'טעינת הכרטיס נכשלה.');
          setStatus('error');
        }
      }
    }
    void load();
    return () => { mounted = false; };
  }, [studentId]);

  if (status === 'loading') return <AppFrame><main className={styles.page} aria-busy="true"><p role="status">טוענת כרטיס תלמידה…</p></main></AppFrame>;
  if (status === 'error') return <AppFrame><main className={styles.page}><p className={styles.error} role="alert">{error}</p><a href="#/07-students">חזרה לרשימת התלמידות</a></main></AppFrame>;
  if (!details) return null;

  const active = details.loans
    .filter((item) => item.loan.returnedOn === null)
    .sort((first, second) => second.loan.borrowedOn.localeCompare(first.loan.borrowedOn));
  const history = details.loans
    .filter((item) => item.loan.returnedOn !== null)
    .sort((first, second) => second.loan.returnedOn!.localeCompare(first.loan.returnedOn!));
  const visibleLoans = tab === 'active' ? active : history;
  const firstName = details.student.fullName.trim().split(/\s+/)[0];
  const summary = [
    active.length === 1 ? 'השאלה פעילה אחת' : `${active.length} השאלות פעילות`,
    history.length === 1 ? 'ספר אחד שהוחזר' : `${history.length} ספרים שהוחזרו`,
  ].join(' · ');

  return (
    <AppFrame>
      <main className={styles.page}>
        <header className={styles.pageHead}>
          <div className={styles.headingText}>
            <p className={styles.eyebrow}>תלמידות / כרטיס אישי</p>
            <h1>{details.student.fullName}</h1>
            <p className={styles.subtitle}>כיתה {details.student.className} · מזהה בית־ספרי <span dir="ltr">{details.student.schoolId}</span></p>
          </div>
          <a className={styles.secondaryButton} href="#/07-students">עריכת פרטים ↗</a>
        </header>

        <div className={styles.contentGrid}>
          <section className={styles.panel} aria-labelledby="loans-title">
          <div className={styles.profile}>
            <span className={styles.avatar} aria-hidden="true">{firstName.slice(0, 1)}</span>
            <div>
              <h2 id="loans-title">הספרים של {firstName}</h2>
              <p className={styles.panelSummary}>{summary}</p>
            </div>
          </div>

          <div className={styles.panelTabs} role="tablist" aria-label="סוג השאלות">
            <button type="button" role="tab" aria-selected={tab === 'active'} onClick={() => setTab('active')}>
              אצלה עכשיו <span>{active.length}</span>
            </button>
            <button type="button" role="tab" aria-selected={tab === 'history'} onClick={() => setTab('history')}>
              היסטוריה <span>{history.length}</span>
            </button>
          </div>

          <div className={styles.tableWrap} role="tabpanel">
            <table className={styles.loanTable}>
              <thead><tr><th>ספר</th><th>ברקוד</th><th>{tab === 'history' ? 'תאריך החזרה' : 'מועד החזרה'}</th></tr></thead>
              <tbody>
                {visibleLoans.length ? visibleLoans.map((item) => (
                  <LoanEntry key={item.loan.id} item={item} history={tab === 'history'} />
                )) : (
                  <tr><td className={styles.empty} colSpan={3}>
                    {tab === 'active' ? 'אין כרגע ספרים בהשאלה אצל התלמידה.' : 'עדיין אין היסטוריית החזרות.'}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
          </section>

          <aside className={styles.panel} aria-labelledby="reader-card-title">
            <h2 id="reader-card-title">כרטיס הקוראת</h2>
            <dl className={styles.readerDetails}>
              <div><dt>שם מלא</dt><dd>{details.student.fullName}</dd></div>
              <div><dt>כיתה</dt><dd>{details.student.className}</dd></div>
              <div><dt>מזהה בית־ספרי</dt><dd className={styles.barcode} dir="ltr">{details.student.schoolId}</dd></div>
            </dl>
            <p className={styles.cardNote}>השאלה והחזרה מבצעים בעמדת הסריקה. הכרטיס מתעדכן מהמידע השמור.</p>
            <a className={styles.primaryButton} href="#/09-circulation">לעמדת הסריקה ←</a>
          </aside>
        </div>
      </main>
    </AppFrame>
  );
}