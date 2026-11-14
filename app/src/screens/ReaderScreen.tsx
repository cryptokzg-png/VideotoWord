import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { getBook, getBookmarks, setLastPage, toggleBookmark } from '../db/db';
import type { Book } from '../types';
import { serif } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Reader'>;

// B: Gece Kütüphanesi (default); light variant is the paper look from A.
const NIGHT = { bg: '#0E0B1F', card: '#151230', border: '#3A3366', text: '#DCD8F0', head: '#FFFFFF', muted: '#A9A3C8', accent: '#F5C542', onAccent: '#1B1204' };
const DAY = { bg: '#F4F1EC', card: '#FFFFFF', border: '#E3DED5', text: '#1B1B2F', head: '#1B1B2F', muted: '#6B6258', accent: '#5B21B6', onAccent: '#FFFFFF' };
type Palette = typeof NIGHT;

const SCALES = [0.85, 1, 1.15, 1.3, 1.5];

function Page({ text, chapter, width, c, size }: { text: string; chapter: number; width: number; c: Palette; size: number }) {
  const isHeading = text.startsWith('# ');
  const [head, ...rest] = isHeading ? text.slice(2).split('\n\n') : [null, text];
  return (
    <ScrollView style={{ width }} contentContainerStyle={s.pageContent}>
      {head ? (
        <>
          <Text style={[s.kicker, { color: c.accent }]}>BÖLÜM {chapter}</Text>
          <Text style={[s.head, { color: c.head, fontFamily: serif }]}>{head}</Text>
        </>
      ) : null}
      <Text style={{ color: c.text, fontFamily: serif, fontSize: 19 * size, lineHeight: 19 * size * 1.7 }}>
        {rest.join('\n\n')}
      </Text>
    </ScrollView>
  );
}

