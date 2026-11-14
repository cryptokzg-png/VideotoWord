import { useEffect, useState } from 'react';
import { Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, ToastAndroid, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { deleteBook, getBook, setFavorite, updateChapters } from '../db/db';
import { autoTitle, isPlainTitle, regenerateTitles } from '../lib/titles';
import { RenameDialog } from '../components/RenameDialog';
import type { Book } from '../types';
import { describeBook } from '../lib/sizeLabel';
import { exportPdf } from '../lib/shareBook';
import { coverColor, serif, useIsDark, useTheme } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'BookDetail'>;

export default function BookDetailScreen({ route, navigation }: Props) {
  const t = useTheme();
  const isDark = useIsDark();
  const insets = useSafeAreaInsets();
  const [book, setBook] = useState<Book | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<number | null>(null);
  useEffect(() => { getBook(route.params.id).then(setBook); }, [route.params.id]);
  if (!book) return <View style={[s.root, { backgroundColor: t.bg }]} />;

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    try { await fn(); } catch (e: any) { Alert.alert('Dışa aktarılamadı', String(e?.message ?? e)); } finally { setBusy(null); }
  };
  const toast = (m: string) => Platform.OS === 'android' && ToastAndroid.show(m, ToastAndroid.SHORT);

  const saveChapters = async (chapters: typeof book.chapters, message: string) => {
    await updateChapters(book.id, chapters);
    setBook({ ...book, chapters });
    toast(message);
  };

  const renameChapter = (index: number, title: string | null) => {
    const chapters = book.chapters.map((ch, i) =>
      i !== index ? ch : title === null ? { title: autoTitle(ch.text), text: ch.text } : { title: title.trim(), text: ch.text, custom: true },
    );
    setRenaming(null);
    return saveChapters(chapters, title === null ? 'Otomatik başlık geri geldi' : 'Başlık güncellendi');
  };

  const hasPlainTitles = book.chapters.some(isPlainTitle);

  const confirmDelete = () =>
    Alert.alert('Kitabı sil', `"${book.title}" ve yer imleri silinsin mi? Bu işlem geri alınamaz.`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          await deleteBook(book.id);
          navigation.popToTop();
        },
      },
    ]);
  const percent = Math.round((book.lastPos / Math.max(1, book.totalChars)) * 100);

  return (
    <ScrollView
      style={{ backgroundColor: t.bg }}
      // keep the last rows clear of the Android navigation bar so the whole list can be reached
      contentContainerStyle={[s.root, { paddingBottom: 32 + insets.bottom }]}
    >
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
          onPress={async () => {
            const on = !book.favorite;
            await setFavorite(book.id, on);
            setBook({ ...book, favorite: on ? 1 : 0 });
            if (Platform.OS === 'android') ToastAndroid.show(on ? '★ Favorilere eklendi' : 'Favorilerden çıkarıldı', ToastAndroid.SHORT);
          }}
          style={[s.secondary, { borderColor: book.favorite ? t.accent : t.border, backgroundColor: t.surface }]}
          accessibilityRole="button"
          accessibilityState={{ selected: !!book.favorite }}
        >
          <Text style={{ color: book.favorite ? t.accent : t.text, fontWeight: '600' }}>
            {book.favorite ? '★ Favorilerde' : '☆ Favorilere ekle'}
          </Text>
        </Pressable>
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
          onPress={() => run('PDF hazırlanıyor…', () => exportPdf(book))}
          disabled={!!busy}
          style={[s.secondary, { borderColor: t.border, backgroundColor: t.surface, opacity: busy ? 0.6 : 1 }]}
          accessibilityRole="button"
        >
          <Text style={{ color: t.text, fontWeight: '600' }}>PDF olarak dışa aktar</Text>
        </Pressable>
        <Pressable
          onPress={confirmDelete}
          style={[s.secondary, s.deleteBtn, { borderColor: t.danger, backgroundColor: t.surface }]}
          accessibilityRole="button"
          accessibilityLabel="Kitabı sil"
        >
          <Text style={{ color: t.danger, fontWeight: '700' }}>Kitabı sil</Text>
        </Pressable>
      </View>
      {busy && <Text style={{ color: t.muted }}>{busy}</Text>}

      <Text style={[s.h2, { color: t.text, fontFamily: serif }]}>Bölümler</Text>
      {hasPlainTitles && (
        <Pressable
          onPress={() => saveChapters(regenerateTitles(book.chapters), 'Başlıklar yeniden oluşturuldu')}
          style={[s.secondary, { borderColor: t.border, backgroundColor: t.surface }]}
          accessibilityRole="button"
        >
          <Text style={{ color: t.text, fontWeight: '600' }}>Başlıkları ilk kelimelerden oluştur</Text>
        </Pressable>
      )}
      {book.chapters.map((c, i) => (
        <View key={i} style={s.chapRow}>
          <Text style={{ color: t.muted, flex: 1, paddingVertical: 8 }} numberOfLines={2}>{i + 1}. {c.title}</Text>
          <Pressable
            onPress={() => setRenaming(i)}
            style={s.chapEdit}
            accessibilityRole="button"
            accessibilityLabel={`${i + 1}. bölümün başlığını değiştir`}
          >
            <Text style={{ color: t.muted, fontSize: 18 }}>✎</Text>
          </Pressable>
        </View>
      ))}

      <RenameDialog
        visible={renaming !== null}
        label={renaming !== null ? `${renaming + 1}. bölüm` : ''}
        initial={renaming !== null ? book.chapters[renaming]?.title ?? '' : ''}
        c={{ card: t.surface, text: t.text, muted: t.muted, border: t.border, accent: t.accent }}
        onCancel={() => setRenaming(null)}
        onSave={(title) => renaming !== null && renameChapter(renaming, title)}
        onReset={() => renaming !== null && renameChapter(renaming, null)}
      />
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
  chapRow: { flexDirection: 'row', alignItems: 'center' },
  chapEdit: { width: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  deleteBtn: { flex: 0.6, borderWidth: 1.5 },
});
