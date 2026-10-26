PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS books (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL CHECK(length(trim(title)) > 0),
  ageGroup TEXT NOT NULL CHECK(length(trim(ageGroup)) > 0)
);
CREATE TABLE IF NOT EXISTS copies (
  id TEXT PRIMARY KEY,
  bookId TEXT NOT NULL REFERENCES books(id),
  barcode TEXT NOT NULL UNIQUE CHECK(length(barcode) = 10 AND barcode GLOB 'LIB-[0-9][0-9][0-9][0-9][0-9][0-9]')
);
CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY,
  schoolId TEXT NOT NULL UNIQUE,
  fullName TEXT NOT NULL,
  className TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS loans (
  id TEXT PRIMARY KEY,
  studentId TEXT NOT NULL REFERENCES students(id),
  copyId TEXT NOT NULL REFERENCES copies(id),
  borrowedOn TEXT NOT NULL,
  dueOn TEXT NOT NULL,
  returnedOn TEXT,
  CHECK(dueOn >= borrowedOn),
  CHECK(returnedOn IS NULL OR returnedOn >= borrowedOn)
);
CREATE UNIQUE INDEX IF NOT EXISTS one_active_loan_per_copy ON loans(copyId) WHERE returnedOn IS NULL;
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  libraryName TEXT NOT NULL,
  loanDays INTEGER NOT NULL CHECK(loanDays BETWEEN 1 AND 90),
  maxActiveLoans INTEGER NOT NULL CHECK(maxActiveLoans BETWEEN 1 AND 20)
);
