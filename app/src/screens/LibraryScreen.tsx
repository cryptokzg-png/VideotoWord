import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { deleteBook, listBooks, saveBook } from '../db/db';
import type { BookRow } from '../types';
import { BookCard } from '../components/BookCard';
import { parseVideoId } from '../lib/youtube';
import { buildBook } from '../lib/buildBook';
import { sampleVideo } from '../lib/sample';
import { serif, useTheme } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Library'>;

export default function LibraryScreen({ navigation }: Props) {
  const t = useTheme();
  const [books, setBooks] = useState<BookRow[]>([]);
  const [link, setLink] = useState('');
  const [q, setQ] = useState('');

  const load = useCallback(() => { listBooks().then(setBooks); }, []);
  useFocusEffect(load);

  const convert = () => {
    const id = parseVideoId(link);
    if (!id) return Alert.alert('Geçersiz link', 'Geçerli bir YouTube linki yapıştır.');
    navigation.navigate('Convert', { videoId: id });
    setLink('');
  };

  const addDemo = async () => {
    await saveBook(buildBook(sampleVideo()));
    load();
  };

  const confirmDelete = (b: BookRow) =>
    Alert.alert('Kitabı sil', `"${b.title}" silinsin mi?`, [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Sil', style: 'destructive', onPress: async () => { await deleteBook(b.id); load(); } },
    ]);

  const shown = books.filter((b) => (b.title + b.author).toLowerCase().includes(q.toLowerCase()));

  return (
    <View style={[s.root, { backgroundColor: t.bg }]}>
      <View style={[s.hero, { backgroundColor: t.primaryDark }]}>
        <Text style={[s.h1, { fontFamily: serif }]}>YouTube'dan e-kitaba</Text>
        <View style={s.row}>
          <TextInput
            value={link}
            onChangeText={setLink}
            placeholder="YouTube linkini yapıştır"
            placeholderTextColor="#B8A9E0"
            autoCapitalize="none"
            autoCorrect={false}
            style={s.input}
            onSubmitEditing={convert}
          />
          <Pressable onPress={convert} style={[s.btn, { backgroundColor: t.accent }]} accessibilityRole="button">
            <Text style={s.btnText}>Dönüştür</Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={shown}
        keyExtractor={(b) => b.id}
        contentContainerStyle={{ padding: 16 }}
        ListHeaderComponent={books.length > 0 ? (
          <TextInput
            value={q} onChangeText={setQ} placeholder="Kitaplarda ara"
            placeholderTextColor={t.muted}
            style={[s.search, { backgroundColor: t.surface, borderColor: t.border, color: t.text }]}
          />
        ) : undefined}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={[s.emptyTitle, { color: t.text, fontFamily: serif }]}>Henüz kitap yok</Text>
            <Text style={{ color: t.muted, textAlign: 'center' }}>
              Yukarıya bir YouTube linki yapıştır ya da YouTube'dan "Paylaş" ile bu uygulamaya gönder.
            </Text>
            <Pressable onPress={addDemo} style={[s.demo, { borderColor: t.primary }]}>
              <Text style={{ color: t.primary, fontWeight: '700' }}>Örnek kitap ekle</Text>
            </Pressable>
          </View>
        }
        renderItem={({ item }) => (
          <BookCard
            book={item}
            onPress={() => navigation.navigate('BookDetail', { id: item.id })}
            onLongPress={() => confirmDelete(item)}
          />
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  hero: { padding: 20, paddingTop: 56, gap: 12 },
  h1: { color: '#fff', fontSize: 26, fontWeight: '800' },
  row: { flexDirection: 'row', gap: 8 },
  input: { flex: 1, backgroundColor: 'rgba(255,255,255,0.14)', color: '#fff', borderRadius: 12, paddingHorizontal: 14, height: 48 },
  btn: { borderRadius: 12, paddingHorizontal: 16, justifyContent: 'center' },
  btnText: { color: '#2A1065', fontWeight: '800' },
  search: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, height: 44, marginBottom: 12 },
  empty: { alignItems: 'center', gap: 10, paddingTop: 48, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 20, fontWeight: '700' },
  demo: { borderWidth: 1.5, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 18, marginTop: 8 },
});
