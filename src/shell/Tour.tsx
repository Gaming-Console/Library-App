import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import styles from './Tour.module.css';
import { tourSteps } from './tourSteps';

interface Rect { top: number; left: number; width: number; height: number }

export default function Tour({ onClose }: { onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [wide, setWide] = useState(() => innerWidth > 1000);
  const card = useRef<HTMLDivElement>(null);
  const primary = useRef<HTMLButtonElement>(null);
  const step = tourSteps[index];
  const last = index === tourSteps.length - 1;

  // מעבר מסך ברקע, כדי שמה שמתואר יופיע מאחורי הכרטיס.
  useEffect(() => { if (step.route) location.hash = `#/${step.route}`; }, [step]);

  useLayoutEffect(() => {
    const measure = () => {
      setWide(innerWidth > 1000);
      const el = step.target ? document.querySelector(`[data-tour="${step.target}"]`) : null;
      if (!el) { setRect(null); return; }
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    measure();
    addEventListener('resize', measure);
    return () => removeEventListener('resize', measure);
  }, [step]);

  useEffect(() => { primary.current?.focus(); }, [index]);

  // מסכים שמושכים מיקוד לעצמם (כמו שדה הסריקה) לא יוצאים מהחלון בזמן הסיור.
  useEffect(() => {
    const keep = (event: FocusEvent) => {
      if (card.current && event.target instanceof Node && !card.current.contains(event.target)) primary.current?.focus();
    };
    document.addEventListener('focusin', keep);
    return () => document.removeEventListener('focusin', keep);
  }, []);

  function next() { last ? onClose() : setIndex((i) => i + 1); }
  function back() { setIndex((i) => Math.max(0, i - 1)); }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Escape') { event.preventDefault(); onClose(); return; }
    if (event.key === 'ArrowLeft') { event.preventDefault(); next(); return; }
    if (event.key === 'ArrowRight') { event.preventDefault(); back(); return; }
    if (event.key !== 'Tab' || !card.current) return;
    const items = [...card.current.querySelectorAll<HTMLElement>('button, a[href]')];
    const first = items[0];
    const end = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); end.focus(); }
    else if (!event.shiftKey && document.activeElement === end) { event.preventDefault(); first.focus(); }
  }

  const anchored = wide && rect;
  const cardStyle = anchored
    ? { top: Math.max(16, Math.min(rect.top - 8, innerHeight - 340)), right: innerWidth - rect.left + 20 }
    : undefined;

  return (
    <div className={styles.layer} onKeyDown={onKeyDown}>
      <div className={styles.shade} onClick={onClose} aria-hidden="true" />
      {anchored && (
        <div className={styles.spot} aria-hidden="true"
          style={{ top: rect.top - 4, left: rect.left - 4, width: rect.width + 8, height: rect.height + 8 }} />
      )}
      <div ref={card} className={`${styles.card} ${anchored ? styles.anchored : styles.centered}`} style={cardStyle}
        role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-body">
        <p className={styles.count}>{index + 1} מתוך {tourSteps.length}</p>
        <h2 id="tour-title">{step.title}</h2>
        <p id="tour-body" className={styles.body}>{step.body}</p>
        {step.checklist && (
          <ul className={styles.list}>
            {step.checklist.map((item) => (
              <li key={item.href}><a href={item.href} onClick={onClose}>{item.label}</a></li>
            ))}
          </ul>
        )}
        <div className={styles.dots} aria-hidden="true">
          {tourSteps.map((s, i) => <span key={s.id} className={i === index ? styles.on : i < index ? styles.done : ''} />)}
        </div>
        <div className={styles.actions}>
          <button ref={primary} type="button" className={styles.primary} onClick={next}>
            {last ? 'סיום, מתחילות לעבוד' : index === 0 ? 'מתחילות את הסיור' : 'הבא'}
          </button>
          {index > 0 && <button type="button" className={styles.secondary} onClick={back}>הקודם</button>}
          {!last && <button type="button" className={styles.skip} onClick={onClose}>דילוג</button>}
        </div>
      </div>
    </div>
  );
}
