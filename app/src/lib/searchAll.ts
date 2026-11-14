import type { Chapter } from '../types';
import { searchBook, type SearchHit } from './search';

export type BookText = { id: string; title: string; chapters: Chapter[] };
export type BookHits = { bookId: string; title: string; hits: SearchHit[]; capped: boolean };

/** Search every book's text (diacritic and case insensitive). Books with the most matches first. */
export function searchAll(books: BookText[], query: string, perBook = 50): BookHits[] {
  const out: BookHits[] = [];
  for (const b of books) {
    const hits = searchBook(b.chapters, query, perBook);
    if (hits.length) out.push({ bookId: b.id, title: b.title, hits, capped: hits.length >= perBook });
  }
  return out.sort((a, b) => b.hits.length - a.hits.length);
}
