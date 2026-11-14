import { useCallback, useRef, useState, type ComponentRef } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { deleteBook, listBooks, saveBook } from '../db/db';
import type { BookRow } from '../types';
import { BookCard, ContinueCard } from '../components/BookCard';
import { parseVideoId } from '../lib/youtube';
import { buildBook } from '../lib/buildBook';
import { sampleVideo } from '../lib/sample';
import { serif, useTheme } from '../theme';
import { progressOf } from '../db/db';

type Props = NativeStackScreenProps<RootStackParamList, 'Library'>;

export default function LibraryScreen({ navigation }: Props) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [books, setBooks] = useState<BookRow[]>([]);
  const [link, setLink] = useState('');
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const [clip, setClip] = useState<string | null>(null); // video id found on the clipboard
  const dismissed = useRef<Set<string>>(new Set());

  const load = useCallback(() => {
    listBooks().then((rows) => {
      setBooks(rows);
      // offer to convert a YouTube link that is on the clipboard
      Clipboard.getStringAsync()
        .then((text) => {
          const id = parseVideoId(text ?? '');
          setClip(id && !dismissed.current.has(id) && !rows.some((b) => b.id === id) ? id : null);
        })
        .catch(() => setClip(null));
    });
  }, []);
  useFocusEffect(load);

  const pasteFromClipboard = async () => {
    const text = (await Clipboard.getStringAsync().catch(() => ''))?.trim();
    if (!text) return Alert.alert('Pano boş', 'Önce YouTube\'dan bir video linki kopyala.');
    setLink(text);
  };

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

  // most recently opened-but-unfinished book, else none
  const reading = books.find((b) => progressOf(b) > 0 && progressOf(b) < 0.97);
  const rest = books.filter((b) => b !== reading);

  return (
    <View style={[s.root, { backgroundColor: t.bg }]}>
      <View style={[s.hero, { backgroundColor: t.primaryDark }]}>
        <View style={s.brand}>
          <Image source={require('../../assets/logo-mark.png')} style={s.logo} accessibilityIgnoresInvertColors />
          <Text style={s.brandName}>BARIŞ KİTAPLIK</Text>
        </View>
        <View style={s.row}>
          <TextInput
            ref={input}
            value={link}
            onChangeText={setLink}
            placeholder="YouTube linki"
            placeholderTextColor="#B9C4E8"
            autoCapitalize="none"
            autoCorrect={false}
            style={s.input}
            onSubmitEditing={convert}
            accessibilityLabel="YouTube linki"
          />
          <Pressable
            onPress={link.trim() ? convert : pasteFromClipboard}
            style={[s.btn, { backgroundColor: t.accent }]}
            accessibilityRole="button"
          >
            <Text style={s.btnText}>{link.trim() ? 'Dönüştür' : 'Yapıştır'}</Text>
          </Pressable>
        </View>
      </View>

      {clip && (
        <View style={[s.banner, { backgroundColor: t.surface, borderColor: t.accent }]}>
          <Text style={{ color: t.text, flex: 1 }} numberOfLines={2}>Panoda bir YouTube linki var. Kitaba çevirelim mi?</Text>
          <Pressable
            onPress={() => { dismissed.current.add(clip); setClip(null); navigation.navigate('Convert', { videoId: clip }); }}
            style={[s.bannerBtn, { backgroundColor: t.accent }]}
            accessibilityRole="button"
          >
            <Text style={{ color: '#142041', fontWeight: '800' }}>Çevir</Text>
          </Pressable>
          <Pressable
            onPress={() => { dismissed.current.add(clip); setClip(null); }}
            style={s.bannerBtn}
            accessibilityRole="button"
            accessibilityLabel="Kapat"
          >
            <Text style={{ color: t.muted, fontWeight: '700' }}>Kapat</Text>
          </Pressable>
        </View>
      )}

      <ScrollView contentContainerStyle={s.content}>
        {books.length === 0 && (
          <View style={s.empty}>
            <Text style={[s.emptyTitle, { color: t.text, fontFamily: serif }]}>Henüz kitap yok</Text>
            <Text style={{ color: t.muted, textAlign: 'center' }}>
              Yukarıya bir YouTube linki yapıştır ya da YouTube'dan "Paylaş" ile bu uygulamaya gönder.
            </Text>
            <Pressable onPress={addDemo} style={[s.demo, { borderColor: t.primary }]} accessibilityRole="button">
              <Text style={{ color: t.primary, fontWeight: '700' }}>Örnek kitap ekle</Text>
            </Pressable>
          </View>
        )}

        {reading && (
          <>
            <Text style={[s.label, { color: t.muted }]}>OKUMAYA DEVAM ET</Text>
            <ContinueCard
              book={reading}
              onPress={() => navigation.navigate('Reader', { id: reading.id })}
              onLongPress={() => confirmDelete(reading)}
            />
          </>
        )}

        {rest.length > 0 && (
          <>
            <Text style={[s.label, { color: t.muted }]}>{reading ? 'SON EKLENENLER' : 'KİTAPLARIM'}</Text>
            {rest.map((b) => (
              <BookCard
                key={b.id}
                book={b}
                onPress={() => navigation.navigate('BookDetail', { id: b.id })}
                onLongPress={() => confirmDelete(b)}
              />
            ))}
          </>
        )}
        {books.length > 0 && (
          <Text style={{ color: t.muted, fontSize: 12, textAlign: 'center', marginTop: 8 }}>
            Bir kitabı silmek için üzerine uzun bas ya da kitabı açıp "Kitabı sil"e dokun.
          </Text>
        )}
      </ScrollView>

      <View style={[s.tabs, { backgroundColor: t.surface, borderColor: t.border, paddingBottom: Math.max(insets.bottom, 8) }]}>
        <Pressable style={s.tab} accessibilityRole="tab" accessibilityState={{ selected: true }}>
          <Text style={{ color: t.primary, fontWeight: '700', fontSize: 12 }}>Kütüphane</Text>
        </Pressable>
        <Pressable style={s.tab} onPress={() => input.current?.focus()} accessibilityRole="tab">
          <Text style={{ color: t.muted, fontWeight: '600', fontSize: 12 }}>Ekle</Text>
        </Pressable>
        <Pressable style={s.tab} onPress={() => navigation.navigate('Settings')} accessibilityRole="tab">
          <Text style={{ color: t.muted, fontWeight: '600', fontSize: 12 }}>Ayarlar</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  hero: { padding: 20, paddingTop: 56, gap: 16 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logo: { width: 54, height: 48, resizeMode: 'contain' },
  brandName: { color: '#fff', fontSize: 20, fontWeight: '800', letterSpacing: 2 },
  row: { flexDirection: 'row', gap: 8 },
  input: { flex: 1, backgroundColor: 'rgba(255,255,255,0.14)', color: '#fff', borderRadius: 12, paddingHorizontal: 14, height: 48 },
  btn: { borderRadius: 12, paddingHorizontal: 16, justifyContent: 'center' },
  btnText: { color: '#142041', fontWeight: '800' },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 20, marginTop: 14, padding: 12, borderRadius: 14, borderWidth: 1.5 },
  bannerBtn: { minHeight: 44, minWidth: 56, paddingHorizontal: 10, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, gap: 10 },
  label: { fontSize: 11, letterSpacing: 1.4, fontWeight: '600', marginTop: 6 },
  empty: { alignItems: 'center', gap: 10, paddingTop: 32, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 20, fontWeight: '700' },
  demo: { borderWidth: 1.5, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 18, marginTop: 8 },
  tabs: { flexDirection: 'row', justifyContent: 'space-around', borderTopWidth: 1 },
  tab: { minWidth: 96, height: 56, alignItems: 'center', justifyContent: 'center' },
});
