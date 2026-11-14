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
 * the first page of a chapter begins with "# <title>" (a heading line the reader styles)
 * and always carries body text, never the heading alone.
 */
export function paginate(chapters: Chapter[], charsPerPage = 700): string[] {
  const pages: string[] = [];
  for (const ch of chapters) {
    let cur = `# ${ch.title}`;
    let hasBody = false;
    for (const para of ch.text.split(/\n\n+/)) {
      for (const piece of chunk(para, charsPerPage)) {
        if (hasBody && cur.length + 2 + piece.length > charsPerPage) {
          pages.push(cur);
          cur = '';
          hasBody = false;
        }
        cur += (cur ? '\n\n' : '') + piece;
        hasBody = true;
      }
    }
    if (hasBody) pages.push(cur);
  }
  return pages;
}
