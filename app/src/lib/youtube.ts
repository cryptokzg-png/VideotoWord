const ID_RE = /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/))([\w-]{11})/;

/** Extract the 11-char video id from a YouTube URL or text containing one. */
export function parseVideoId(input: string): string | null {
  const m = input.match(ID_RE);
  if (m) return m[1];
  return /^[\w-]{11}$/.test(input.trim()) ? input.trim() : null;
}

export type VideoData = {
  id: string;
  title: string;
  author: string;
  durationSec: number;
  thumbnail: string;
  cues: import('./transcript').Cue[];
  chapters?: { title: string; startSec: number }[];
};

/**
 * TODO(phase 1): fetch real metadata + captions (direct from the phone first;
 * fall back to a small Cloudflare Worker proxy if YouTube blocks it).
 */
export async function fetchVideo(id: string): Promise<VideoData> {
  throw new Error('NOT_IMPLEMENTED: transcript fetching is the next step (id=' + id + ')');
}
