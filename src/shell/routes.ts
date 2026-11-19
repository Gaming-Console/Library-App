export interface Tab { id: string; label: string }

export interface Section {
  id: string;
  label: string;
  /** מסכים בתוך החלק; הראשון הוא ברירת המחדל. */
  tabs: Tab[];
  /** מסכי משנה (כרטיס ספר, כרטיס תלמידה) שמסמנים את החלק שלהם. */
  children?: string[];
  /** מופיע בתחתית הסרגל ולא בין הפעולות היומיות. */
  utility?: boolean;
}

// ארבע פעולות יומיות והגדרות אחת. כל השאר הם לשוניות בתוך החלק שלהם.
export const sections: Section[] = [
  { id: 'scan', label: 'סריקה', tabs: [{ id: '09-circulation', label: 'השאלה והחזרה' }] },
  {
    id: 'books',
    label: 'ספרים',
    tabs: [
      { id: '03-catalog', label: 'קטלוג' },
      { id: '02-intake', label: 'הוספת ספר' },
      { id: '10-book-import', label: 'ייבוא מאקסל' },
      { id: '05-labels', label: 'מדבקות' },
    ],
    children: ['04-book'],
  },
  {
    id: 'students',
    label: 'תלמידות',
    tabs: [
      { id: '07-students', label: 'רשימה' },
      { id: '06-student-import', label: 'ייבוא מאקסל' },
    ],
    children: ['08-student-card'],
  },
  { id: 'loans', label: 'השאלות', tabs: [{ id: '11-loans', label: 'מעקב ותאריכי החזרה' }] },
  {
    id: 'settings',
    label: 'הגדרות',
    utility: true,
    tabs: [
      { id: '12-settings', label: 'מדיניות השאלה' },
      { id: '01-storage', label: 'גיבוי ושחזור' },
    ],
  },
];

export const screenTitles: Record<string, string> = {
  '01-storage': 'גיבוי ושחזור',
  '02-intake': 'הוספת ספר',
  '03-catalog': 'קטלוג הספרים',
  '04-book': 'כרטיס ספר',
  '05-labels': 'מדבקות וברקודים',
  '06-student-import': 'ייבוא תלמידות',
  '07-students': 'תלמידות',
  '08-student-card': 'כרטיס תלמידה',
  '09-circulation': 'השאלה והחזרה',
  '10-book-import': 'ייבוא ספרים',
  '11-loans': 'מעקב השאלות',
  '12-settings': 'מדיניות השאלה',
};

export const defaultRoute = '09-circulation';

export function parseRoute(hash: string): string {
  return hash.replace(/^#\/?/, '').split('?')[0];
}

export function sectionOf(route: string): Section | undefined {
  return sections.find((s) => s.tabs.some((t) => t.id === route) || s.children?.includes(route));
}

/** לשונית פעילה; במסכי משנה זו הלשונית שאליה שייך המסך. */
export function activeTabId(route: string): string | undefined {
  const section = sectionOf(route);
  if (!section) return undefined;
  return section.tabs.some((t) => t.id === route) ? route : section.tabs[0].id;
}

export const sectionHome = (section: Section) => `#/${section.tabs[0].id}`;
