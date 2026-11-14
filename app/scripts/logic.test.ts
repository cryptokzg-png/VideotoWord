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
if (!paras.every((p) => p.length < 420)) { console.error('FAIL giant paragraph', Math.max(...paras.map((p) => p.length))); process.exit(1); }
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
