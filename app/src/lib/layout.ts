import type { Chapter } from '../types';

/** Count of non-whitespace characters: stays the same however the text is paginated. */
export function nonSpace(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) if (!/\s/.test(s[i])) n++;
  return n;
}

export function totalChars(chapters: Chapter[]): number {
  return chapters.reduce((a, c) => a + nonSpace(c.text), 0);
}

export const COVER = '@cover';

function bodyOf(page: string): string {
  if (page === COVER) return '';
  if (!page.startsWith('# ')) return page;
  const i = page.indexOf('\n\n');
  return i < 0 ? '' : page.slice(i + 2);
}

/** Reading position (non-space chars of body text) at which each page starts. */
export function pageStarts(pages: string[]): number[] {
  const out: number[] = [];
  let acc = 0;
  for (const p of pages) {
    out.push(acc);
    acc += nonSpace(bodyOf(p));
  }
  return out;
}

/** Index of the page that contains reading position `pos`. */
export function pageForPos(starts: number[], pos: number): number {
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= pos) lo = mid;
    else hi = mid - 1;
  }
  return Math.max(0, lo);
}

/**
 * Estimate how many characters fit on one page for the given screen area and font size
 * (serif text, line height 1.7). Deliberately conservative so text never overflows.
 */
export function pageBudget(width: number, areaHeight: number, fontSize: number) {
  const contentW = Math.max(120, width - 56);
  const contentH = Math.max(160, areaHeight - 44);
  const cpl = Math.max(12, Math.floor(contentW / (fontSize * 0.58)));
  const lines = Math.max(4, Math.floor(contentH / (fontSize * 1.7)));
  return {
    budget: Math.max(150, Math.floor(cpl * (lines - 1) * 0.92)),
    headPenalty: cpl * 5, // chapter label + big title use roughly five lines
  };
}

/**
 * Build pages from measured text lines (exactly what the phone laid out), so a page never
 * overflows and never needs scrolling.
 *  - lines[k]: the line texts of chapter k, as reported by onTextLayout
 *  - headHeights[k]: pixel height of chapter k's heading block
 *  - lineHeight / contentHeight: pixels
 * The first page of a chapter is returned as "# <title>\n\n<body>"; a cover page comes first.
 */
export function pagesFromLines(
  chapters: Chapter[],
  lines: string[][],
  headHeights: number[],
  lineHeight: number,
  contentHeight: number,
): string[] {
  const pages: string[] = [COVER];
  const capRest = Math.max(3, Math.floor(contentHeight / lineHeight));
  chapters.forEach((ch, k) => {
    const ls = lines[k] ?? [];
    const capFirst = Math.max(3, Math.floor((contentHeight - (headHeights[k] ?? 0)) / lineHeight));
    let i = 0;
    let first = true;
    while (i < ls.length) {
      // never start a page with blank lines
      while (i < ls.length && ls[i].trim() === '') i++;
      if (i >= ls.length) break;
      const cap = first ? capFirst : capRest;
      const body = ls.slice(i, i + cap).join('').replace(/\s+$/, '');
      i += cap;
      if (!body.trim()) continue;
      pages.push(first ? `# ${ch.title}\n\n${body}` : body);
      first = false;
    }
  });
  return pages;
}
