import { Router } from 'express';
import type { BookInput } from '../../src/shared/types';

type AddBooks = (items: BookInput[]) => string[];
type AddBooksResolver = () => Promise<AddBooks>;

class IntakeUnavailableError extends Error {}

async function loadAddBooks(): Promise<AddBooks> {
  try {
    const moduleUrl = new URL('./02-intake.ts', import.meta.url).href;
    const intake: { addBooks?: unknown } = await import(moduleUrl);
    if (typeof intake.addBooks !== 'function') throw new Error('addBooks is not exported');
    return intake.addBooks as AddBooks;
  } catch {
    throw new IntakeUnavailableError('Task 02 intake module is not available');
  }
}

function validateItems(value: unknown): { items?: BookInput[]; message?: string } {
  if (!value || typeof value !== 'object' || !('items' in value) || !Array.isArray(value.items)) {
    return { message: 'יש לשלוח רשימת ספרים לייבוא' };
  }
  const rawItems = value.items;
  if (rawItems.length < 1 || rawItems.length > 100) return { message: 'אפשר לייבא בין שורה אחת ל־100 שורות' };

  const items: BookInput[] = [];
  let totalCopies = 0;
  for (const rawItem of rawItems) {
    if (!rawItem || typeof rawItem !== 'object') return { message: 'מבנה שורת ספר אינו תקין' };
    const item = rawItem as Record<string, unknown>;
    const title = typeof item.title === 'string' ? item.title.trim() : '';
    const ageGroup = typeof item.ageGroup === 'string' ? item.ageGroup.trim() : '';
    const quantity = item.quantity;
    if (!title || !ageGroup) return { message: 'יש להזין שם ספר וגיל יעד' };
    if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
      return { message: 'יש להזין כמות שלמה בין 1 ל־100' };
    }
    if (Object.hasOwn(item, 'targetBookId') && (typeof item.targetBookId !== 'string' || !item.targetBookId.trim())) {
      return { message: 'מזהה הספר הקיים אינו תקין' };
    }
    totalCopies += quantity;
    if (totalCopies > 500) return { message: 'אפשר לייבא עד 500 עותקים בסך הכול' };
    items.push({
      title,
      ageGroup,
      quantity,
      ...(typeof item.targetBookId === 'string' ? { targetBookId: item.targetBookId.trim() } : {}),
    });
  }
  return { items };
}

export function createBookImportRouter(resolveAddBooks: AddBooksResolver = loadAddBooks) {
  const router = Router();
  router.post('/imports/books', async (request, response, next) => {
    const validated = validateItems(request.body);
    if (!validated.items) {
      response.status(400).json({ error: { code: 'INVALID_INPUT', message: validated.message } });
      return;
    }

    let addBooks: AddBooks;
    try {
      addBooks = await resolveAddBooks();
    } catch {
      response.status(503).json({
        error: { code: 'DEPENDENCY_UNAVAILABLE', message: 'קליטת ספרים אינה זמינה עד לחיבור משימה 02' },
      });
      return;
    }

    try {
      const copyIds = addBooks(validated.items);
      const expectedCopies = validated.items.reduce((sum, item) => sum + item.quantity, 0);
      if (!Array.isArray(copyIds) || copyIds.length !== expectedCopies || !copyIds.every((id) => typeof id === 'string')) {
        throw new Error('addBooks returned an invalid copy list');
      }
      response.status(201).json({ copyIds });
    } catch (error) {
      next(error);
    }
  });
  return router;
}

export default createBookImportRouter();