import type { Chapter } from '../types';
import { foldChapters, searchBook, type SearchHit } from './search';

export type BookText = { id: string; title: string; chapters: Chapter[]; folded?: string[] };
export type BookHits = { bookId: string; title: string; hits: SearchHit[]; capped: boolean };

/** Search every book's text (diacritic and case insensitive). Books with the most matches first. */
export function searchAll(books: BookText[], query: string, perBook = 50): BookHits[] {
  const out: BookHits[] = [];
  for (const b of books) {
    b.folded ??= foldChapters(b.chapters); // cached on the book: later searches only run indexOf
    const hits = searchBook(b.chapters, query, perBook, b.folded);
    if (hits.length) out.push({ bookId: b.id, title: b.title, hits, capped: hits.length >= perBook });
  }
  return out.sort((a, b) => b.hits.length - a.hits.length);
}

const tick = () => new Promise<void>((r) => setTimeout(r, 0));

/**
 * Same as searchAll but gives the UI a chance to run between books and stops early when the
 * search was replaced by a newer one.
 */
export async function searchAllAsync(
  books: BookText[], query: string, shouldCancel: () => boolean, perBook = 50,
): Promise<BookHits[] | null> {
  const out: BookHits[] = [];
  for (const b of books) {
    if (shouldCancel()) return null;
    out.push(...searchAll([b], query, perBook));
    await tick();
  }
  return shouldCancel() ? null : out.sort((a, b) => b.hits.length - a.hits.length);
}
