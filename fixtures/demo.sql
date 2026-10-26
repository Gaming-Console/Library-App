INSERT INTO settings VALUES (1, 'מדף — ספריית בית הספר', 14, 3);
INSERT INTO books VALUES
 ('book-1','מסע אל האי הנעלם','ג–ד'),
 ('book-2','הסוד שבין המדפים','ה–ו'),
 ('book-3','כוכבים בחלון','א–ב');
INSERT INTO copies VALUES
 ('copy-1','book-1','LIB-000001'),
 ('copy-2','book-1','LIB-000002'),
 ('copy-3','book-2','LIB-000003'),
 ('copy-4','book-3','LIB-000004');
INSERT INTO students VALUES
 ('student-1','S001','תמר לדוגמה','ד1'),
 ('student-2','S002','נועה לדוגמה','ה2'),
 ('student-3','S003','תמר לדוגמה','ג1');
INSERT INTO loans VALUES
 ('loan-1','student-1','copy-2','2026-10-20','2026-11-03',NULL),
 ('loan-2','student-2','copy-3','2026-09-01','2026-09-15',NULL),
 ('loan-3','student-1','copy-4','2026-09-01','2026-09-15','2026-09-10');
