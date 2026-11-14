import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { getBook, getMarks, setLastPos, setPageCount, toggleMark } from '../db/db';
import { COVER, pageForPos, pageStarts, pagesFromLines } from '../lib/layout';
import { searchBook, type SearchHit } from '../lib/search';
import { exportEpub, exportPdf } from '../lib/shareBook';
import { describeBook } from '../lib/sizeLabel';
import type { Book } from '../types';
import { FONT_FAMILIES, FONT_SCALES, useSettings } from '../settings';
import { useIsDark } from '../theme';
import { PageFlipper, type FlipHandle } from '../components/PageFlipper';
import { Measurer } from '../components/Measurer';

type Props = NativeStackScreenProps<RootStackParamList, 'Reader'>;

const NIGHT = { bg: '#0B1228', card: '#121B3A', border: '#2A3566', text: '#DDE3F5', head: '#FFFFFF', muted: '#9AA6C8', accent: '#D4AF37', onAccent: '#1B1204' };
const DAY = { bg: '#F5F2EA', card: '#FFFFFF', border: '#E3DED5', text: '#141B34', head: '#141B34', muted: '#5F6578', accent: '#1E3A8A', onAccent: '#FFFFFF' };
type Palette = typeof NIGHT;

const PAD_X = 28;
const PAD_TOP = 20;
const PAD_BOTTOM = 22;
const BASE_FONT = 19;

function Heading({ chapter, title, c, family }: { chapter: number; title: string; c: Palette; family: string }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text allowFontScaling={false} style={[s.kicker, { color: c.accent }]}>BÖLÜM {chapter}</Text>
      <Text allowFontScaling={false} style={[s.head, { color: c.head, fontFamily: family }]}>{title}</Text>
    </View>
  );
}

type TextStyleSpec = { fontFamily: string; fontSize: number; lineHeight: number };

function TextPage({ text, chapter, c, width, height, spec }: {
  text: string; chapter: number; c: Palette; width: number; height: number; spec: TextStyleSpec;
}) {
  const isHeading = text.startsWith('# ');
  const sep = text.indexOf('\n\n');
  const title = isHeading ? text.slice(2, sep) : null;
  const body = isHeading ? text.slice(sep + 2) : text;
  return (
    <View style={{ width, height, paddingHorizontal: PAD_X, paddingTop: PAD_TOP, overflow: 'hidden' }}>
      {title !== null && <Heading chapter={chapter} title={title} c={c} family={spec.fontFamily} />}
      <Text
        allowFontScaling={false}
        textBreakStrategy="simple"
        android_hyphenationFrequency="none"
        style={{ color: c.text, ...spec }}
      >
        {body}
      </Text>
    </View>
  );
}

function CoverPage({ book, pageCount, c, width, height, family }: {
  book: Book; pageCount: number; c: Palette; width: number; height: number; family: string;
}) {
  return (
    <View style={{ width, height, paddingHorizontal: PAD_X, justifyContent: 'center', alignItems: 'center', gap: 14 }}>
      <Image source={require('../../assets/logo-mark.png')} style={{ width: 96, height: 86, resizeMode: 'contain' }} accessibilityIgnoresInvertColors />
      <Text allowFontScaling={false} style={[s.coverKicker, { color: c.accent }]}>{describeBook(pageCount).toUpperCase()}</Text>
      <Text allowFontScaling={false} style={{ color: c.head, fontFamily: family, fontSize: 28, lineHeight: 33, fontWeight: '800', textAlign: 'center' }}>
        {book.title}
      </Text>
      {!!book.author && <Text allowFontScaling={false} style={{ color: c.muted, fontSize: 15 }}>{book.author}</Text>}
      <Pressable
        onPress={() => Linking.openURL(book.url).catch(() => Alert.alert('Açılamadı', 'YouTube uygulaması ya da tarayıcı bulunamadı.'))}
        style={[s.ytBtn, { borderColor: c.accent }]}
        accessibilityRole="link"
        accessibilityLabel="Kaynak videoyu YouTube'da aç"
      >
        <Text allowFontScaling={false} style={{ color: c.accent, fontWeight: '700', fontSize: 15 }}>YouTube'da aç</Text>
      </Pressable>
      <Text allowFontScaling={false} style={{ color: c.muted, fontSize: 13, marginTop: 8 }}>Çevirmek için kaydır ya da kenarlara dokun ›</Text>
    </View>
  );
}

