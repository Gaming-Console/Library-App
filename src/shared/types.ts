export type FeatureId =
  | '01-storage' | '02-intake' | '03-catalog' | '04-book'
  | '05-labels' | '06-student-import' | '07-students' | '08-student-card'
  | '09-circulation' | '10-book-import' | '11-loans' | '12-settings';

export interface Book { id: string; title: string; ageGroup: string }
export interface Copy { id: string; bookId: string; barcode: string }
export interface Student { id: string; schoolId: string; fullName: string; className: string }
export interface Loan {
  id: string;
  studentId: string;
  copyId: string;
  borrowedOn: string;
  dueOn: string;
  returnedOn: string | null;
}
export interface Settings { libraryName: string; loanDays: number; maxActiveLoans: number }
export interface LibraryData {
  schemaVersion: 1;
  books: Book[];
  copies: Copy[];
  students: Student[];
  loans: Loan[];
  settings: Settings;
}
export interface ApiError { error: { code: string; message: string } }
export interface ImportIssue { row: number; message: string }
export interface BookInput { title: string; ageGroup: string; quantity: number; targetBookId?: string }
export interface BookImportRow { row: number; title: string; ageGroup: string; quantity: number }
export interface StudentInput { schoolId: string; fullName: string; className: string }
export interface StudentImportRow extends StudentInput { row: number }
export interface ImportPreview<T> { rows: T[]; issues: ImportIssue[] }
export interface CopyView {
  copy: Copy;
  book: Book;
  activeLoan: Loan | null;
  borrower: Student | null;
}
export interface CatalogItem { book: Book; totalCopies: number; availableCopies: number }
export interface BookDetails { book: Book; copies: CopyView[] }
export interface LoanView { loan: Loan; copy: Copy; book: Book; student: Student; overdue: boolean }
export interface StudentDetails { student: Student; loans: LoanView[] }
