import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { getBook, getBookmarks, setLastPage, toggleBookmark } from '../db/db';
import type { Book } from '../types';
import { serif, useTheme } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Reader'>;

function PageView({ text, n, total, title }: { text: string; n: number; total: number; title: string }) {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const isHeading = text.startsWith('# ');
  const [head, ...rest] = isHeading ? text.slice(2).split('\n\n') : [null, text];
  return (
    <View style={{ width, padding: 16 }}>
      <View style={[s.page, { backgroundColor: t.page, borderColor: t.border }]}>
        <Text style={[s.running, { color: t.muted }]}>{title.toUpperCase()}</Text>
        {head ? (
          <>
            <Text style={[s.head, { color: t.text, fontFamily: serif }]}>{head}</Text>
            <View style={[s.rule, { backgroundColor: t.primary }]} />
          </>
        ) : null}
        <Text style={[s.body, { color: t.text }]}>{rest.join('\n\n')}</Text>
        <Text style={[s.num, { color: t.muted }]}>{n} / {total}</Text>
      </View>
    </View>
  );
}

export default function ReaderScreen({ route, navigation }: Props) {
  const [book, setBook] = useState<Book | null>(null);
  const [page, setPage] = useState(0);
  const [dark, setDark] = useState(false);
  const [marks, setMarks] = useState<number[]>([]);
  const [toc, setToc] = useState(false);
  const [goto, setGoto] = useState(false);
  const [gotoText, setGotoText] = useState('');
  const t = useTheme(dark ? 'dark' : 'light');
  const { width } = useWindowDimensions();
  const list = useRef<FlatList<string>>(null);

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

  if (!book) return <View style={[s.root, { backgroundColor: t.bg }]} />;
  const total = book.pages.length;
  const marked = marks.includes(page);

  const chapterPages = book.pages
    .map((p, i) => (p.startsWith('# ') ? { i, title: p.slice(2).split('\n')[0] } : null))
    .filter((x): x is { i: number; title: string } => !!x);

  return (
    <SafeAreaView style={[s.root, { backgroundColor: t.bg }]}>
      <View style={[s.top, { borderColor: t.border }]}>
        <Pressable onPress={() => setToc(true)}><Text style={{ color: t.text }}>İçindekiler</Text></Pressable>
        <Text style={[s.title, { color: t.text, fontFamily: serif }]} numberOfLines={1}>{book.title}</Text>
        <Pressable onPress={() => navigation.goBack()}><Text style={{ color: t.text }}>Kapat</Text></Pressable>
      </View>

      <View style={[s.tools, { borderColor: t.border }]}>
        <Pressable onPress={() => { setGotoText(''); setGoto(true); }}><Text style={{ color: t.text }}>Sayfaya git</Text></Pressable>
        <Pressable onPress={async () => setMarks(await (async () => { await toggleBookmark(book.id, page); return getBookmarks(book.id); })())}>
          <Text style={{ color: marked ? t.accent : t.text }}>{marked ? '★ Yer imi' : '☆ Yer imi'}</Text>
        </Pressable>
        <Pressable onPress={() => setDark((d) => !d)}><Text style={{ color: t.text }}>{dark ? 'Gündüz' : 'Gece modu'}</Text></Pressable>
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
          <PageView text={item} n={index + 1} total={total} title={book.title} />
        )}
        style={{ flex: 1 }}
      />

      <View style={[s.bottom, { borderColor: t.border }]}>
        <Pressable onPress={() => go(page - 1)} disabled={page === 0} style={[s.nav, { opacity: page === 0 ? 0.4 : 1, backgroundColor: t.surface }]}>
          <Text style={{ color: t.text }}>‹ Önceki</Text>
        </Pressable>
        <Text style={{ color: t.text, fontWeight: '600' }}>{page + 1} / {total}</Text>
        <Pressable onPress={() => go(page + 1)} disabled={page >= total - 1} style={[s.nav, { opacity: page >= total - 1 ? 0.4 : 1, backgroundColor: t.surface }]}>
          <Text style={{ color: t.text }}>Sonraki ›</Text>
        </Pressable>
      </View>

      <Modal visible={toc} animationType="slide" onRequestClose={() => setToc(false)}>
        <SafeAreaView style={[s.root, { backgroundColor: t.bg, padding: 20 }]}>
          <Text style={[s.head, { color: t.text, fontFamily: serif }]}>İçindekiler</Text>
          {chapterPages.map((c) => (
            <Pressable key={c.i} onPress={() => { setToc(false); setTimeout(() => go(c.i), 50); }} style={s.tocRow}>
              <Text style={{ color: t.text, flex: 1 }}>{c.title}</Text>
              <Text style={{ color: t.muted }}>{c.i + 1}</Text>
            </Pressable>
          ))}
          {marks.length > 0 && <Text style={[s.running, { color: t.muted, marginTop: 20 }]}>YER İMLERİ</Text>}
          {marks.map((m) => (
            <Pressable key={m} onPress={() => { setToc(false); setTimeout(() => go(m), 50); }} style={s.tocRow}>
              <Text style={{ color: t.accent }}>★ Sayfa {m + 1}</Text>
            </Pressable>
          ))}
          <Pressable onPress={() => setToc(false)} style={{ marginTop: 24 }}><Text style={{ color: t.primary }}>Kapat</Text></Pressable>
        </SafeAreaView>
      </Modal>

      <Modal visible={goto} transparent animationType="fade" onRequestClose={() => setGoto(false)}>
        <View style={s.backdrop}>
          <View style={[s.dialog, { backgroundColor: t.surface }]}>
            <Text style={{ color: t.text, fontWeight: '700' }}>Sayfaya git (1–{total})</Text>
            <TextInput
              value={gotoText} onChangeText={setGotoText} keyboardType="number-pad" autoFocus
              style={[s.gotoInput, { color: t.text, borderColor: t.border }]}
            />
            <View style={{ flexDirection: 'row', gap: 16, justifyContent: 'flex-end' }}>
              <Pressable onPress={() => setGoto(false)}><Text style={{ color: t.muted }}>Vazgeç</Text></Pressable>
              <Pressable onPress={() => {
                const n = parseInt(gotoText, 10);
                if (!n || n < 1 || n > total) return Alert.alert('Geçersiz sayfa');
                setGoto(false);
                go(n - 1);
              }}><Text style={{ color: t.primary, fontWeight: '700' }}>Git</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderBottomWidth: 1, gap: 12 },
  title: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700' },
  tools: { flexDirection: 'row', justifyContent: 'space-around', padding: 12, borderBottomWidth: 1 },
  page: { flex: 1, borderWidth: 1, borderRadius: 4, padding: 24 },
  running: { fontSize: 11, letterSpacing: 1.2, fontWeight: '600' },
  head: { fontSize: 26, fontWeight: '800', marginTop: 24 },
  rule: { height: 3, borderRadius: 2, marginVertical: 14 },
  body: { fontSize: 17, lineHeight: 28, marginTop: 8 },
  num: { position: 'absolute', bottom: 12, alignSelf: 'center', fontSize: 12 },
  bottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderTopWidth: 1 },
  nav: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 10 },
  tocRow: { flexDirection: 'row', paddingVertical: 12 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 32 },
  dialog: { borderRadius: 14, padding: 20, gap: 12 },
  gotoInput: { borderWidth: 1, borderRadius: 10, padding: 10, fontSize: 18 },
});
