import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { fetchVideo } from '../lib/youtube';
import { buildBook } from '../lib/buildBook';
import { saveBook } from '../db/db';
import { serif, useTheme } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Convert'>;

const STEPS = ['Video bilgisi alınıyor', 'Altyazı alınıyor', 'Bölümlere ayrılıyor', 'Sayfalara dökülüyor', 'Kitap kaydediliyor'];

export default function ConvertScreen({ route, navigation }: Props) {
  const t = useTheme();
  const { videoId } = route.params;
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setStep(0);
    (async () => {
      try {
        const video = await fetchVideo(videoId); // steps 0-1
        if (cancelled) return;
        setStep(2);
        const book = buildBook(video); // steps 2-3
        if (cancelled) return;
        setStep(4);
        await saveBook(book);
        if (!cancelled) navigation.replace('BookDetail', { id: book.id });
      } catch (e: any) {
        if (!cancelled) setError(String(e?.message ?? e));
      }
    })();
    return () => { cancelled = true; };
  }, [videoId, attempt, navigation]);

  return (
    <View style={[s.root, { backgroundColor: t.bg }]}>
      <Text style={[s.h, { color: t.text, fontFamily: serif }]}>Kitap hazırlanıyor</Text>
      {STEPS.map((label, i) => (
        <View key={label} style={s.row}>
          <Text style={{ color: i < step ? t.primary : i === step ? t.text : t.muted, fontSize: 16 }}>
            {i < step ? '✓' : i === step && !error ? '…' : '○'}  {label}
          </Text>
        </View>
      ))}
      {!error && <ActivityIndicator color={t.primary} style={{ marginTop: 16 }} />}
      {error && (
        <View style={s.err}>
          <Text style={{ color: t.danger, fontWeight: '700' }}>Dönüştürülemedi</Text>
          <Text style={{ color: t.muted }}>{error}</Text>
          <Pressable onPress={() => setAttempt((a) => a + 1)} style={[s.btn, { backgroundColor: t.primary }]}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>Tekrar dene</Text>
          </Pressable>
        </View>
      )}
      <Pressable onPress={() => navigation.goBack()} style={s.cancel}>
        <Text style={{ color: t.muted }}>{error ? 'Geri dön' : 'İptal'}</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, padding: 24, paddingTop: 72, gap: 10 },
  h: { fontSize: 26, fontWeight: '800', marginBottom: 12 },
  row: { paddingVertical: 4 },
  err: { marginTop: 20, gap: 8 },
  btn: { alignSelf: 'flex-start', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 18, marginTop: 4 },
  cancel: { marginTop: 24 },
});
