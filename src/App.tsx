import { lazy, Suspense, useEffect, useState } from 'react';
import type { ComponentType } from 'react';
import styles from './App.module.css';

const modules = import.meta.glob<{ default: ComponentType }>('./features/*/Page.tsx');
const pages = Object.fromEntries(Object.entries(modules).map(([path, load]) => [
  path.split('/')[2], lazy(load),
]));

const navigation = [
  { id: '03-catalog', icon: '▤', label: 'קטלוג ספרים' },
  { id: '09-circulation', icon: '⌁', label: 'עמדת סריקה' },
  { id: '07-students', icon: '♙', label: 'תלמידות' },
  { id: '11-loans', icon: '≡', label: 'מעקב השאלות' },
  { id: '02-intake', icon: '＋', label: 'קליטת ספרים' },
  { id: '05-labels', icon: '▥', label: 'ברקודים' },
  { id: '01-storage', icon: '↓', label: 'גיבוי ושחזור' },
  { id: '12-settings', icon: '⚙', label: 'הגדרות' },
];

const titles: Record<string, string> = {
  '01-storage': 'גיבוי, שחזור ואתחול המאגר',
  '02-intake': 'קליטה ידנית ויצירת עותקים',
  '03-catalog': 'קטלוג הספרים וחיפוש',
  '04-book': 'כרטיס ספר ועריכת פרטים',
  '05-labels': 'מדבקות וברקודים לסריקה',
  '06-student-import': 'ייבוא תלמידות מאקסל',
  '07-students': 'תלמידות — חיפוש ועריכה ידנית',
  '08-student-card': 'כרטיס תלמידה והשאלותיה',
  '09-circulation': 'עמדת סריקה — השאלה והחזרה',
  '10-book-import': 'ייבוא ספרים מאקסל',
  '11-loans': 'מעקב השאלות וייצוא',
  '12-settings': 'הגדרות ומדיניות השאלה',
};

export default function App() {
  const [route, setRoute] = useState(location.hash.slice(2));
  useEffect(() => {
    const change = () => setRoute(location.hash.slice(2));
    addEventListener('hashchange', change);
    return () => removeEventListener('hashchange', change);
  }, []);
  const routeId = route.split('?')[0];
  const Page = pages[routeId];
  if (Page) {
    return (
      <div className={styles.app} dir="rtl">
        <aside className={styles.sidebar}>
          <a className={styles.brand} href="#/03-catalog">
            <b className={styles.brandIcon}>מ</b>
            <span>מדף<small>ספריית בית הספר</small></span>
          </a>
          <span className={styles.navLabel}>מרחב העבודה</span>
          <nav className={styles.navigation} aria-label="מרחב העבודה">
            {navigation.map((item) => (
              <a key={item.id} href={`#/${item.id}`} aria-current={routeId === item.id ? 'page' : undefined}>
                <span className={styles.navSymbol} aria-hidden="true">{item.icon}</span>
                {item.label}
              </a>
            ))}
          </nav>
          <div className={styles.librarian}>
            <span className={styles.avatar}>ס</span>
            <div>עמדת הספרנית<small>הכול מתחיל בספר טוב</small></div>
          </div>
        </aside>
        <div className={styles.workspace}>
          <header className={styles.topbar}>
            <span>ספריית בית הספר <b>/</b> {titles[routeId] ?? 'מדף'}</span>
            <span className={styles.localStatus}>עמדה מקומית · SQLite</span>
          </header>
          <Suspense fallback={<p className={styles.loading}>טוענת מסך…</p>}>
            <Page key={route} />
          </Suspense>
          <footer className={styles.footer}>נתוני דוגמה בלבד · 26 באוקטובר 2026</footer>
        </div>
      </div>
    );
  }
  return (
    <main className="blank">
      <span>סדנת הפיתוח · ספריית בית הספר</span>
      <h1>מתחילות מדף ריק.</h1>
      <p>אין כאן עדיין מערכת ספרייה. אתן תבנו אותה.</p>
      <a href="/workshop/index.html">לכרטיסי המשימה ולהדמיות ←</a>
      {Object.keys(pages).length > 0 && <nav aria-label="מסכים שנבנו">{Object.keys(pages).map((id) => <a key={id} href={`#/${id}`}>{id}</a>)}</nav>}
    </main>
  );
}
