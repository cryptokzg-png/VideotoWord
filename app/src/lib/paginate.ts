import type { Chapter } from '../types';

/** Split text into chunks of at most `max` chars, cutting at spaces. */
function chunk(text: string, max: number): string[] {
  const out: string[] = [];
  let rest = text.trim();
  while (rest.length > max) {
    let cut = rest.lastIndexOf(' ', max);
    if (cut < max / 2) cut = max;
    out.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) out.push(rest);
  return out;
}

/**
 * Split chapters into pages by character budget. Every chapter starts on a new page;
 * the first page of a chapter begins with "# <title>" (a heading line the reader styles),
 * always carries body text, and gets `firstPenalty` fewer body chars to leave room for the heading.
 */
export function paginate(chapters: Chapter[], charsPerPage = 700, firstPenalty = 0): string[] {
  const firstLimit = Math.max(120, charsPerPage - firstPenalty);
  const pages: string[] = [];
  for (const ch of chapters) {
    let cur = `# ${ch.title}`;
    let bodyLen = 0;
    let limit = firstLimit;
    for (const para of ch.text.split(/\n\n+/)) {
      for (const piece of chunk(para, firstLimit)) {
        if (bodyLen > 0 && bodyLen + 2 + piece.length > limit) {
          pages.push(cur);
          cur = '';
          bodyLen = 0;
          limit = charsPerPage;
        }
        cur += (cur ? '\n\n' : '') + piece;
        bodyLen += (bodyLen ? 2 : 0) + piece.length;
      }
    }
    if (bodyLen > 0) pages.push(cur);
  }
  return pages;
}
