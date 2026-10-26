export interface NavItem { id: string; icon: string; label: string }

export const navItems: NavItem[] = [
  { id: '03-catalog', icon: '▤', label: 'קטלוג ספרים' },
  { id: '09-circulation', icon: '⌁', label: 'עמדת סריקה' },
  { id: '07-students', icon: '♙', label: 'תלמידות' },
  { id: '11-loans', icon: '≡', label: 'מעקב השאלות' },
  { id: '02-intake', icon: '＋', label: 'קליטת ספרים' },
  { id: '05-labels', icon: '▥', label: 'ברקודים' },
  { id: '01-storage', icon: '↓', label: 'גיבוי ושחזור' },
  { id: '12-settings', icon: '⚙', label: 'הגדרות' },
];

export const screenTitles: Record<string, string> = {
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

// מסכי משנה מסמנים בסרגל את המסך שאליו הם שייכים.
const navParent: Record<string, string> = {
  '04-book': '03-catalog',
  '08-student-card': '07-students',
  '06-student-import': '07-students',
  '10-book-import': '02-intake',
};

export const defaultRoute = '03-catalog';

export function parseRoute(hash: string): string {
  return hash.replace(/^#\/?/, '').split('?')[0];
}

export function activeNavId(route: string): string {
  return navParent[route] ?? route;
}
