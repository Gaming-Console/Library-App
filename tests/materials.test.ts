import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import readXlsxFile from 'read-excel-file/node';

describe('workshop sample files', () => {
  it('contains a readable XLSX book sample with a numeric copy quantity', async () => {
    const rows = await readXlsxFile(Buffer.from(readFileSync('public/workshop/samples/books.xlsx')));
    expect(rows[0]).toEqual(['שם ספר', 'גיל יעד', 'כמות עותקים']);
    expect(rows[1]).toEqual(['מסע אל האי הנעלם', 'ג–ד', 2]);
  });
  it('preserves textual school identifiers in XLSX', async () => {
    const rows = await readXlsxFile(Buffer.from(readFileSync('public/workshop/samples/students.xlsx')));
    expect(rows[0]).toEqual(['מזהה תלמידה', 'שם מלא', 'כיתה']);
    expect(rows[1][0]).toBe('S001');
  });
});
