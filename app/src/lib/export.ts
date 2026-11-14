import JSZip from 'jszip';
import type { Book } from '../types';

export const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const paras = (text: string) =>
  text.split(/\n\n+/).map((p) => p.trim()).filter(Boolean).map((p) => `<p>${esc(p)}</p>`).join('\n');

const CSS = `body{font-family:serif;line-height:1.6;margin:5%}
h1{font-size:1.6em;margin:1.2em 0 .6em;border-bottom:2px solid #b8962e;padding-bottom:.2em}
h2{font-size:1.2em;margin:2em 0 .6em}
p{margin:.8em 0;text-align:left}
.meta{color:#555;font-size:.9em}`;

function xhtml(title: string, body: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="tr" lang="tr">
<head><meta charset="utf-8"/><title>${esc(title)}</title><link rel="stylesheet" type="text/css" href="style.css"/></head>
<body>
${body}
</body>
</html>`;
}

/** Build a valid EPUB 3 file (mimetype stored first, uncompressed). */
export async function buildEpub(book: Pick<Book, 'id' | 'title' | 'author' | 'url' | 'chapters'>): Promise<Uint8Array> {
  const zip = new JSZip();
  // no folder entries in the archive (EPUB validators warn about them)
  const put = (name: string, data: string, opts?: { compression: 'STORE' }) => zip.file(name, data, { createFolders: false, ...opts });
  put('mimetype', 'application/epub+zip', { compression: 'STORE' });
  put(
    'META-INF/container.xml',
    `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
<rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`,
  );
  put('OEBPS/style.css', CSS);
  put(
    'OEBPS/title.xhtml',
    xhtml(
      book.title,
      `<h1>${esc(book.title)}</h1>\n<p class="meta">${esc(book.author)}</p>\n<p class="meta">Kaynak: ${esc(book.url)}</p>`,
    ),
  );
  const items = book.chapters.map((c, i) => ({ file: `ch${i + 1}.xhtml`, id: `ch${i + 1}`, title: c.title, text: c.text }));
  for (const it of items) put(`OEBPS/${it.file}`, xhtml(it.title, `<h2>${esc(it.title)}</h2>\n${paras(it.text)}`));

  put(
    'OEBPS/nav.xhtml',
    `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="tr" lang="tr">
<head><meta charset="utf-8"/><title>İçindekiler</title></head>
<body><nav epub:type="toc" id="toc"><h1>İçindekiler</h1><ol>
${items.map((it) => `<li><a href="${it.file}">${esc(it.title)}</a></li>`).join('\n')}
</ol></nav></body>
</html>`,
  );
  put(
    'OEBPS/content.opf',
    `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="tr">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:identifier id="bookid">urn:video:${esc(book.id)}</dc:identifier>
<dc:title>${esc(book.title)}</dc:title>
<dc:creator>${esc(book.author || 'Bilinmiyor')}</dc:creator>
<dc:language>tr</dc:language>
<meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d+Z$/, 'Z')}</meta>
</metadata>
<manifest>
<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
<item id="css" href="style.css" media-type="text/css"/>
<item id="title" href="title.xhtml" media-type="application/xhtml+xml"/>
${items.map((it) => `<item id="${it.id}" href="${it.file}" media-type="application/xhtml+xml"/>`).join('\n')}
</manifest>
<spine>
<itemref idref="title"/>
${items.map((it) => `<itemref idref="${it.id}"/>`).join('\n')}
</spine>
</package>`,
  );
  return zip.generateAsync({ type: 'uint8array', mimeType: 'application/epub+zip' });
}

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
