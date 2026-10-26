import { useEffect, useState, type FormEvent } from 'react';
import type { Student, StudentInput } from '../../shared/types';
import styles from './Page.module.css';

type StudentForm = StudentInput;

const emptyForm: StudentForm = { schoolId: '', fullName: '', className: '' };

export default function StudentsPage() {
  const [items, setItems] = useState<Student[]>([]);
  const [classes, setClasses] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [className, setClassName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [form, setForm] = useState<StudentForm>(emptyForm);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    async function loadStudents() {
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams();
        if (query.trim()) params.set('q', query.trim());
        if (className) params.set('className', className);
        const suffix = params.size ? `?${params.toString()}` : '';
        const response = await fetch(`/api/students${suffix}`, { signal: controller.signal });
        const payload: unknown = await response.json();
        if (!response.ok) throw new Error(apiMessage(payload, 'טעינת רשימת התלמידות נכשלה'));
        if (!isStudentList(payload)) throw new Error('השרת החזיר רשימת תלמידות לא תקינה');
        setItems(payload.items);
        if (!query.trim() && !className) {
          setClasses([...new Set(payload.items.map((student) => student.className))]
            .sort((a, b) => a.localeCompare(b, 'he')));
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'טעינת רשימת התלמידות נכשלה');
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void loadStudents();
    return () => controller.abort();
  }, [query, className, reload]);

  function openNewForm() {
    setEditing(null);
    setForm(emptyForm);
    setNotice('');
    setError('');
    setFormOpen(true);
  }

  function openEditForm(student: Student) {
    setEditing(student);
    setForm({ schoolId: student.schoolId, fullName: student.fullName, className: student.className });
    setNotice('');
    setError('');
    setFormOpen(true);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch(editing ? `/api/students/${encodeURIComponent(editing.id)}` : '/api/students', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const payload: unknown = await response.json();
      if (!response.ok) throw new Error(apiMessage(payload, 'שמירת התלמידה נכשלה'));
      if (!isStudentResponse(payload)) throw new Error('השרת החזיר תשובת שמירה לא תקינה');
      setNotice(editing ? 'פרטי התלמידה עודכנו בהצלחה' : 'התלמידה נוספה בהצלחה');
      setFormOpen(false);
      setReload((current) => current + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'שמירת התלמידה נכשלה');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className={styles.page} dir="rtl">
      <div className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>קהילת הקוראות</p>
          <h1>התלמידות שלנו</h1>
          <p className={styles.intro}>חיפוש מהיר ותיקון פרטים — בלי לאבד היסטוריה.</p>
        </div>
        <div className={styles.headingActions}>
          <button className={styles.primary} type="button" onClick={openNewForm}>＋ תלמידה חדשה</button>
          <a className={styles.secondary} href="#/06-student-import">ייבוא מאקסל</a>
        </div>
      </div>

      {notice && <p className={styles.success} role="status">{notice}</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}

      {formOpen && (
        <form className={styles.form} onSubmit={submit}>
          <div className={styles.formHeading}>
            <h2>{editing ? 'עריכת פרטי תלמידה' : 'תלמידה חדשה'}</h2>
            <button className={styles.textButton} type="button" onClick={() => setFormOpen(false)}>ביטול</button>
          </div>
          <div className={styles.fields}>
            <label>
              מזהה בית־ספרי
              <input
                autoComplete="off"
                required
                value={form.schoolId}
                onChange={(event) => setForm({ ...form, schoolId: event.target.value })}
              />
            </label>
            <label>
              שם מלא
              <input
                autoComplete="name"
                required
                value={form.fullName}
                onChange={(event) => setForm({ ...form, fullName: event.target.value })}
              />
            </label>
            <label>
              כיתה
              <input
                required
                value={form.className}
                onChange={(event) => setForm({ ...form, className: event.target.value })}
              />
            </label>
          </div>
          <div className={styles.actions}>
            <button className={styles.primary} type="submit" disabled={saving}>
              {saving ? 'שומרת…' : editing ? 'שמירת שינויים' : 'שמירת תלמידה'}
            </button>
            <button className={styles.secondary} type="button" disabled={saving} onClick={() => setFormOpen(false)}>
              סגירה
            </button>
          </div>
        </form>
      )}

      <div className={styles.filters}>
        <label className={styles.search}>
          <span className={styles.visuallyHidden}>חיפוש תלמידות</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="חיפוש לפי שם או מזהה תלמידה…"
          />
        </label>
        <label className={styles.classFilter}>
          <span className={styles.visuallyHidden}>כיתה</span>
          <select value={className} onChange={(event) => setClassName(event.target.value)}>
            <option value="">כל הכיתות</option>
            {classes.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
      </div>

      <section className={styles.panel} aria-label="רשימת תלמידות">
        {loading ? <p className={styles.state}>טוענת תלמידות…</p>
          : error ? <p className={styles.state}>לא ניתן להציג את הרשימה עד שהשרת יחזור לפעול.</p>
            : items.length === 0 ? <p className={styles.state}>לא נמצאו תלמידות מתאימות.</p>
              : (
                <div className={styles.tableWrap}>
                  <table>
                    <thead><tr><th scope="col">שם התלמידה</th><th scope="col">מזהה בית־ספרי</th><th scope="col">כיתה</th><th scope="col"><span className={styles.visuallyHidden}>פעולות</span></th></tr></thead>
                    <tbody>
                      {items.map((student) => (
                        <tr key={student.id}>
                          <td><a href={`#/08-student-card?id=${encodeURIComponent(student.id)}`}>{student.fullName}</a></td>
                          <td><span className={styles.identifier} dir="ltr">{student.schoolId}</span></td>
                          <td>{student.className}</td>
                          <td className={styles.rowActions}>
                            <a href={`#/08-student-card?id=${encodeURIComponent(student.id)}`}>כרטיס תלמידה ←</a>
                            <button className={styles.textButton} type="button" onClick={() => openEditForm(student)}>עריכה</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
      </section>
      <p className={styles.footnote}>שמות זהים מותרים. כל תלמידה מזוהה לפי המזהה הייחודי שלה.</p>
    </main>
  );
}

function isStudent(value: unknown): value is Student {
  if (!value || typeof value !== 'object') return false;
  const student = value as Record<string, unknown>;
  return typeof student.id === 'string' && typeof student.schoolId === 'string'
    && typeof student.fullName === 'string' && typeof student.className === 'string';
}

function isStudentList(value: unknown): value is { items: Student[] } {
  return !!value && typeof value === 'object' && 'items' in value
    && Array.isArray(value.items) && value.items.every(isStudent);
}

function isStudentResponse(value: unknown): value is { student: Student } {
  return !!value && typeof value === 'object' && 'student' in value && isStudent(value.student);
}

function apiMessage(value: unknown, fallback: string): string {
  if (!value || typeof value !== 'object' || !('error' in value)) return fallback;
  const apiError = value.error;
  if (!apiError || typeof apiError !== 'object' || !('message' in apiError)
    || typeof apiError.message !== 'string') return fallback;
  return apiError.message;
}
