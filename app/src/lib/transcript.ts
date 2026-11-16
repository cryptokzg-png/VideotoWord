import type { Chapter } from '../types';

export type Cue = { start: number; dur: number; text: string };

// sound descriptions like [Müzik], [Applause], [ ♪♪ ] and stray music notes
const NOISE = /\[[^\]]*\]|\([^)]*(?:müzik|music|alkış|applause)[^)]*\)|[♪♫]+/gi;

/** Remove noise tags, decode basic entities, collapse whitespace. */
export function cleanCue(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(NOISE, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Clean cues and drop empty / immediately repeated lines (common in auto captions). */
export function cleanCues(cues: Cue[]): Cue[] {
  const out: Cue[] = [];
  for (const c of cues) {
    const text = cleanCue(c.text);
    if (!text) continue;
    if (out.length && out[out.length - 1].text === text) continue;
    out.push({ ...c, text });
  }
  return out;
}

const PAUSE_SEC = 2.5;
const SENTENCE_PAUSE_SEC = 0.9;

function capitalizeStart(text: string): string {
  return text.replace(/(^|[.!?…]\s+)([a-zçğıöşü])/giu, (_m, before: string, letter: string) =>
    before + letter.toLocaleUpperCase('tr-TR'));
}

function finishSentence(text: string): string {
  const value = text.trim();
  if (!value) return '';
  if (/[.!?…][”’"')\]]*$/.test(value)) return capitalizeStart(value);
  const lastWord = value.split(/\s+/).at(-1)?.toLocaleLowerCase('tr-TR') ?? '';
  const questionWords = new Set(['mi', 'mı', 'mu', 'mü', 'ne', 'nasıl', 'neden', 'niye', 'niçin', 'kim', 'hangi', 'hangisi', 'kaç', 'nerede', 'nereye', 'nereden', 'ne zaman', 'nasılsın', 'nasılsınız', 'nasılım', 'nasılız']);
  return capitalizeStart(value) + (questionWords.has(lastWord) ? '?' : '.');
}

/**
 * Join cues into paragraphs. Auto captions have no punctuation, so we break on the speaker's
 * pauses: a longer pause ends a paragraph once it is long enough, and a very long run without
 * any pause is cut at hardChars so a page is never one giant wall of text.
 */
export function toParagraphs(cues: Cue[], softChars = 450, hardChars = 900): string[] {
  const paras: string[] = [];
  let cur = '';
  let prevEnd = 0;
  const flush = () => {
    if (cur.trim()) paras.push(finishSentence(cur));
    cur = '';
  };
  for (const c of cues) {
    const gap = c.start - prevEnd;
    if (cur && gap >= SENTENCE_PAUSE_SEC) {
      cur = finishSentence(cur);
      if ((gap > PAUSE_SEC && cur.length >= 120) || (gap > 1.2 && cur.length >= softChars)) flush();
    }
    cur += (cur ? ' ' : '') + c.text;
    prevEnd = c.start + c.dur;
    if (cur.length >= hardChars || (cur.length >= 300 && /[.!?…]["')]?$/.test(cur))) flush();
  }
  flush();
  return paras;
}

/** Split paragraphs into chapters of roughly equal size (used when the video has no chapters). */
export function splitIntoChapters(paragraphs: string[], targetChars = 4500): Chapter[] {
  const chapters: Chapter[] = [];
  let buf: string[] = [];
  let len = 0;
  for (const p of paragraphs) {
    buf.push(p);
    len += p.length;
    if (len >= targetChars) {
      chapters.push({ title: `Bölüm ${chapters.length + 1}`, text: buf.join('\n\n') });
      buf = [];
      len = 0;
    }
  }
  if (buf.length) {
    if (chapters.length && len < targetChars / 3) {
      chapters[chapters.length - 1].text += '\n\n' + buf.join('\n\n');
    } else {
      chapters.push({ title: `Bölüm ${chapters.length + 1}`, text: buf.join('\n\n') });
    }
  }
  return chapters;
}
