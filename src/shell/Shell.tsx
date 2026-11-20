import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import Icon from './Icon';
import Tour from './Tour';
import styles from './Shell.module.css';
import { activeTabId, screenTitles, sectionHome, sectionOf, sections } from './routes';

const ZOOM_KEY = 'library.largeView';
const TOUR_KEY = 'library.tourDone.v1';

function tourSeen(): boolean {
  try { return localStorage.getItem(TOUR_KEY) === '1'; } catch { return true; }
}

function readLarge(): boolean {
  try { return localStorage.getItem(ZOOM_KEY) === '1'; } catch { return false; }
}

export default function Shell({ route, children }: { route: string; children: ReactNode }) {
  const section = sectionOf(route);
  const activeTab = activeTabId(route);
  const title = screenTitles[route];
  const content = useRef<HTMLDivElement>(null);
  const [large, setLarge] = useState(readLarge);
  const [tour, setTour] = useState(() => !tourSeen());
  const tourOpen = useRef(tour);
  tourOpen.current = tour;

  function closeTour() {
    try { localStorage.setItem(TOUR_KEY, '1'); } catch { /* הסיור פשוט יופיע שוב */ }
    setTour(false);
    content.current?.focus({ preventScroll: true });
  }

  // כותרת הלשונית והמיקוד עוברים עם הניווט, כדי שקורא מסך ומקלדת לא יישארו בעמוד הקודם.
  useEffect(() => {
    document.title = `${title ?? 'מדף'} · מדף`;
    if (!tourOpen.current) content.current?.focus({ preventScroll: true });
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
    <a key={s.id} href={sectionHome(s)} data-tour={s.id} aria-current={s.id === section?.id ? 'page' : undefined}>
      <Icon name={s.id} />
      <span>{s.label}</span>
    </a>
  );

  return (
    <div className={styles.app}>
      <a className={styles.skip} href="#content" onClick={(e) => { e.preventDefault(); content.current?.focus(); }}>
        דילוג לתוכן
      </a>
      <aside className={styles.sidebar} aria-label="מדף">
        <a className={styles.brand} href={sectionHome(sections[0])}>
          <img className={styles.logo} src="/logo.png" alt="" width="46" height="56" />
          <span>מדף<small>בית יעקב סלונים · בני ברק</small></span>
        </a>
        <nav aria-label="ניווט ראשי" className={styles.nav}>
          {daily.map(link)}
          <span className={styles.spacer} />
          {utility.map(link)}
        </nav>
        <div className={styles.footer}>
          <button type="button" className={styles.zoom} onClick={() => setTour(true)}>
            <Icon name="help" />
            <span>הדרכה</span>
          </button>
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
      {tour && <Tour onClose={closeTour} />}
    </div>
  );
}
