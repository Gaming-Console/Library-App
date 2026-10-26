import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { Settings } from '../../shared/types';
import styles from './Page.module.css';
import { addCalendarDays } from './date';

type Draft = { libraryName: string; loanDays: string; maxActiveLoans: string };
type FieldErrors = Partial<Record<keyof Draft, string>>;
type ApiFailure = { error?: { message?: string }; fieldErrors?: FieldErrors };

const toDraft = (settings: Settings): Draft => ({
  libraryName: settings.libraryName,
  loanDays: String(settings.loanDays),
  maxActiveLoans: String(settings.maxActiveLoans),
});

function validate(draft: Draft): FieldErrors {
  const errors: FieldErrors = {};
  if (!draft.libraryName.trim()) errors.libraryName = 'יש להזין שם ספרייה';
  const loanDays = Number(draft.loanDays);
  if (!/^\d+$/.test(draft.loanDays) || !Number.isInteger(loanDays) || loanDays < 1 || loanDays > 90) {
    errors.loanDays = 'יש להזין מספר שלם בין 1 ל־90';
  }
  const maxActiveLoans = Number(draft.maxActiveLoans);
  if (!/^\d+$/.test(draft.maxActiveLoans) || !Number.isInteger(maxActiveLoans) || maxActiveLoans < 1 || maxActiveLoans > 20) {
    errors.maxActiveLoans = 'יש להזין מספר שלם בין 1 ל־20';
  }
  return errors;
}

