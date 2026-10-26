import type { ReactNode } from 'react';
import styles from './Shell.module.css';
import { activeNavId, navItems, screenTitles } from './routes';

export default function Shell({ route, children }: { route: string; children: ReactNode }) {
  const active = activeNavId(route);
  const title = screenTitles[route];
  return (
    <div className={styles.app}>
      <aside className={styles.sidebar}>
        <a className={styles.brand} href="#/03-catalog">
          <b className={styles.brandIcon} aria-hidden="true">מ</b>
          <span>מדף<small>ספריית בית הספר</small></span>
        </a>
        <span className={styles.navLabel}>מרחב העבודה</span>
        <nav aria-label="ניווט ראשי">
          {navItems.map((item) => (
            <a key={item.id} href={`#/${item.id}`} aria-current={item.id === active ? 'page' : undefined}>
              <span className={styles.navSymbol} aria-hidden="true">{item.icon}</span>
              {item.label}
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
          <span>ספריית בית הספר{title && <><b aria-hidden="true">/</b>{title}</>}</span>
          <span className={styles.localDot}>עמדה מקומית · SQLite</span>
        </header>
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}