export default function ReaderScreen({ route, navigation }: Props) {
  const [book, setBook] = useState<Book | null>(null);
  const [page, setPage] = useState(0);
  const [night, setNight] = useState(true);
  const [scaleIdx, setScaleIdx] = useState(1);
  const [large, setLarge] = useState(false);
  const [marks, setMarks] = useState<number[]>([]);
  const [menu, setMenu] = useState(false);
  const [goto, setGoto] = useState(false);
  const [gotoText, setGotoText] = useState('');
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const list = useRef<FlatList<string>>(null);
  const c = night ? NIGHT : DAY;
  const size = SCALES[scaleIdx] * (large ? 1.25 : 1);

  useEffect(() => {
    getBook(route.params.id).then((b) => {
      setBook(b);
      if (b) setPage(Math.min(b.lastPage, b.pages.length - 1));
    });
    getBookmarks(route.params.id).then(setMarks);
  }, [route.params.id]);

  const go = useCallback((p: number) => {
    if (!book) return;
    const i = Math.max(0, Math.min(book.pages.length - 1, p));
    list.current?.scrollToIndex({ index: i, animated: true });
    setPage(i);
    setLastPage(book.id, i);
  }, [book]);

  const flipMark = async () => {
    if (!book) return;
    await toggleBookmark(book.id, page);
    setMarks(await getBookmarks(book.id));
  };

  if (!book) return <View style={[s.root, { backgroundColor: c.bg }]} />;
  const total = book.pages.length;
  const marked = marks.includes(page);

  // chapter number of every page (a page starting with "# " opens a chapter)
  const chapterOf: number[] = [];
  let n = 0;
  book.pages.forEach((p, i) => { if (p.startsWith('# ')) n++; chapterOf[i] = Math.max(1, n); });
  const chapters = book.pages
    .map((p, i) => (p.startsWith('# ') ? { i, title: p.slice(2).split('\n')[0] } : null))
    .filter((x): x is { i: number; title: string } => !!x);

  const btn = [s.pill, { backgroundColor: c.card, borderColor: c.border }];

  return (
    <View style={[s.root, { backgroundColor: c.bg }]}>
      <View style={[s.progressTrack, { backgroundColor: c.border, marginTop: insets.top }]}>
        <View style={[s.progressFill, { backgroundColor: c.accent, width: `${((page + 1) / total) * 100}%` }]} />
      </View>

      <View style={s.floating}>
        <Pressable onPress={() => setLarge((v) => !v)} style={btn} accessibilityRole="button" accessibilityState={{ selected: large }}>
          <Text style={[s.pillText, { color: c.text }]}>{large ? 'Küçült' : 'Büyüt'}</Text>
        </Pressable>
        <Pressable onPress={() => setMenu(true)} style={btn} accessibilityRole="button">
          <Text style={[s.pillText, { color: c.text }]}>Menü</Text>
        </Pressable>
      </View>

      <FlatList
        ref={list}
        data={book.pages}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(_, i) => String(i)}
        initialScrollIndex={page}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        onMomentumScrollEnd={(e) => {
          const i = Math.round(e.nativeEvent.contentOffset.x / width);
          setPage(i);
          setLastPage(book.id, i);
        }}
        renderItem={({ item, index }) => (
          <Page text={item} chapter={chapterOf[index]} width={width} c={c} size={size} />
        )}
        style={{ flex: 1 }}
      />

      <View style={[s.card, { backgroundColor: c.card, borderColor: c.border, marginBottom: Math.max(insets.bottom, 12) }]}>
        <View style={s.cardRow}>
          <Text style={{ color: c.muted, fontSize: 13 }}>Yazı boyutu</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              onPress={() => setScaleIdx((i) => Math.max(0, i - 1))}
              style={[s.square, { borderColor: c.border }]} accessibilityRole="button" accessibilityLabel="Yazıyı küçült"
            >
              <Text style={{ color: c.text, fontWeight: '600' }}>A−</Text>
            </Pressable>
            <Pressable
              onPress={() => setScaleIdx((i) => Math.min(SCALES.length - 1, i + 1))}
              style={[s.square, { borderColor: c.border }]} accessibilityRole="button" accessibilityLabel="Yazıyı büyüt"
            >
              <Text style={{ color: c.text, fontWeight: '700', fontSize: 18 }}>A+</Text>
            </Pressable>
            <Pressable
              onPress={flipMark}
              style={[s.square, { backgroundColor: marked ? c.accent : 'transparent', borderColor: marked ? c.accent : c.border }]}
              accessibilityRole="button" accessibilityLabel={marked ? 'Yer imini kaldır' : 'Yer imi koy'}
            >
              <Text style={{ color: marked ? c.onAccent : c.text, fontSize: 18 }}>{marked ? '★' : '☆'}</Text>
            </Pressable>
          </View>
        </View>
        <View style={s.cardRow}>
          <Pressable onPress={() => go(page - 1)} disabled={page === 0} style={[s.nav, { opacity: page === 0 ? 0.4 : 1 }]} accessibilityRole="button">
            <Text style={{ color: c.text, fontWeight: '600' }}>‹ Önceki</Text>
          </Pressable>
          <Text style={{ color: c.text, fontWeight: '600' }}>{page + 1} / {total}</Text>
          <Pressable onPress={() => go(page + 1)} disabled={page >= total - 1} style={[s.nav, { opacity: page >= total - 1 ? 0.4 : 1 }]} accessibilityRole="button">
            <Text style={{ color: c.accent, fontWeight: '700' }}>Sonraki ›</Text>
          </Pressable>
        </View>
      </View>

      <Modal visible={menu} animationType="slide" onRequestClose={() => setMenu(false)}>
        <SafeAreaView style={[s.root, { backgroundColor: c.bg }]}>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 4 }}>
            <Text style={[s.menuTitle, { color: c.head, fontFamily: serif }]} numberOfLines={2}>{book.title}</Text>

            <Text style={[s.kicker, { color: c.muted, marginTop: 16 }]}>İÇİNDEKİLER</Text>
            {chapters.map((ch, k) => (
              <Pressable key={ch.i} onPress={() => { setMenu(false); setTimeout(() => go(ch.i), 80); }} style={s.menuRow} accessibilityRole="button">
                <Text style={{ color: c.text, flex: 1 }}>{k + 1}. {ch.title}</Text>
                <Text style={{ color: c.muted }}>{ch.i + 1}</Text>
              </Pressable>
            ))}

            {marks.length > 0 && <Text style={[s.kicker, { color: c.muted, marginTop: 16 }]}>YER İMLERİ</Text>}
            {marks.map((m) => (
              <Pressable key={m} onPress={() => { setMenu(false); setTimeout(() => go(m), 80); }} style={s.menuRow} accessibilityRole="button">
                <Text style={{ color: c.accent }}>★ Sayfa {m + 1}</Text>
              </Pressable>
            ))}

            <Text style={[s.kicker, { color: c.muted, marginTop: 16 }]}>OKUMA</Text>
            <Pressable onPress={() => { setMenu(false); setTimeout(() => { setGotoText(''); setGoto(true); }, 80); }} style={s.menuRow} accessibilityRole="button">
              <Text style={{ color: c.text }}>Sayfaya git</Text>
            </Pressable>
            <Pressable onPress={() => setNight((v) => !v)} style={s.menuRow} accessibilityRole="button">
              <Text style={{ color: c.text }}>{night ? 'Gündüz modu' : 'Gece modu'}</Text>
            </Pressable>
            <Pressable onPress={() => { setMenu(false); navigation.goBack(); }} style={s.menuRow} accessibilityRole="button">
              <Text style={{ color: c.text }}>Kitabı kapat</Text>
            </Pressable>
            <Pressable onPress={() => setMenu(false)} style={[s.menuRow, { marginTop: 12 }]} accessibilityRole="button">
              <Text style={{ color: c.accent, fontWeight: '700' }}>Okumaya dön</Text>
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal visible={goto} transparent animationType="fade" onRequestClose={() => setGoto(false)}>
        <View style={s.backdrop}>
          <View style={[s.dialog, { backgroundColor: c.card }]}>
            <Text style={{ color: c.text, fontWeight: '700' }}>Sayfaya git (1–{total})</Text>
            <TextInput
              value={gotoText} onChangeText={setGotoText} keyboardType="number-pad" autoFocus
              style={[s.gotoInput, { color: c.text, borderColor: c.border }]}
            />
            <View style={{ flexDirection: 'row', gap: 16, justifyContent: 'flex-end' }}>
              <Pressable onPress={() => setGoto(false)} accessibilityRole="button"><Text style={{ color: c.muted }}>Vazgeç</Text></Pressable>
              <Pressable
                onPress={() => {
                  const num = parseInt(gotoText, 10);
                  if (!num || num < 1 || num > total) return Alert.alert('Geçersiz sayfa');
                  setGoto(false);
                  go(num - 1);
                }}
                accessibilityRole="button"
              ><Text style={{ color: c.accent, fontWeight: '700' }}>Git</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  progressTrack: { height: 3 },
  progressFill: { height: 3 },
  floating: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, paddingHorizontal: 16, paddingTop: 12 },
  pill: { height: 44, borderRadius: 22, borderWidth: 1, paddingHorizontal: 18, justifyContent: 'center' },
  pillText: { fontWeight: '600', fontSize: 14 },
  pageContent: { paddingHorizontal: 28, paddingTop: 20, paddingBottom: 24, gap: 14 },
  kicker: { fontSize: 11, letterSpacing: 1.6, fontWeight: '700' },
  head: { fontSize: 32, lineHeight: 36 },
  card: { marginHorizontal: 20, borderWidth: 1, borderRadius: 16, padding: 14, gap: 6 },
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  square: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  nav: { height: 44, paddingHorizontal: 4, justifyContent: 'center' },
  menuTitle: { fontSize: 26, lineHeight: 30 },
  menuRow: { flexDirection: 'row', minHeight: 48, alignItems: 'center' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 32 },
  dialog: { borderRadius: 14, padding: 20, gap: 12 },
  gotoInput: { borderWidth: 1, borderRadius: 10, padding: 10, fontSize: 18 },
});
