import type { Chapter } from '../types';

const MAX_LEN = 48;

/** Chapter title from the first words of its text ("Başka ilahlar yoktur göklerde…"). */
export function autoTitle(text: string, words = 6): string {
  const w = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  if (!w.length) return 'Bölüm';
  let t = w.slice(0, words).join(' ');
  let cut = w.length > words;
  if (t.length > MAX_LEN) {
    t = t.slice(0, MAX_LEN).replace(/\s+\S*$/, '');
    cut = true;
  }
  t = t.replace(/[\s,;:.\-–—]+$/g, '');
  t = t.charAt(0).toLocaleUpperCase('tr') + t.slice(1);
  return cut ? `${t}…` : t;
}

/** The plain numbered titles ("Bölüm 3") that were never given a real name. */
export const isPlainTitle = (c: Chapter) => !c.custom && /^Bölüm \d+$/.test(c.title);

/** Give every plain numbered chapter an automatic title; names the user chose are kept. */
export function regenerateTitles(chapters: Chapter[]): Chapter[] {
  return chapters.map((c) => (isPlainTitle(c) ? { ...c, title: autoTitle(c.text) } : c));
}
