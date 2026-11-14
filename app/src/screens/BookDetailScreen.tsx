import { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { getBook } from '../db/db';
import type { Book } from '../types';
import { describeBook } from '../lib/sizeLabel';
import { exportEpub, exportPdf } from '../lib/shareBook';
import { coverColor, serif, useIsDark, useTheme } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'BookDetail'>;

export default function BookDetailScreen({ route, navigation }: Props) {
  const t = useTheme();
  const isDark = useIsDark();
  const [book, setBook] = useState<Book | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => { getBook(route.params.id).then(setBook); }, [route.params.id]);
  if (!book) return <View style={[s.root, { backgroundColor: t.bg }]} />;

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    try { await fn(); } catch (e: any) { Alert.alert('Dışa aktarılamadı', String(e?.message ?? e)); } finally { setBusy(null); }
  };
  const percent = Math.round((book.lastPos / Math.max(1, book.totalChars)) * 100);

  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={s.root}>
      <View style={[s.cover, { backgroundColor: coverColor(book.id) }]}>
        <Text style={[s.coverTitle, { fontFamily: serif }]}>{book.title}</Text>
        <Text style={{ color: t.accent, marginTop: 8 }}>{book.author}</Text>
      </View>
      <Text style={[s.size, { color: t.primary }]}>{describeBook(book.pageCount ?? book.pages.length)}</Text>

      <Pressable
        onPress={() => navigation.navigate('Reader', { id: book.id })}
        style={[s.read, { backgroundColor: t.primary }]}
        accessibilityRole="button"
      >
        <Text style={[s.readText, { color: isDark ? '#0B1228' : '#fff' }]}>
          {book.lastPos > 0 ? `Devam et (%${percent})` : 'Oku'}
        </Text>
      </Pressable>

      <View style={s.row}>
        <Pressable
          onPress={() => Linking.openURL(book.url).catch(() => Alert.alert('Açılamadı'))}
          style={[s.secondary, { borderColor: t.border, backgroundColor: t.surface }]}
          accessibilityRole="link"
        >
          <Text style={{ color: t.text, fontWeight: '600' }}>YouTube'da aç</Text>
        </Pressable>
      </View>
      <View style={s.row}>
        <Pressable
          onPress={() => run('EPUB hazırlanıyor…', () => exportEpub(book))}
          disabled={!!busy}
          style={[s.secondary, { borderColor: t.border, backgroundColor: t.surface, opacity: busy ? 0.6 : 1 }]}
          accessibilityRole="button"
        >
          <Text style={{ color: t.text, fontWeight: '600' }}>EPUB</Text>
        </Pressable>
        <Pressable
          onPress={() => run('PDF hazırlanıyor…', () => exportPdf(book))}
          disabled={!!busy}
          style={[s.secondary, { borderColor: t.border, backgroundColor: t.surface, opacity: busy ? 0.6 : 1 }]}
          accessibilityRole="button"
        >
          <Text style={{ color: t.text, fontWeight: '600' }}>PDF</Text>
        </Pressable>
      </View>
      {busy && <Text style={{ color: t.muted }}>{busy}</Text>}

      <Text style={[s.h2, { color: t.text, fontFamily: serif }]}>Bölümler</Text>
      {book.chapters.map((c, i) => (
        <Text key={i} style={{ color: t.muted, paddingVertical: 4 }}>{i + 1}. {c.title}</Text>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { padding: 20, gap: 12 },
  cover: { borderRadius: 16, padding: 24, minHeight: 200, justifyContent: 'flex-end' },
  coverTitle: { color: '#fff', fontSize: 28, fontWeight: '800' },
  size: { fontSize: 15, fontWeight: '700' },
  read: { borderRadius: 14, minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  readText: { fontWeight: '800', fontSize: 16 },
  row: { flexDirection: 'row', gap: 10 },
  secondary: { flex: 1, minHeight: 48, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  h2: { fontSize: 20, fontWeight: '700', marginTop: 12 },
});
