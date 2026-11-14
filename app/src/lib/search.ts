import type { Chapter } from '../types';
import { nonSpace } from './layout';

export type SearchHit = { pos: number; chapter: number; snippet: string };

const FOLD: Record<string, string> = {
  'ı': 'i', 'İ': 'i', 'ş': 's', 'Ş': 's', 'ğ': 'g', 'Ğ': 'g', 'ç': 'c', 'Ç': 'c',
  'ö': 'o', 'Ö': 'o', 'ü': 'u', 'Ü': 'u', 'â': 'a', 'Â': 'a', 'î': 'i', 'Î': 'i', 'û': 'u', 'Û': 'u',
};

/**
 * Lowercase and strip Turkish diacritics, one UTF-16 unit in, one out (indexes stay aligned).
 * Deliberately avoids toLocaleLowerCase(): on the phone's JS engine every call is very slow and
 * searching a whole book froze the app.
 */
export function fold(s: string): string {
  const out = new Array<string>(s.length);
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if (code < 128) {
      // ASCII: A-Z -> a-z (Turkish "I" folds to "i" as well)
      out[i] = code >= 65 && code <= 90 ? String.fromCharCode(code + 32) : s[i];
    } else {
      const c = s[i];
      const m = FOLD[c];
      if (m !== undefined) out[i] = m;
      else {
        const l = c.toLowerCase();
        out[i] = l.length === 1 ? l : c;
      }
    }
  }
  return out.join('');
}
const lower = fold;

/** Folded text of every chapter, computed once and reused for each search. */
export function foldChapters(chapters: Chapter[]): string[] {
  return chapters.map((c) => fold(c.text));
}

/** Find every occurrence of `query` (case-insensitive, Turkish aware). `pos` is a reading position. */
export function searchBook(chapters: Chapter[], query: string, limit = 100, folded?: string[]): SearchHit[] {
  const q = lower(query.trim());
  if (q.length < 2) return [];
  const hits: SearchHit[] = [];
  let base = 0;
  for (let k = 0; k < chapters.length && hits.length < limit; k++) {
    const text = chapters[k].text;
    const hay = folded?.[k] ?? lower(text);
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