async function responseFailure(response: Response): Promise<ApiFailure> {
  try {
    return await response.json() as ApiFailure;
  } catch {
    return {};
  }
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('he-IL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

export default function Page() {
  const [saved, setSaved] = useState<Settings | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [message, setMessage] = useState('');
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const response = await fetch('/api/settings');
      if (!response.ok) {
        const failure = await responseFailure(response);
        throw new Error(failure.error?.message || 'טעינת הגדרות הספרייה נכשלה');
      }
      const settings: Settings = await response.json();
      if (
        typeof settings.libraryName !== 'string' ||
        !Number.isInteger(settings.loanDays) ||
        !Number.isInteger(settings.maxActiveLoans)
      ) {
        throw new Error('השרת החזיר הגדרות בפורמט לא תקין');
      }
      setSaved(settings);
      setDraft(toDraft(settings));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'טעינת ההגדרות נכשלה');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const changed = saved !== null && draft !== null && (
    draft.libraryName !== saved.libraryName ||
    draft.loanDays !== String(saved.loanDays) ||
    draft.maxActiveLoans !== String(saved.maxActiveLoans)
  );
  const previewDays = draft && /^\d+$/.test(draft.loanDays) ? Number(draft.loanDays) : NaN;
  const previewDate = Number.isInteger(previewDays) && previewDays >= 1 && previewDays <= 90
    ? formatDate(addCalendarDays(new Date(), previewDays))
    : null;

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => current ? { ...current, [key]: value } : current);
    setMessage('');
    setFormError('');
    setFieldErrors((current) => ({ ...current, [key]: undefined }));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft || saving) return;
    const errors = validate(draft);
    setFieldErrors(errors);
    setFormError('');
    setMessage('');
    if (Object.keys(errors).length) return;

    setSaving(true);
    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          libraryName: draft.libraryName.trim(),
          loanDays: Number(draft.loanDays),
          maxActiveLoans: Number(draft.maxActiveLoans),
        }),
      });
      if (!response.ok) {
        const failure = await responseFailure(response);
        setFieldErrors(failure.fieldErrors ?? {});
        throw new Error(failure.error?.message || 'שמירת הגדרות הספרייה נכשלה');
      }
      const settings: Settings = await response.json();
      setSaved(settings);
      setDraft(toDraft(settings));
      setMessage('ההגדרות נשמרו בהצלחה.');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'שמירת ההגדרות נכשלה');
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    if (!saved) return;
    setDraft(toDraft(saved));
    setFieldErrors({});
    setFormError('');
    setMessage('');
  }

  if (loading) return <main className={styles.page}><p role="status">טוענת הגדרות…</p></main>;
  if (loadError) {
    return (
      <main className={styles.page}>
        <h1>מדיניות הספרייה</h1>
        <p className={styles.error} role="alert">{loadError}</p>
        <button className={styles.secondaryButton} type="button" onClick={() => void loadSettings()}>ניסיון חוזר</button>
      </main>
    );
  }
  if (!draft || !saved) return <main className={styles.page}><p role="alert">לא נמצאו הגדרות ספרייה.</p></main>;

  return (
    <main className={styles.page} dir="rtl">
      <div className={styles.header}>
        <div>
          <span className={styles.eyebrow}>כללים ברורים לכולן</span>
          <h1>מדיניות הספרייה</h1>
          <p>משנות את הכללים מכאן — בלי לערוך קוד.</p>
        </div>
        <a className={styles.relatedLink} href="#/03-catalog">לקטלוג הספרים ←</a>
      </div>

      <div className={styles.layout}>
        <form className={styles.panel} onSubmit={save} noValidate>
          <label className={styles.field} htmlFor="library-name">
            שם הספרייה
            <input
              id="library-name"
              type="text"
              autoComplete="organization"
              value={draft.libraryName}
              aria-invalid={Boolean(fieldErrors.libraryName)}
              aria-describedby={fieldErrors.libraryName ? 'library-name-error' : undefined}
              onChange={(event) => update('libraryName', event.target.value)}
              disabled={saving}
            />
            {fieldErrors.libraryName && <span className={styles.error} id="library-name-error">{fieldErrors.libraryName}</span>}
          </label>

          <div className={styles.formGrid}>
            <label className={styles.field} htmlFor="loan-days">
              לכמה ימים משאילים?
              <input
                id="loan-days"
                type="number"
                min="1"
                max="90"
                step="1"
                inputMode="numeric"
                value={draft.loanDays}
                aria-invalid={Boolean(fieldErrors.loanDays)}
                aria-describedby={fieldErrors.loanDays ? 'loan-days-hint loan-days-error' : 'loan-days-hint'}
                onChange={(event) => update('loanDays', event.target.value)}
                disabled={saving}
              />
              <span className={styles.hint} id="loan-days-hint">מספר שלם בין 1 ל־90</span>
              {fieldErrors.loanDays && <span className={styles.error} id="loan-days-error">{fieldErrors.loanDays}</span>}
            </label>

            <label className={styles.field} htmlFor="max-active-loans">
              מקסימום ספרים לתלמידה
              <input
                id="max-active-loans"
                type="number"
                min="1"
                max="20"
                step="1"
                inputMode="numeric"
                value={draft.maxActiveLoans}
                aria-invalid={Boolean(fieldErrors.maxActiveLoans)}
                aria-describedby={fieldErrors.maxActiveLoans ? 'max-active-loans-hint max-active-loans-error' : 'max-active-loans-hint'}
                onChange={(event) => update('maxActiveLoans', event.target.value)}
                disabled={saving}
              />
              <span className={styles.hint} id="max-active-loans-hint">מספר שלם בין 1 ל־20</span>
              {fieldErrors.maxActiveLoans && <span className={styles.error} id="max-active-loans-error">{fieldErrors.maxActiveLoans}</span>}
            </label>
          </div>

          {formError && <p className={styles.error} role="alert">{formError}</p>}
          {message && <p className={styles.success} role="status">{message}</p>}
          <div className={styles.actions}>
            <button className={styles.primaryButton} type="submit" disabled={saving || !changed}>
              {saving ? 'שומרת…' : 'שמירת הגדרות'}
            </button>
            <button className={styles.secondaryButton} type="button" onClick={cancel} disabled={saving || !changed}>
              ביטול שינויים
            </button>
          </div>
        </form>

        <aside className={`${styles.panel} ${styles.preview}`} aria-live="polite">
          <span className={styles.eyebrow}>כך זה ייראה בהשאלה הבאה</span>
          <h2>אם משאילים היום…</h2>
          {previewDate
            ? <p className={styles.date}>{previewDate}</p>
            : <p className={styles.hint}>הזיני מספר ימים תקין כדי לראות תאריך החזרה.</p>}
          {previewDate && <p className={styles.hint}>זה יהיה מועד ההחזרה, לפי {previewDays} ימי השאלה.</p>}
          <hr />
          <div className={styles.note}>שינוי ההגדרות משפיע על השאלות חדשות בלבד. תאריכי ההחזרה הקיימים נשארים כפי שנקבעו.</div>
        </aside>
      </div>
    </main>
  );
}
