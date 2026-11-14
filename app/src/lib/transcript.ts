import type { Chapter } from '../types';

export type Cue = { start: number; dur: number; text: string };

const NOISE = /\[(müzik|music|alkış|applause|gülüşmeler|laughter)[^\]]*\]|♪[^♪]*♪/gi;

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

/** Join cues into paragraphs, breaking on long pauses or after sentence ends once long enough. */
export function toParagraphs(cues: Cue[], minChars = 280): string[] {
  const paras: string[] = [];
  let cur = '';
  let prevEnd = 0;
  const flush = () => {
    if (cur.trim()) paras.push(cur.trim());
    cur = '';
  };
  for (const c of cues) {
    const gap = c.start - prevEnd;
    if (cur && gap > PAUSE_SEC && cur.length >= minChars / 2) flush();
    cur += (cur ? ' ' : '') + c.text;
    prevEnd = c.start + c.dur;
    if (cur.length >= minChars && /[.!?…]["')]?$/.test(cur)) flush();
  }
  flush();
  return paras;
}

/** Split paragraphs into chapters of roughly equal size (used when the video has no chapters). */
export function splitIntoChapters(paragraphs: string[], targetChars = 1800): Chapter[] {
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
