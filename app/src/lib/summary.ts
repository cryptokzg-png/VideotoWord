import type { Chapter } from '../types';

const STOP = new Set(['ve','veya','ile','ama','fakat','ancak','çünkü','de','da','ki','bu','şu','o','bir','çok','daha','en','için','gibi','olarak','olan','oldu','ise','ben','sen','biz','siz','onlar','benim','senin','bizim','sizin','onun','her','hem','ne','mi','mı','mu','mü','diye','kadar','sonra','önce','var','yok','şey']);

/** Offline extractive summary: ranks source sentences by informative word frequency. */
export function summarizeChapter(source: string, limit = 4): string {
  const sentences = source.replace(/\s+/g, ' ').match(/[^.!?…]+[.!?…]?/gu)?.map((s) => s.trim()).filter((s) => s.length > 35) ?? [];
  if (sentences.length <= limit) return sentences.join('\n\n') || 'Bu bölüm için özetlenecek yeterli metin bulunamadı.';
  const counts = new Map<string, number>();
  for (const sentence of sentences) {
    const words = sentence.toLocaleLowerCase('tr-TR').match(/[a-zçğıöşüâîû]+/giu) ?? [];
    for (const word of words) if (word.length > 3 && !STOP.has(word)) counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  const ranked = sentences.map((sentence, index) => {
    const words = sentence.toLocaleLowerCase('tr-TR').match(/[a-zçğıöşüâîû]+/giu) ?? [];
    const score = words.reduce((sum, word) => sum + (STOP.has(word) ? 0 : (counts.get(word) ?? 0)), 0) / Math.max(1, Math.sqrt(words.length));
    return { sentence, index, score };
  });
  const chosen = ranked.sort((a, b) => b.score - a.score).slice(0, limit).sort((a, b) => a.index - b.index);
  return chosen.map((item) => item.sentence).join('\n\n');
}
