import type { VideoData } from './youtube';

// Demo data so the UI works before real transcript fetching exists.
const sentences = [
  'Bugün güvenli bir başlangıç için ilk adımları konuşacağız.',
  'Önce kaybetmeyi göze alabileceğin tutarı belirlemelisin.',
  'Sonra hangi platformu kullanacağına karar vermelisin.',
  'Hesabını açarken iki adımlı doğrulamayı mutlaka etkinleştir.',
  'Acele etmek en sık yapılan hatalardan biridir.',
  'Her zaman önce küçük tutarlarla öğrenmeye başla.',
];

export function sampleVideo(): VideoData {
  const cues = Array.from({ length: 120 }, (_, i) => ({
    start: i * 4,
    dur: 3.5,
    text: sentences[i % sentences.length],
  }));
  return {
    id: 'demo' + Math.random().toString(36).slice(2, 9),
    title: 'Örnek Video: Güvenli Başlangıç',
    author: 'Örnek Kanal',
    durationSec: 480,
    thumbnail: '',
    cues,
  };
}
