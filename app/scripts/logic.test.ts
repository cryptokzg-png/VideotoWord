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