export default function ReaderScreen({ route, navigation }: Props) {
  const { settings, update } = useSettings();
  const isDark = useIsDark();
  const c = isDark ? NIGHT : DAY;
  const family = FONT_FAMILIES[settings.font];

  const [book, setBook] = useState<Book | null>(null);
  const [pages, setPages] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const [large, setLarge] = useState(false);
  const [marks, setMarks] = useState<number[]>([]);
  const [menu, setMenu] = useState(false);
  const [goto, setGoto] = useState(false);
  const [gotoText, setGotoText] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [area, setArea] = useState({ w: 0, h: 0 });
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const flip = useRef<FlipHandle>(null);
  const posRef = useRef(0); // reading position (non-space chars); survives re-layout
  const startedFresh = useRef(true);

  const fontSize = BASE_FONT * FONT_SCALES[settings.fontIdx] * (large ? 1.25 : 1);
  const spec: TextStyleSpec = useMemo(
    () => ({ fontFamily: family, fontSize, lineHeight: Math.round(fontSize * 1.7) }),
    [family, fontSize],
  );
  const contentW = width - PAD_X * 2;
  const contentH = area.h - PAD_TOP - PAD_BOTTOM - 4;

  useEffect(() => {
    getBook(route.params.id).then((b) => {
      if (b) {
        posRef.current = b.lastPos;
        startedFresh.current = b.lastPos === 0;
      }
      setBook(b);
    });
    getMarks(route.params.id).then(setMarks);
  }, [route.params.id]);

  const starts = useMemo(() => pageStarts(pages), [pages]);

  const indexFor = useCallback(
    (pos: number) => (pos === 0 && startedFresh.current ? 0 : Math.max(1, pageForPos(starts, pos))),
    [starts],
  );

  const onMeasured = useCallback(
    (lines: string[][], heads: number[]) => {
      if (!book) return;
      const next = pagesFromLines(book.chapters, lines, heads, spec.lineHeight, contentH);
      setPages(next);
    },
    [book, spec.lineHeight, contentH],
  );

  // after a re-layout, return to the same place in the text
  useEffect(() => {
    if (pages.length) setPage(indexFor(posRef.current));
  }, [pages, indexFor]);

  // remember the real page count so the library shows the number from this phone
  useEffect(() => {
    if (!book || pages.length < 2) return;
    const t = setTimeout(() => setPageCount(book.id, pages.length - 1), 800);
    return () => clearTimeout(t);
  }, [book, pages.length]);

  const onIndexChange = useCallback(
    (i: number) => {
      if (!book) return;
      setPage(i);
      posRef.current = starts[i] ?? 0;
      startedFresh.current = false;
      setLastPos(book.id, starts[i] ?? 0);
    },
    [book, starts],
  );

  const jump = useCallback(
    (i: number) => {
      if (!book || !pages.length) return;
      const idx = Math.max(0, Math.min(pages.length - 1, i));
      onIndexChange(idx);
    },
    [book, pages.length, onIndexChange],
  );

  const pinch = useCallback(
    (dir: 1 | -1) => update({ fontIdx: Math.max(0, Math.min(FONT_SCALES.length - 1, settings.fontIdx + dir)) }),
    [settings.fontIdx, update],
  );

  const flipMark = async () => {
    if (!book || !pages.length) return;
    const end = page + 1 < starts.length ? starts[page + 1] : Number.MAX_SAFE_INTEGER;
    await toggleMark(book.id, starts[page], end);
    setMarks(await getMarks(book.id));
  };

  const hits: SearchHit[] = useMemo(() => (book && searchOpen ? searchBook(book.chapters, query) : []), [book, searchOpen, query]);

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    try {
      await fn();
    } catch (e: any) {
      Alert.alert('Dışa aktarılamadı', String(e?.message ?? e));
    } finally {
      setBusy(null);
    }
  };

  if (!book) return <View style={[s.root, { backgroundColor: c.bg }]} />;

  const total = Math.max(1, pages.length);
  const pageEnd = page + 1 < starts.length ? starts[page + 1] : Number.MAX_SAFE_INTEGER;
  const marked = pages.length > 0 && marks.some((m) => m >= starts[page] && m < pageEnd);

  const chapterOf: number[] = [];
  let n = 0;
  pages.forEach((p, i) => { if (p.startsWith('# ')) n++; chapterOf[i] = Math.max(1, n); });
  const chapterPages = pages
    .map((p, i) => (p.startsWith('# ') ? { i, title: p.slice(2, p.indexOf('\n\n')) } : null))
    .filter((x): x is { i: number; title: string } => !!x);

  const progress = pages.length ? Math.min(1, (starts[page] ?? 0) / Math.max(1, book.totalChars)) : 0;
  const btn = [s.pill, { backgroundColor: c.card, borderColor: c.border }];
  const ready = pages.length > 0 && area.h > 0;
  const layoutKey = `${contentW}-${contentH}-${spec.fontFamily}-${spec.fontSize}`;
  const closeAnd = (fn: () => void) => { setMenu(false); setTimeout(fn, 120); };

  return (
    <View style={[s.root, { backgroundColor: c.bg }]}>
      <View style={[s.progressTrack, { backgroundColor: c.border, marginTop: insets.top }]}>
        <View style={[s.progressFill, { backgroundColor: c.accent, width: `${progress * 100}%` }]} />
      </View>

      <View style={s.floating}>
        <Pressable onPress={() => setLarge((v) => !v)} style={btn} accessibilityRole="button" accessibilityState={{ selected: large }}>
          <Text style={[s.pillText, { color: c.text }]}>{large ? 'Küçült' : 'Büyüt'}</Text>
        </Pressable>
        <Pressable onPress={() => setMenu(true)} style={btn} accessibilityRole="button">
          <Text style={[s.pillText, { color: c.text }]}>Menü</Text>
        </Pressable>
      </View>

      <View style={{ flex: 1 }} onLayout={(e) => setArea({ w: e.nativeEvent.layout.width, h: Math.round(e.nativeEvent.layout.height) })}>
        {area.h > 0 && (
          <Measurer
            key={layoutKey}
            chapters={book.chapters}
            width={contentW}
            textStyle={spec}
            heading={(i, ch) => <Heading chapter={i + 1} title={ch.title} c={c} family={family} />}
            onDone={onMeasured}
          />
        )}
        {ready ? (
          <PageFlipper
            ref={flip}
            count={pages.length}
            index={Math.min(page, pages.length - 1)}
            width={width}
            height={area.h}
            bg={c.bg}
            onIndexChange={onIndexChange}
            onPinch={pinch}
            renderPage={(i) =>
              pages[i] === COVER ? (
                <CoverPage book={book} pageCount={Math.max(1, pages.length - 1)} c={c} width={width} height={area.h} family={family} />
              ) : (
                <TextPage text={pages[i]} chapter={chapterOf[i]} c={c} width={width} height={area.h} spec={spec} />
              )
            }
          />
        ) : (
          <View style={s.center}><ActivityIndicator color={c.accent} /></View>
        )}
      </View>

      <View style={[s.card, { backgroundColor: c.card, borderColor: c.border, marginBottom: Math.max(insets.bottom, 12) }]}>
        <View style={s.cardRow}>
          <Text style={{ color: c.muted, fontSize: 13 }}>Yazı boyutu</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable onPress={() => pinch(-1)} style={[s.square, { borderColor: c.border }]} accessibilityRole="button" accessibilityLabel="Yazıyı küçült">
              <Text style={{ color: c.text, fontWeight: '600' }}>A−</Text>
            </Pressable>
            <Pressable onPress={() => pinch(1)} style={[s.square, { borderColor: c.border }]} accessibilityRole="button" accessibilityLabel="Yazıyı büyüt">
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
          <Pressable onPress={() => flip.current?.prev()} disabled={page === 0} style={[s.nav, { opacity: page === 0 ? 0.4 : 1 }]} accessibilityRole="button">
            <Text style={{ color: c.text, fontWeight: '600' }}>‹ Önceki</Text>
          </Pressable>
          <Text style={{ color: c.text, fontWeight: '600' }}>{page === 0 ? 'Kapak' : `${page} / ${total - 1}`}</Text>
          <Pressable onPress={() => flip.current?.next()} disabled={page >= total - 1} style={[s.nav, { opacity: page >= total - 1 ? 0.4 : 1 }]} accessibilityRole="button">
            <Text style={{ color: c.accent, fontWeight: '700' }}>Sonraki ›</Text>
          </Pressable>
        </View>
      </View>

      <Modal visible={menu} animationType="slide" onRequestClose={() => setMenu(false)}>
        <SafeAreaView style={[s.root, { backgroundColor: c.bg }]}>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 2 }}>
            <Text style={[s.menuTitle, { color: c.head, fontFamily: family }]} numberOfLines={2}>{book.title}</Text>

            <Text style={[s.kicker, { color: c.muted, marginTop: 16 }]}>İÇİNDEKİLER</Text>
            <Pressable onPress={() => closeAnd(() => jump(0))} style={s.menuRow} accessibilityRole="button">
              <Text style={{ color: c.text, flex: 1 }}>Kapak</Text>
            </Pressable>
            {chapterPages.map((ch, k) => (
              <Pressable key={ch.i} onPress={() => closeAnd(() => jump(ch.i))} style={s.menuRow} accessibilityRole="button">
                <Text style={{ color: c.text, flex: 1 }}>{k + 1}. {ch.title}</Text>
                <Text style={{ color: c.muted }}>{ch.i}</Text>
              </Pressable>
            ))}

            {marks.length > 0 && <Text style={[s.kicker, { color: c.muted, marginTop: 16 }]}>YER İMLERİ</Text>}
            {marks.map((m) => (
              <Pressable key={m} onPress={() => closeAnd(() => jump(Math.max(1, pageForPos(starts, m))))} style={s.menuRow} accessibilityRole="button">
                <Text style={{ color: c.accent }}>★ Sayfa {Math.max(1, pageForPos(starts, m))}</Text>
              </Pressable>
            ))}

            <Text style={[s.kicker, { color: c.muted, marginTop: 16 }]}>OKUMA</Text>
            <Pressable onPress={() => closeAnd(() => { setQuery(''); setSearchOpen(true); })} style={s.menuRow} accessibilityRole="button">
              <Text style={{ color: c.text }}>Kitapta ara</Text>
            </Pressable>
            <Pressable onPress={() => closeAnd(() => { setGotoText(''); setGoto(true); })} style={s.menuRow} accessibilityRole="button">
              <Text style={{ color: c.text }}>Sayfaya git</Text>
            </Pressable>
            <Pressable onPress={() => update({ mode: isDark ? 'day' : 'night' })} style={s.menuRow} accessibilityRole="button">
              <Text style={{ color: c.text }}>{isDark ? 'Gündüz modu' : 'Gece modu'}</Text>
            </Pressable>

            <Text style={[s.kicker, { color: c.muted, marginTop: 16 }]}>PAYLAŞ</Text>
            <Pressable
              onPress={() => Linking.openURL(book.url).catch(() => Alert.alert('Açılamadı'))}
              style={s.menuRow} accessibilityRole="link"
            >
              <Text style={{ color: c.text }}>YouTube'da aç</Text>
            </Pressable>
            <Pressable onPress={() => run('EPUB hazırlanıyor…', () => exportEpub(book))} disabled={!!busy} style={s.menuRow} accessibilityRole="button">
              <Text style={{ color: c.text }}>EPUB olarak dışa aktar</Text>
            </Pressable>
            <Pressable onPress={() => run('PDF hazırlanıyor…', () => exportPdf(book))} disabled={!!busy} style={s.menuRow} accessibilityRole="button">
              <Text style={{ color: c.text }}>PDF olarak dışa aktar</Text>
            </Pressable>
            {busy && <Text style={{ color: c.muted, paddingVertical: 8 }}>{busy}</Text>}

            <Pressable onPress={() => { setMenu(false); navigation.goBack(); }} style={[s.menuRow, { marginTop: 12 }]} accessibilityRole="button">
              <Text style={{ color: c.text }}>Kitabı kapat</Text>
            </Pressable>
            <Pressable onPress={() => setMenu(false)} style={s.menuRow} accessibilityRole="button">
              <Text style={{ color: c.accent, fontWeight: '700' }}>Okumaya dön</Text>
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal visible={searchOpen} animationType="slide" onRequestClose={() => setSearchOpen(false)}>
        <SafeAreaView style={[s.root, { backgroundColor: c.bg }]}>
          <View style={{ padding: 16, gap: 10, flex: 1 }}>
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              <TextInput
                value={query}
                onChangeText={setQuery}
                autoFocus
                placeholder="Kitapta ara"
                placeholderTextColor={c.muted}
                style={[s.searchInput, { color: c.text, borderColor: c.border, backgroundColor: c.card }]}
                accessibilityLabel="Kitapta ara"
              />
              <Pressable onPress={() => setSearchOpen(false)} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}>
                <Text style={{ color: c.accent, fontWeight: '700' }}>Kapat</Text>
              </Pressable>
            </View>
            <Text style={{ color: c.muted, fontSize: 13 }}>
              {query.trim().length < 2 ? 'En az 2 harf yaz. ı/i, ş/s gibi harf farkları önemsenmez.' : `${hits.length}${hits.length >= 100 ? '+' : ''} sonuç`}
            </Text>
            <ScrollView keyboardShouldPersistTaps="handled">
              {hits.map((h, k) => (
                <Pressable
                  key={k}
                  onPress={() => { setSearchOpen(false); setTimeout(() => jump(Math.max(1, pageForPos(starts, h.pos))), 120); }}
                  style={[s.hit, { borderColor: c.border }]}
                  accessibilityRole="button"
                >
                  <Text style={{ color: c.muted, fontSize: 12 }}>Bölüm {h.chapter + 1} · Sayfa {Math.max(1, pageForPos(starts, h.pos))}</Text>
                  <Text style={{ color: c.text, marginTop: 2 }}>{h.snippet}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>

      <Modal visible={goto} transparent animationType="fade" onRequestClose={() => setGoto(false)}>
        <View style={s.backdrop}>
          <View style={[s.dialog, { backgroundColor: c.card }]}>
            <Text style={{ color: c.text, fontWeight: '700' }}>Sayfaya git (1–{Math.max(1, total - 1)})</Text>
            <TextInput
              value={gotoText} onChangeText={setGotoText} keyboardType="number-pad" autoFocus
              style={[s.gotoInput, { color: c.text, borderColor: c.border }]}
            />
            <View style={{ flexDirection: 'row', gap: 16, justifyContent: 'flex-end' }}>
              <Pressable onPress={() => setGoto(false)} accessibilityRole="button"><Text style={{ color: c.muted }}>Vazgeç</Text></Pressable>
              <Pressable
                onPress={() => {
                  const num = parseInt(gotoText, 10);
                  if (!num || num < 1 || num > total - 1) return Alert.alert('Geçersiz sayfa');
                  setGoto(false);
                  jump(num);
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  progressTrack: { height: 3 },
  progressFill: { height: 3 },
  floating: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, paddingHorizontal: 16, paddingTop: 12 },
  pill: { height: 44, borderRadius: 22, borderWidth: 1, paddingHorizontal: 18, justifyContent: 'center' },
  pillText: { fontWeight: '600', fontSize: 14 },
  kicker: { fontSize: 11, letterSpacing: 1.6, fontWeight: '700' },
  head: { fontSize: 30, lineHeight: 35, fontWeight: '700', marginTop: 4 },
  coverKicker: { fontSize: 11, letterSpacing: 1.6, fontWeight: '700' },
  ytBtn: { marginTop: 10, minHeight: 48, borderRadius: 24, borderWidth: 1.5, paddingHorizontal: 26, justifyContent: 'center' },
  card: { marginHorizontal: 20, borderWidth: 1, borderRadius: 16, padding: 14, gap: 6 },
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  square: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  nav: { height: 44, paddingHorizontal: 4, justifyContent: 'center' },
  menuTitle: { fontSize: 26, lineHeight: 30 },
  menuRow: { flexDirection: 'row', minHeight: 48, alignItems: 'center' },
  searchInput: { flex: 1, height: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, fontSize: 16 },
  hit: { paddingVertical: 12, borderBottomWidth: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-start', paddingTop: 120, paddingHorizontal: 32 },
  dialog: { borderRadius: 14, padding: 20, gap: 12 },
  gotoInput: { borderWidth: 1, borderRadius: 10, padding: 10, fontSize: 18 },
});
