import type { Cue } from './transcript';

const NAMED: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export function decodeEntities(s: string): string {
  // captions are often double-encoded (e.g. "&amp;#39;"), so run twice
  const once = (x: string) =>
    x.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, g: string) => {
      if (g[0] === '#') {
        const code = g[1].toLowerCase() === 'x' ? parseInt(g.slice(2), 16) : parseInt(g.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : m;
      }
      return NAMED[g.toLowerCase()] ?? m;
    });
  return once(once(s));
}

/** Parse YouTube timedtext XML (format 3 "<p t d>" with optional "<s>" words, or old "<text start dur>"). */
export function parseTimedText(xml: string): Cue[] {
  const cues: Cue[] = [];
  const p = /<p\b([^>]*)>([\s\S]*?)<\/p>/g;
  let m: RegExpExecArray | null;
  while ((m = p.exec(xml))) {
    const t = /\bt="(\d+)"/.exec(m[1]);
    const d = /\bd="(\d+)"/.exec(m[1]);
    if (!t) continue;
    cues.push({ start: +t[1] / 1000, dur: d ? +d[1] / 1000 : 0, text: stripTags(m[2]) });
  }
  if (cues.length) return cues;
  const old = /<text\b([^>]*)>([\s\S]*?)<\/text>/g;
  while ((m = old.exec(xml))) {
    const s = /\bstart="([\d.]+)"/.exec(m[1]);
    const d = /\bdur="([\d.]+)"/.exec(m[1]);
    if (!s) continue;
    cues.push({ start: +s[1], dur: d ? +d[1] : 0, text: stripTags(m[2]) });
  }
  return cues;
}

function stripTags(s: string): string {
  return decodeEntities(s.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
}

export type Track = { baseUrl: string; languageCode: string; kind?: string };

/** Prefer: manual Turkish, auto Turkish, manual video language/English, then anything. */
export function pickTrack(tracks: Track[], preferred: string[] = ['tr', 'en']): Track | null {
  if (!tracks.length) return null;
  const manual = (t: Track) => t.kind !== 'asr';
  for (const lang of preferred) {
    const hit = tracks.find((t) => manual(t) && t.languageCode.startsWith(lang));
    if (hit) return hit;
    const auto = tracks.find((t) => t.languageCode.startsWith(lang));
    if (auto) return auto;
  }
  return tracks.find(manual) ?? tracks[0];
}

/** Chapters from description timestamp lines like "0:00 Giriş" / "12:34 - Sonuç". Needs >= 2, starting at 0. */
export function parseDescriptionChapters(desc: string): { title: string; startSec: number }[] {
  const out: { title: string; startSec: number }[] = [];
  for (const line of desc.split('\n')) {
    const m = /^\s*[-•▶►]?\s*\(?((?:\d{1,2}:)?\d{1,2}:\d{2})\)?\s*[-–—:.)]?\s*(.+?)\s*$/.exec(line);
    if (!m) continue;
    const parts = m[1].split(':').map(Number);
    const sec = parts.reduce((a, n) => a * 60 + n, 0);
    if (out.length && sec <= out[out.length - 1].startSec) continue;
    out.push({ title: m[2], startSec: sec });
  }
  return out.length >= 2 && out[0].startSec === 0 ? out : [];
}
