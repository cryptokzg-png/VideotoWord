import { cleanCues, toParagraphs, splitIntoChapters } from '../src/lib/transcript';
import { paginate } from '../src/lib/paginate';
import { sizeLabel } from '../src/lib/sizeLabel';
import { parseVideoId } from '../src/lib/youtube';
import { buildBook } from '../src/lib/buildBook';
import { sampleVideo } from '../src/lib/sample';
const eq=(a:any,b:any,m:string)=>{ if(JSON.stringify(a)!==JSON.stringify(b)){console.error('FAIL',m,a,b);process.exit(1)} };
eq(cleanCues([{start:0,dur:1,text:'[Müzik]'},{start:1,dur:1,text:'Merhaba &amp; hoş'},{start:2,dur:1,text:'Merhaba & hoş'}]).length,1,'clean+dedupe');
eq(parseVideoId('https://youtu.be/dQw4w9WgXcQ?si=x'),'dQw4w9WgXcQ','short');
eq(parseVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3'),'dQw4w9WgXcQ','watch');
eq(parseVideoId('https://youtube.com/shorts/dQw4w9WgXcQ'),'dQw4w9WgXcQ','shorts');
eq(parseVideoId('merhaba'),null,'invalid');
eq([1,4,5,12,13,30,31].map(sizeLabel),['Mini kitap','Mini kitap','Kısa kitap','Kısa kitap','Kitap','Kitap','Büyük kitap'],'labels');
const b=buildBook(sampleVideo());
console.log('pages',b.pages.length,'chapters',b.chapters.length,sizeLabel(b.pages.length));
if(!b.pages.every(p=>p.length<=1300)){console.error('FAIL page too long');process.exit(1)}
console.log('OK');

import { parseTimedText, decodeEntities, pickTrack, parseDescriptionChapters } from '../src/lib/captions';
const c = parseTimedText('<timedtext format="3"><body><p t="18640" d="3240">It&amp;#39;s &amp;amp; ok</p><p t="22000" d="1000"><s>Hel</s><s t="1">lo</s></p></body></timedtext>');
eq(c, [{start:18.64,dur:3.24,text:"It's & ok"},{start:22,dur:1,text:'Hello'}], 'timedtext');
eq(decodeEntities('&#x41;&lt;'), 'A<', 'entities');
eq(pickTrack([{baseUrl:'a',languageCode:'en',kind:'asr'},{baseUrl:'b',languageCode:'tr',kind:'asr'},{baseUrl:'c',languageCode:'en'}])?.baseUrl, 'b', 'prefers tr auto over en manual');
eq(parseDescriptionChapters('Merhaba\n0:00 Giriş\n1:30 - Konu\n1:02:03 Son').map(x=>x.startSec), [0,90,3723], 'chapters');
eq(parseDescriptionChapters('0:10 tek'), [], 'chapters need >=2 and start 0');
console.log('OK2');
import { cleanCue } from '../src/lib/transcript';
eq(cleanCue('[ ♪]'), '', 'music tag');
eq(cleanCue('[Alkış] Merhaba ♪ dünya'), 'Merhaba dünya', 'noise inline');
console.log('OK3');

// regression: unpunctuated auto-captions must not become one giant paragraph / heading-only pages
const longCues = Array.from({ length: 400 }, (_, i) => ({ start: i * 3, dur: 2.9, text: 'bu bir noktalama olmayan otomatik altyazı satırıdır numara ' + i }));
const paras = toParagraphs(cleanCues(longCues));
if (!paras.every((p) => p.length < 1000)) { console.error('FAIL giant paragraph', Math.max(...paras.map((p) => p.length))); process.exit(1); }
const chs = splitIntoChapters(paras);
if (chs.length < 4) { console.error('FAIL too few chapters', chs.length); process.exit(1); }
const pgs = paginate(chs);
if (pgs.some((p) => p.startsWith('# ') && !p.includes('\n\n'))) { console.error('FAIL heading-only page'); process.exit(1); }
if (!pgs.every((p) => p.length <= 800)) { console.error('FAIL page too long', Math.max(...pgs.map((p) => p.length))); process.exit(1); }
// a single paragraph longer than a page must not leave the heading alone
const big = paginate([{ title: 'T', text: 'kelime '.repeat(400) }]);
if (big[0] === '# T' || !big[0].startsWith('# T\n\n')) { console.error('FAIL heading split', big[0].slice(0, 20)); process.exit(1); }
console.log('OK4', 'paragraphs', paras.length, 'chapters', chs.length, 'pages', pgs.length);

// reading position must survive re-pagination (font size / screen changes)
import { pageStarts, pageForPos, totalChars, pageBudget } from '../src/lib/layout';
const story = Array.from({ length: 30 }, (_, i) => ({ title: 'B' + i, text: Array.from({ length: 6 }, (_, k) => 'kelime '.repeat(40 + k * 7 + i)).join('\n\n') }));
const total = totalChars(story);
for (const [cpp, pen] of [[300, 80], [520, 150], [900, 250]] as const) {
  const pg = paginate(story, cpp, pen);
  const st = pageStarts(pg);
  const last = pg[pg.length - 1];
  const bodyLast = (last.startsWith('# ') ? last.slice(last.indexOf('\n\n') + 2) : last).replace(/\s/g, '').length;
  if (st[st.length - 1] + bodyLast !== total) { console.error('FAIL total chars differ', cpp, st[st.length - 1] + bodyLast, total); process.exit(1); }
  if (pg.some((p) => p.startsWith('# ') && !p.includes('\n\n'))) { console.error('FAIL heading-only', cpp); process.exit(1); }
  const limit = cpp + 40;
  if (!pg.every((p) => p.replace(/^# .*\n\n/, '').length <= limit)) { console.error('FAIL page over budget', cpp); process.exit(1); }
  const mid = Math.floor(total / 2);
  const idx = pageForPos(st, mid);
  if (!(st[idx] <= mid && (idx + 1 >= st.length || st[idx + 1] > mid))) { console.error('FAIL pageForPos', cpp); process.exit(1); }
}
const smallFont = pageBudget(412, 640, 19), bigFont = pageBudget(412, 640, 19 * 1.5);
if (!(bigFont.budget < smallFont.budget)) { console.error('FAIL budget should shrink with bigger font'); process.exit(1); }
console.log('OK5 budget@19px =', smallFont.budget, "chars; @28px =", bigFont.budget);

// ---- line based pagination ----
import { pagesFromLines, COVER } from '../src/lib/layout';
const chs2 = [{ title: 'Giriş', text: 'a\n\nb' }, { title: 'İkinci', text: 'c' }];
const fakeLines = [
  ['satir1 ', 'satir2 ', 'satir3 ', 'satir4 ', 'satir5 ', 'satir6\n', '\n', 'satir7 ', 'satir8'],
  ['x1 ', 'x2'],
];
const lp = pagesFromLines(chs2, fakeLines, [60, 60], 20, 120); // 6 lines/page, first page 3 lines (120-60)/20
eq(lp[0], COVER, 'cover first');
eq(lp[1].startsWith('# Giriş\n\nsatir1 satir2 satir3'), true, 'first page has heading + 3 lines');
eq(lp[1].split('\n\n')[1].includes('satir4'), false, 'first page capped by heading height');
if (lp.some((p) => p !== COVER && p.replace(/^# .*\n\n/, '').trim() === '')) { console.error('FAIL empty page'); process.exit(1); }
if (lp.some((p) => /^\s/.test(p.replace(/^# .*\n\n/, '')) && p !== COVER)) { console.error('FAIL page starts with blank'); process.exit(1); }
if (!lp.some((p) => p.startsWith('# İkinci'))) { console.error('FAIL second chapter missing'); process.exit(1); }
const flat = lp.join('').replace(/# [^\n]*\n\n/g, '').replace(/\s/g, '');
eq(flat.replace('@cover', ''), fakeLines.flat().join('').replace(/\s/g, ''), 'no text lost or duplicated');
// cover must not shift reading positions
eq(pageStarts(lp)[0], 0, 'cover start'); eq(pageStarts(lp)[1], 0, 'first text page start');

// ---- search ----
import { searchBook, fold } from '../src/lib/search';
eq(fold('İĞÜŞÖÇI'), 'igusoci', 'fold');
eq(fold('Iıİi').length, 4, 'fold keeps length');
const sc = [{ title: 'A', text: 'Merhaba dünya, ISPARTA güzel.\n\nİkinci paragraf' }, { title: 'B', text: 'isparta yine burada' }];
eq(searchBook(sc, 'ısparta').length, 2, 'diacritic and case insensitive: ISPARTA, isparta');
eq(searchBook(sc, 'ISPARTA')[1].chapter, 1, 'second hit in chapter B');
eq(searchBook(sc, 'dunya').length, 1, 'ü matches u');
eq(searchBook(sc, 'GÜZEL').length, 1, 'uppercase Ü');
const sh3 = searchBook(sc, 'paragraf');
eq(sh3[0].pos, sc[0].text.slice(0, sc[0].text.indexOf('paragraf')).replace(/\s/g, '').length, 'search pos = non-space offset');
eq(searchBook(sc, 'a').length, 0, 'min length 2');

// ---- epub ----
import JSZip from 'jszip';
import { buildEpub, buildPdfHtml, esc } from '../src/lib/export';
import { writeFileSync } from 'node:fs';
const bk = { id: 'abc', title: 'Test & "Kitap" <1>', author: 'Yazar', url: 'https://youtu.be/abc', chapters: [{ title: 'Bölüm 1', text: 'Merhaba <dünya> & herkes.\n\nİkinci.' }] };
const epub = await buildEpub(bk);
writeFileSync('/tmp/claude-0/test.epub', epub);
const z = await JSZip.loadAsync(epub);
const names = Object.keys(z.files);
eq(names[0], 'mimetype', 'mimetype first');
eq(await z.file('mimetype')!.async('string'), 'application/epub+zip', 'mimetype content');
for (const n of ['META-INF/container.xml', 'OEBPS/content.opf', 'OEBPS/nav.xhtml', 'OEBPS/ch1.xhtml', 'OEBPS/title.xhtml']) if (!z.file(n)) { console.error('FAIL missing', n); process.exit(1); }
eq((await z.file('OEBPS/ch1.xhtml')!.async('string')).includes('&lt;dünya&gt; &amp; herkes'), true, 'escaped body');
eq(esc('<&">'), '&lt;&amp;&quot;&gt;', 'esc');
eq(buildPdfHtml(bk).includes('Test &amp; &quot;Kitap&quot; &lt;1&gt;'), true, 'pdf html escaped');

// ---- settings ----
import { parseSettings, DEFAULTS } from '../src/lib/settingsModel';
eq(parseSettings({}), DEFAULTS, 'defaults');
eq(parseSettings({ mode: 'night', fontIdx: '3', font: 'sans' }), { mode: 'night', fontIdx: 3, font: 'sans' }, 'parse');
eq(parseSettings({ mode: 'x', fontIdx: '99', font: 'y' }), DEFAULTS, 'invalid ignored');
console.log('OK6');
