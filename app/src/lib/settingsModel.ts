export type Mode = 'auto' | 'night' | 'day';
export type FontKey = 'serif' | 'sans';

export type Settings = {
  mode: Mode;
  fontIdx: number; // index into FONT_SCALES
  font: FontKey;
  speechRate: number;
  speechVoice: string;
};

export const FONT_SCALES = [0.85, 1, 1.15, 1.3, 1.5];
export const FONT_FAMILIES: Record<FontKey, string> = { serif: 'serif', sans: 'sans-serif' };
export const FONT_LABELS: Record<FontKey, string> = { serif: 'Serif (kitap)', sans: 'Sans (sade)' };

export const DEFAULTS: Settings = { mode: 'auto', fontIdx: 1, font: 'serif', speechRate: 1, speechVoice: '' };

/** Parse stored string settings, ignoring anything invalid. */
export function parseSettings(raw: Record<string, string>): Settings {
  const mode = raw.mode === 'night' || raw.mode === 'day' || raw.mode === 'auto' ? raw.mode : DEFAULTS.mode;
  const idx = Number(raw.fontIdx);
  const fontIdx = Number.isInteger(idx) && idx >= 0 && idx < FONT_SCALES.length ? idx : DEFAULTS.fontIdx;
  const font = raw.font === 'sans' || raw.font === 'serif' ? raw.font : DEFAULTS.font;
  const rateValue = Number(raw.speechRate);
  const speechRate = Number.isFinite(rateValue) ? Math.min(1.5, Math.max(0.7, rateValue)) : DEFAULTS.speechRate;
  const speechVoice = typeof raw.speechVoice === 'string' ? raw.speechVoice : DEFAULTS.speechVoice;
  return { mode, fontIdx, font, speechRate, speechVoice };
}
