import type { Chapter } from '../types';

/**
 * Split chapters into fixed-size pages by character budget.
 * Every chapter starts on a new page; the page text begins with the chapter title line
 * marked by a leading "# " so the reader can style it.
 */
export function paginate(chapters: Chapter[], charsPerPage = 1100): string[] {
  const pages: string[] = [];
  for (const ch of chapters) {
    const paras = ch.text.split(/\n\n+/);
    let cur = `# ${ch.title}\n\n`;
    let first = true;
    for (const p of paras) {
      if (!first && cur.length + p.length > charsPerPage) {
        pages.push(cur.trim());
        cur = '';
      }
      // hard-split a paragraph that alone exceeds the budget
      let rest = p;
      while (rest.length > charsPerPage) {
        let cut = rest.lastIndexOf(' ', charsPerPage);
        if (cut < charsPerPage / 2) cut = charsPerPage;
        if (cur.trim()) {
          pages.push(cur.trim());
          cur = '';
        }
        pages.push(rest.slice(0, cut).trim());
        rest = rest.slice(cut).trim();
      }
      cur += (cur && !cur.endsWith('\n\n') ? '\n\n' : '') + rest;
      first = false;
    }
    if (cur.trim()) pages.push(cur.trim());
  }
  return pages;
}
