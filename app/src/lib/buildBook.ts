import type { Book } from '../types';
import { cleanCues, splitIntoChapters, toParagraphs } from './transcript';
import { paginate } from './paginate';
import { totalChars } from './layout';
import { autoTitle } from './titles';
import type { VideoData } from './youtube';

/** Turn fetched video data into a paginated book (no AI, rule based). */
export function buildBook(v: VideoData): Book {
  const cues = cleanCues(v.cues);
  let chapters;
  if (v.chapters && v.chapters.length > 1) {
    chapters = v.chapters.map((c, i) => {
      const end = v.chapters![i + 1]?.startSec ?? Infinity;
      const part = cues.filter((q) => q.start >= c.startSec && q.start < end);
      return { title: c.title, text: toParagraphs(part).join('\n\n') };
    }).filter((c) => c.text);
  } else {
    // no chapters in the video: split by size and name each part from its first words
    chapters = splitIntoChapters(toParagraphs(cues)).map((c) => ({ ...c, title: autoTitle(c.text) }));
  }
  return {
    id: v.id,
    title: v.title,
    author: v.author,
    url: `https://youtu.be/${v.id}`,
    thumbnail: v.thumbnail,
    durationSec: v.durationSec,
    chapters,
    pages: paginate(chapters),
    createdAt: Date.now(),
    lastPage: 0,
    lastPos: 0,
    totalChars: totalChars(chapters),
  };
}
