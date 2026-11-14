import { parseDescriptionChapters, parseTimedText, pickTrack, type Track } from './captions';
import type { Cue } from './transcript';

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
  cues: Cue[];
  chapters?: { title: string; startSec: number }[];
};

export class VideoError extends Error {
  constructor(public code: 'UNAVAILABLE' | 'NO_CAPTIONS' | 'NETWORK' | 'BLOCKED', message: string) {
    super(message);
  }
}

const PLAYER_URL = 'https://www.youtube.com/youtubei/v1/player?prettyPrint=false';
const CLIENT_VERSION = '20.10.38';

/** Optional proxy (Cloudflare Worker) used if YouTube blocks direct calls from the phone. */
export const PROXY_URL: string | null = null;

async function callPlayer(id: string): Promise<any> {
  const body = JSON.stringify({
    context: { client: { clientName: 'ANDROID', clientVersion: CLIENT_VERSION, androidSdkVersion: 34, hl: 'tr', gl: 'TR' } },
    videoId: id,
  });
  const headers = {
    'content-type': 'application/json',
    'user-agent': `com.google.android.youtube/${CLIENT_VERSION} (Linux; U; Android 14) gzip`,
    'accept-language': 'tr-TR,tr;q=0.9',
  };
  let res: Response;
  try {
    res = await fetch(PROXY_URL ? `${PROXY_URL}/player` : PLAYER_URL, { method: 'POST', headers, body });
  } catch {
    throw new VideoError('NETWORK', 'İnternet bağlantısı kurulamadı.');
  }
  if (!res.ok) throw new VideoError('BLOCKED', `YouTube isteği reddetti (${res.status}).`);
  return res.json();
}

/** Fetch metadata and captions for a video, directly from the device. */
export async function fetchVideo(id: string): Promise<VideoData> {
  const j = await callPlayer(id);
  const status = j.playabilityStatus?.status;
  if (status && status !== 'OK') {
    throw new VideoError('UNAVAILABLE', j.playabilityStatus?.reason ?? 'Video kullanılamıyor.');
  }
  const d = j.videoDetails ?? {};
  const tracks: Track[] = j.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
  const track = pickTrack(tracks);
  if (!track) throw new VideoError('NO_CAPTIONS', 'Bu videoda altyazı yok, kitap yapılamıyor.');

  let xml: string;
  try {
    const url = PROXY_URL ? `${PROXY_URL}/caption?u=${encodeURIComponent(track.baseUrl)}` : track.baseUrl;
    const r = await fetch(url);
    xml = await r.text();
  } catch {
    throw new VideoError('NETWORK', 'Altyazı indirilemedi.');
  }
  const cues = parseTimedText(xml);
  if (!cues.length) throw new VideoError('BLOCKED', 'Altyazı boş geldi (YouTube engellemiş olabilir).');

  return {
    id,
    title: d.title ?? 'Adsız video',
    author: d.author ?? '',
    durationSec: parseInt(d.lengthSeconds ?? '0', 10),
    thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    cues,
    chapters: parseDescriptionChapters(d.shortDescription ?? ''),
  };
}
