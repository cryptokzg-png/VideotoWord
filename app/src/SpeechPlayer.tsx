import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Speech from 'expo-speech';
import { useSettings } from './settings';
import { useTheme } from './theme';

export type SpeechItem = { text: string; page: number; start: number; end: number };
type Player = {
  items: SpeechItem[];
  index: number;
  status: 'idle' | 'playing' | 'paused';
  bookTitle: string;
  setQueue: (items: SpeechItem[], title: string) => void;
  playFrom: (index: number) => void;
  pause: () => void;
  stop: () => void;
  skip: (delta: -1 | 1) => void;
};
const Ctx = createContext<Player | null>(null);
export const useSpeechPlayer = () => {
  const value = useContext(Ctx);
  if (!value) throw new Error('SpeechPlayerProvider is missing');
  return value;
};

export function SpeechPlayerProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const [items, setItems] = useState<SpeechItem[]>([]);
  const [index, setIndex] = useState(-1);
  const [status, setStatus] = useState<Player['status']>('idle');
  const [bookTitle, setBookTitle] = useState('');
  const token = useRef(0);
  const indexRef = useRef(-1);
  const itemsRef = useRef<SpeechItem[]>([]);
  const rateRef = useRef(settings.speechRate);
  rateRef.current = settings.speechRate;

  const setQueue = useCallback((next: SpeechItem[], title: string) => {
    itemsRef.current = next;
    setItems(next);
    setBookTitle(title);
    if (indexRef.current >= next.length) { indexRef.current = -1; setIndex(-1); setStatus('idle'); }
  }, []);

  const playFrom = useCallback((start: number) => {
    const list = itemsRef.current;
    if (start < 0 || start >= list.length) return;
    const runToken = ++token.current;
    indexRef.current = start;
    setIndex(start);
    setStatus('playing');
    Speech.stop();
    Speech.speak(list[start].text, {
      language: 'tr-TR',
      rate: rateRef.current,
      onDone: () => {
        if (runToken !== token.current) return;
        const next = start + 1;
        if (next < itemsRef.current.length) playFrom(next);
        else { indexRef.current = -1; setIndex(-1); setStatus('idle'); }
      },
      onError: () => {
        if (runToken === token.current) setStatus('paused');
      },
    });
  }, []);

  const pause = useCallback(() => {
    if (status !== 'playing') return;
    token.current += 1;
    Speech.stop();
    setStatus('paused');
  }, [status]);

  const stop = useCallback(() => {
    token.current += 1;
    Speech.stop();
    indexRef.current = -1;
    setIndex(-1);
    setStatus('idle');
  }, []);

  const skip = useCallback((delta: -1 | 1) => {
    const base = indexRef.current < 0 ? 0 : indexRef.current;
    playFrom(Math.max(0, Math.min(itemsRef.current.length - 1, base + delta)));
  }, [playFrom]);

  useEffect(() => () => { token.current += 1; Speech.stop(); }, []);

  const value = useMemo(() => ({ items, index, status, bookTitle, setQueue, playFrom, pause, stop, skip }), [items, index, status, bookTitle, setQueue, playFrom, pause, stop, skip]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function FloatingSpeechPlayer() {
  const player = useSpeechPlayer();
  const t = useTheme();
  if (player.status === 'idle') return null;
  return (
    <View style={[styles.wrap, { backgroundColor: t.primaryDark, borderColor: t.accent }]}>
      <View style={styles.top}>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={styles.brand}>BARIŞ KİTAPLIK · SESLİ OKUMA</Text>
          <Text numberOfLines={1} style={styles.title}>{player.bookTitle || 'Sesli kitap'}</Text>
          <Text style={styles.meta}>{player.status === 'playing' ? 'Okunuyor' : 'Duraklatıldı'} · {Math.max(0, player.index + 1)} / {player.items.length}</Text>
        </View>
        <Pressable onPress={player.stop} hitSlop={10} style={styles.close}><Text style={styles.closeText}>×</Text></Pressable>
      </View>
      <View style={styles.controls}>
        <Pressable onPress={() => player.skip(-1)} style={styles.small}><Text style={styles.controlText}>‹</Text></Pressable>
        <Pressable onPress={player.status === 'playing' ? player.pause : () => player.playFrom(Math.max(0, player.index))} style={styles.main}>
          <Text style={styles.mainText}>{player.status === 'playing' ? 'Ⅱ Duraklat' : '▶ Devam et'}</Text>
        </Pressable>
        <Pressable onPress={() => player.skip(1)} style={styles.small}><Text style={styles.controlText}>›</Text></Pressable>
        <Pressable onPress={player.stop} style={styles.stop}><Text style={styles.controlText}>■</Text></Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 12, right: 12, bottom: 10, zIndex: 1000, elevation: 18, borderWidth: 1.5, borderRadius: 18, padding: 12, gap: 10, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brand: { color: '#D4AF37', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  title: { color: '#FFFFFF', fontSize: 14, fontWeight: '800', marginTop: 2 },
  meta: { color: '#C4CBE0', fontSize: 11, marginTop: 2 },
  close: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#FFFFFF', fontSize: 25, fontWeight: '400' },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  small: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, borderColor: '#46547D', alignItems: 'center', justifyContent: 'center' },
  main: { flex: 1, height: 40, borderRadius: 12, backgroundColor: '#D4AF37', alignItems: 'center', justifyContent: 'center' },
  mainText: { color: '#1B1204', fontWeight: '900' },
  stop: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#354263', alignItems: 'center', justifyContent: 'center' },
  controlText: { color: '#FFFFFF', fontWeight: '900', fontSize: 17 },
});
