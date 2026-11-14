// Book size label by page count (thresholds from PLAN.md).
export function sizeLabel(pages: number): string {
  if (pages <= 4) return 'Mini kitap';
  if (pages <= 12) return 'Kısa kitap';
  if (pages <= 30) return 'Kitap';
  return 'Büyük kitap';
}

const WORDS_PER_PAGE = 180;
const WORDS_PER_MIN = 200;

export function readingMinutes(pages: number): number {
  return Math.max(1, Math.round((pages * WORDS_PER_PAGE) / WORDS_PER_MIN));
}

export function describeBook(pages: number): string {
  return `${sizeLabel(pages)} · ${pages} sayfa · ${readingMinutes(pages)} dk okuma`;
}
