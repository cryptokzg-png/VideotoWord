import type { Chapter } from '../types';
import { nonSpace } from './layout';

export type SearchHit = { pos: number; chapter: number; snippet: string };

const FOLD: Record<string, string> = { 'ı': 'i', 'ş': 's', 'ğ': 'g', 'ç': 'c', 'ö': 'o', 'ü': 'u', 'â': 'a', 'î': 'i', 'û': 'u' };

/** Lowercase and strip Turkish diacritics, one character in, one character out (indexes stay aligned). */
export function fold(s: string): string {
  let out = '';
  for (const ch of s) {
    const lc = ch.toLocaleLowerCase('tr');
    const c = lc.length === ch.length ? lc : ch;
    out += FOLD[c] ?? c;
  }
  return out;
}
const lower = fold;

/** Find every occurrence of `query` (case-insensitive, Turkish aware). `pos` is a reading position. */
export function searchBook(chapters: Chapter[], query: string, limit = 100): SearchHit[] {
  const q = lower(query.trim());
  if (q.length < 2) return [];
  const hits: SearchHit[] = [];
  let base = 0;
  for (let k = 0; k < chapters.length && hits.length < limit; k++) {
    const text = chapters[k].text;
    const hay = lower(text);
    let from = 0;
    while (hits.length < limit) {
      const i = hay.indexOf(q, from);
      if (i < 0) break;
      const a = Math.max(0, i - 28);
      const b = Math.min(text.length, i + q.length + 48);
      hits.push({
        pos: base + nonSpace(text.slice(0, i)),
        chapter: k,
        snippet: (a > 0 ? '…' : '') + text.slice(a, b).replace(/\s+/g, ' ').trim() + (b < text.length ? '…' : ''),
      });
      from = i + q.length;
    }
    base += nonSpace(text);
  }
  return hits;
}

/** Split text into pieces, marking the ones that match `query` (same folding as searchBook). */
export function splitByMatch(text: string, query: string): { text: string; hit: boolean }[] {
  const q = fold(query.trim());
  if (q.length < 2) return [{ text, hit: false }];
  const hay = fold(text);
  const out: { text: string; hit: boolean }[] = [];
  let from = 0;
  while (from < text.length) {
    const i = hay.indexOf(q, from);
    if (i < 0) break;
    if (i > from) out.push({ text: text.slice(from, i), hit: false });
    out.push({ text: text.slice(i, i + q.length), hit: true });
    from = i + q.length;
  }
  if (from < text.length) out.push({ text: text.slice(from), hit: false });
  return out;
}
