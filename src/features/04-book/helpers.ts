export function readBookId(hash: string): string | null {
  const id = new URLSearchParams(hash.split('?')[1]).get('id');
  return id && id.trim() ? id : null;
}

export function availableText(count: number): string {
  if (count === 0) return 'אין עותקים זמינים';
  return count === 1 ? 'עותק אחד זמין' : `${count} עותקים זמינים`;
}

export function formatDate(iso: string): string {
  const [year, month, day] = iso.split('-');
  return `${day}.${month}.${year}`;
}
