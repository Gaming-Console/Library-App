import styles from './NotBuilt.module.css';

export default function NotBuilt() {
  return (
    <section className={styles.box} role="alert">
      <h1>העמוד לא נמצא</h1>
      <p>הקישור הזה לא מוביל לשום מסך. אפשר לחזור לעמדת הסריקה ולהמשיך משם.</p>
      <a href="#/09-circulation">חזרה לעמדת הסריקה</a>
    </section>
  );
}
