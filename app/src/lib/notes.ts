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
