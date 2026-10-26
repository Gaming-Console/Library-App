import styles from './NotBuilt.module.css';
import { screenTitles } from './routes';

export default function NotBuilt({ route }: { route: string }) {
  const title = screenTitles[route];
  return (
    <section className={styles.box} role="status">
      <h1>{title ?? 'המסך לא נמצא'}</h1>
      <p>{title ? 'המסך הזה עדיין לא נבנה. הוא יופיע כאן אחרי מיזוג המשימה שלו.' : 'הכתובת אינה מוכרת.'}</p>
      <a href="#/03-catalog">חזרה לקטלוג הספרים ←</a>
    </section>
  );
}
