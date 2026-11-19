import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import Icon from './Icon';
import styles from './Shell.module.css';
import { activeTabId, screenTitles, sectionHome, sectionOf, sections } from './routes';

const ZOOM_KEY = 'library.largeView';

function readLarge(): boolean {
  try { return localStorage.getItem(ZOOM_KEY) === '1'; } catch { return false; }
}

export default function Shell({ route, children }: { route: string; children: ReactNode }) {
  const section = sectionOf(route);
  const activeTab = activeTabId(route);
  const title = screenTitles[route];
  const content = useRef<HTMLDivElement>(null);
  const [large, setLarge] = useState(readLarge);

  // כותרת הלשונית והמיקוד עוברים עם הניווט, כדי שקורא מסך ומקלדת לא יישארו בעמוד הקודם.
  useEffect(() => {
    document.title = `${title ?? 'מדף'} · מדף`;
    content.current?.focus({ preventScroll: true });
    scrollTo(0, 0);
  }, [route, title]);

  function toggleLarge() {
    setLarge((value) => {
      try { localStorage.setItem(ZOOM_KEY, value ? '0' : '1'); } catch { /* התצוגה עדיין משתנה */ }
      return !value;
    });
  }

  const daily = sections.filter((s) => !s.utility);
  const utility = sections.filter((s) => s.utility);
  const link = (s: (typeof sections)[number]) => (
    <a key={s.id} href={sectionHome(s)} aria-current={s.id === section?.id ? 'page' : undefined}>
      <Icon name={s.id} />
      <span>{s.label}</span>
    </a>
  );

  return (
    <div className={styles.app}>
      <a className={styles.skip} href="#content" onClick={(e) => { e.preventDefault(); content.current?.focus(); }}>
        דילוג לתוכן
      </a>
      <aside className={styles.sidebar}>
        <a className={styles.brand} href={sectionHome(sections[0])}>
          <b className={styles.brandIcon} aria-hidden="true">מ</b>
          <span>מדף<small>ספריית בית הספר</small></span>
        </a>
        <nav aria-label="ניווט ראשי" className={styles.nav}>
          {daily.map(link)}
          <span className={styles.spacer} />
          {utility.map(link)}
        </nav>
        <div className={styles.footer}>
          <button type="button" className={styles.zoom} aria-pressed={large} onClick={toggleLarge}>
            <Icon name="zoom" />
            <span>{large ? 'תצוגה רגילה' : 'תצוגה גדולה'}</span>
          </button>
          <p className={styles.local}>הנתונים נשמרים במחשב הזה בלבד</p>
        </div>
      </aside>
      <div className={styles.workspace}>
        {section && section.tabs.length > 1 && (
          <nav className={styles.tabs} aria-label={section.label}>
            {section.tabs.map((tab) => (
              <a key={tab.id} href={`#/${tab.id}`} aria-current={tab.id === activeTab ? 'page' : undefined}>{tab.label}</a>
            ))}
          </nav>
        )}
        <div id="content" ref={content} tabIndex={-1} className={`${styles.content} ${large ? styles.large : ''}`}>
          {children}
        </div>
      </div>
    </div>
  );
}
