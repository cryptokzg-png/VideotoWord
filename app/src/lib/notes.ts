import { nonSpace } from './layout';

export type Token = { text: string; word: boolean; index: number };

/** Split a page body into words and whitespace; `index` counts words only (-1 for whitespace). */
export function tokenize(body: string): Token[] {
  let w = 0;
  return body
    .split(/(\s+)/)
    .filter((p) => p !== '')
    .map((p) => (/^\s+$/.test(p) ? { text: p, word: false, index: -1 } : { text: p, word: true, index: w++ }));
}

/**
 * The quote between word a and word b (either order) and the number of non-space characters
 * that come before it in the body (to turn into a reading position).
 */
export function selectQuote(body: string, a: number, b: number): { quote: string; offset: number } {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  let offset = 0;
  const words: string[] = [];
  for (const t of tokenize(body)) {
    if (!t.word) continue;
    if (t.index < lo) offset += nonSpace(t.text);
    else if (t.index <= hi) words.push(t.text);
  }
  return { quote: words.join(' '), offset };
}

/** Short text used to highlight a saved quote on its page. */
export function highlightKey(quote: string, words = 4): string {
  return quote.split(/\s+/).slice(0, words).join(' ');
}

/** Quote text for sharing. */
export function shareText(quote: string, title: string, note?: string): string {
  return `“${quote}”${note ? `\n\n${note}` : ''}\n\n— ${title} · Barış Kitaplık`;
}

/** Number of words in a page body. */
export function wordCount(body: string): number {
  return tokenize(body).filter((t) => t.word).length;
}

/** First and last word index of the paragraph (text between blank lines) containing word `i`. */
export function paragraphRange(body: string, i: number): { a: number; b: number } {
  let start = 0;
  let last = -1;
  let found: { a: number; b: number } | null = null;
  for (const t of tokenize(body)) {
    if (t.word) {
      last = t.index;
    } else if ((t.text.match(/\n/g) ?? []).length >= 2) {
      // blank line: the paragraph ends at the previous word
      if (i >= start && i <= last) found = { a: start, b: last };
      start = last + 1;
      if (found) return found;
    }
  }
  return found ?? { a: start, b: Math.max(start, last) };
}

/**
 * Selection after tapping word `i`: the first tap picks one word, further taps outside the
 * selection grow it to include that word, a tap inside it starts over from that word.
 */
export function tapWord(sel: { a: number; b: number } | null, i: number): { a: number; b: number } {
  if (!sel) return { a: i, b: i };
  const lo = Math.min(sel.a, sel.b);
  const hi = Math.max(sel.a, sel.b);
  if (i >= lo && i <= hi) return { a: i, b: i };
  return { a: Math.min(lo, i), b: Math.max(hi, i) };
}
