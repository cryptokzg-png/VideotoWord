import type { Book } from '../types';

export const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const paras = (text: string) =>
  text.split(/\n\n+/).map((p) => p.trim()).filter(Boolean).map((p) => `<p>${esc(p)}</p>`).join('\n');

/** Printable HTML for the PDF export. */
export function buildPdfHtml(book: Pick<Book, 'title' | 'author' | 'url' | 'chapters'>): string {
  const body = book.chapters
    .map((c) => `<section><h2>${esc(c.title)}</h2>${paras(c.text)}</section>`)
    .join('\n');
  return `<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"/>
<style>
@page{margin:22mm 18mm}
body{font-family:serif;font-size:12.5pt;line-height:1.6;color:#111}
h1{font-size:24pt;margin:0 0 6pt}
.meta{color:#555;font-size:10pt;margin:2pt 0}
.cover{page-break-after:always;padding-top:90mm}
h2{font-size:16pt;border-bottom:1.5pt solid #b8962e;padding-bottom:3pt;margin-top:18pt;page-break-after:avoid}
p{margin:0 0 9pt;text-align:left}
</style></head><body>
<div class="cover"><h1>${esc(book.title)}</h1><div class="meta">${esc(book.author)}</div><div class="meta">Kaynak: ${esc(book.url)}</div></div>
${body}
</body></html>`;
}
