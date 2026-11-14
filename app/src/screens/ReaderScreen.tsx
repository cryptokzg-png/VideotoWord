import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import {
  ActivityIndicator, Alert, Image, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { getBook, getMarks, setLastPos, setPageCount, toggleMark } from '../db/db';
import { COVER, pageForPos, pageStarts, pagesFromLines } from '../lib/layout';
import { searchBook, splitByMatch, type SearchHit } from '../lib/search';
import { exportPdf, sharePageImage } from '../lib/shareBook';
import { describeBook } from '../lib/sizeLabel';
import type { Book } from '../types';
import { FONT_FAMILIES, FONT_SCALES, useSettings } from '../settings';
import { useIsDark } from '../theme';
import { PageFlipper, type FlipHandle } from '../components/PageFlipper';
import { Measurer } from '../components/Measurer';

type Props = NativeStackScreenProps<RootStackParamList, 'Reader'>;

const NIGHT = { bg: '#0B1228', card: '#121B3A', border: '#2A3566', text: '#DDE3F5', head: '#FFFFFF', muted: '#9AA6C8', accent: '#D4AF37', onAccent: '#1B1204', mark: '#6B5A12' };
const DAY = { bg: '#F5F2EA', card: '#FFFFFF', border: '#E3DED5', text: '#141B34', head: '#141B34', muted: '#5F6578', accent: '#1E3A8A', onAccent: '#FFFFFF', mark: '#FFE58A' };
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

function TextPage({ text, chapter, c, width, height, spec, highlight }: {
  text: string; chapter: number; c: Palette; width: number; height: number; spec: TextStyleSpec; highlight: string;
}) {
  const isHeading = text.startsWith('# ');
  const sep = text.indexOf('\n\n');
  const title = isHeading ? text.slice(2, sep) : null;
  const body = isHeading ? text.slice(sep + 2) : text;
  // highlighting only changes the background, so it never changes the line breaks
  const pieces = highlight ? splitByMatch(body, highlight) : null;
  return (
    <View style={{ width, height, paddingHorizontal: PAD_X, paddingTop: PAD_TOP, overflow: 'hidden' }}>
      {title !== null && <Heading chapter={chapter} title={title} c={c} family={spec.fontFamily} />}
      <Text
        allowFontScaling={false}
        textBreakStrategy="simple"
        android_hyphenationFrequency="none"
        style={{ color: c.text, ...spec }}
      >
        {pieces
          ? pieces.map((p, i) => (p.hit ? <Text key={i} style={{ backgroundColor: c.mark }}>{p.text}</Text> : p.text))
          : body}
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

/** Bottom sheet ("açılır pencere"). */
function Sheet({ visible, onClose, title, c, children }: {
  visible: boolean; onClose: () => void; title: string; c: Palette; children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.sheetRoot}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Kapat" accessibilityRole="button">
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.55)' }]} />
        </Pressable>
        <View style={[s.sheet, { backgroundColor: c.card, borderColor: c.border, paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={[s.handle, { backgroundColor: c.border }]} />
          <View style={s.sheetHead}>
            <Text style={{ color: c.head, fontWeight: '800', fontSize: 18, flex: 1 }}>{title}</Text>
            <Pressable onPress={onClose} accessibilityRole="button" style={s.sheetClose}>
              <Text style={{ color: c.accent, fontWeight: '700' }}>Kapat</Text>
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">{children}</ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function Row({ label, hint, right, onPress, c, accent, bold, disabled }: {
  label: string; hint?: string; right?: string; onPress: () => void; c: Palette; accent?: boolean; bold?: boolean; disabled?: boolean;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[s.row, { opacity: disabled ? 0.5 : 1 }]} accessibilityRole="button">
      <View style={{ flex: 1 }}>
        <Text style={{ color: accent ? c.accent : c.text, fontWeight: bold ? '800' : '500', fontSize: 16 }}>{label}</Text>
        {!!hint && <Text numberOfLines={1} style={{ color: c.muted, fontSize: 13, marginTop: 2 }}>{hint}</Text>}
      </View>
      {!!right && <Text style={{ color: c.muted, marginLeft: 12 }}>{right}</Text>}
    </Pressable>
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
  const [sheet, setSheet] = useState<null | 'menu' | 'chapters' | 'marks'>(null);
  const [goto, setGoto] = useState(false);
  const [gotoText, setGotoText] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [area, setArea] = useState({ w: 0, h: 0 });
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const flip = useRef<FlipHandle>(null);
  const shot = useRef<ComponentRef<typeof View>>(null);
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
      setPages(pagesFromLines(book.chapters, lines, heads, spec.lineHeight, contentH));
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
      onIndexChange(Math.max(0, Math.min(pages.length - 1, i)));
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
      Alert.alert('Paylaşılamadı', String(e?.message ?? e));
    } finally {
      setBusy(null);
    }
  };

  const closeAnd = (fn: () => void) => {
    setSheet(null);
    setTimeout(fn, 250);
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
  const currentChapter = page === 0 ? 0 : chapterOf[page] ?? 0;

  const progress = pages.length ? Math.min(1, (starts[page] ?? 0) / Math.max(1, book.totalChars)) : 0;
  const btn = [s.pill, { backgroundColor: c.card, borderColor: c.border }];
  const ready = pages.length > 0 && area.h > 0;
  const layoutKey = `${contentW}-${contentH}-${spec.fontFamily}-${spec.fontSize}`;
  const pageNo = (pos: number) => Math.max(1, pageForPos(starts, pos));

  return (
    <View style={[s.root, { backgroundColor: c.bg }]}>
      <View style={[s.progressTrack, { backgroundColor: c.border, marginTop: insets.top }]}>
        <View style={[s.progressFill, { backgroundColor: c.accent, width: `${progress * 100}%` }]} />
      </View>

      <View style={s.floating}>
        {highlight ? (
          <Pressable onPress={() => setHighlight('')} style={[s.pill, s.chip, { backgroundColor: c.mark, borderColor: c.border }]} accessibilityRole="button" accessibilityLabel="Vurguyu temizle">
            <Text numberOfLines={1} style={[s.pillText, { color: isDark ? '#fff' : '#141B34' }]}>“{highlight}” ✕</Text>
          </Pressable>
        ) : <View style={{ flex: 1 }} />}
        <Pressable onPress={() => setLarge((v) => !v)} style={btn} accessibilityRole="button" accessibilityState={{ selected: large }}>
          <Text style={[s.pillText, { color: c.text }]}>{large ? 'Küçült' : 'Büyüt'}</Text>
        </Pressable>
        <Pressable onPress={() => setSheet('menu')} style={btn} accessibilityRole="button">
          <Text style={[s.pillText, { color: c.text }]}>Menü</Text>
        </Pressable>
      </View>

      <View
        ref={shot}
        collapsable={false}
        style={{ flex: 1, backgroundColor: c.bg }}
        onLayout={(e) => setArea({ w: e.nativeEvent.layout.width, h: Math.round(e.nativeEvent.layout.height) })}
      >
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
                <TextPage text={pages[i]} chapter={chapterOf[i]} c={c} width={width} height={area.h} spec={spec} highlight={highlight} />
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
          <Pressable onPress={() => { setGotoText(''); setGoto(true); }} accessibilityRole="button" accessibilityLabel="Sayfaya git" style={s.nav}>
            <Text style={{ color: c.text, fontWeight: '600' }}>{page === 0 ? 'Kapak' : `${page} / ${total - 1}`}</Text>
          </Pressable>
          <Pressable onPress={() => flip.current?.next()} disabled={page >= total - 1} style={[s.nav, { opacity: page >= total - 1 ? 0.4 : 1 }]} accessibilityRole="button">
            <Text style={{ color: c.accent, fontWeight: '700' }}>Sonraki ›</Text>
          </Pressable>
        </View>
      </View>

      {/* Menü */}
      <Sheet visible={sheet === 'menu'} onClose={() => setSheet(null)} title={book.title} c={c}>
        <Row
          label="Bölümler"
          hint={currentChapter ? `Şu an: Bölüm ${currentChapter}` : 'Kapak'}
          right="›"
          onPress={() => closeAnd(() => setSheet('chapters'))}
          c={c}
        />
        <Row label="Yer imleri" right={marks.length ? String(marks.length) : undefined} onPress={() => closeAnd(() => setSheet('marks'))} c={c} />
        <Row label="Kitapta ara" onPress={() => closeAnd(() => { setQuery(''); setSearchOpen(true); })} c={c} />
        <Row label="Sayfaya git" onPress={() => closeAnd(() => { setGotoText(''); setGoto(true); })} c={c} />
        <Row label={isDark ? 'Gündüz modu' : 'Gece modu'} onPress={() => update({ mode: isDark ? 'day' : 'night' })} c={c} />
        <View style={[s.sep, { backgroundColor: c.border }]} />
        <Row
          label="Bu sayfayı görüntü olarak paylaş"
          disabled={page === 0 || !!busy}
          onPress={() => closeAnd(() => run('Görüntü hazırlanıyor…', () => sharePageImage(shot)))}
          c={c}
        />
        <Row label="PDF olarak dışa aktar" disabled={!!busy} onPress={() => run('PDF hazırlanıyor…', () => exportPdf(book))} c={c} />
        <Row label="YouTube'da aç" onPress={() => Linking.openURL(book.url).catch(() => Alert.alert('Açılamadı'))} c={c} />
        {busy && <Text style={{ color: c.muted, paddingVertical: 8, paddingHorizontal: 4 }}>{busy}</Text>}
        <View style={[s.sep, { backgroundColor: c.border }]} />
        <Row label="Kitabı kapat" onPress={() => { setSheet(null); navigation.goBack(); }} c={c} />
      </Sheet>

      {/* Bölümler */}
      <Sheet visible={sheet === 'chapters'} onClose={() => setSheet(null)} title="Bölümler" c={c}>
        <Row label="Kapak" right={currentChapter === 0 ? '●' : undefined} onPress={() => closeAnd(() => jump(0))} c={c} accent={currentChapter === 0} />
        {chapterPages.map((ch, k) => {
          const on = currentChapter === k + 1;
          const snippet = (book.chapters[k]?.text ?? '').replace(/\s+/g, ' ').slice(0, 70);
          return (
            <Row
              key={ch.i}
              label={`${k + 1}. ${ch.title}`}
              hint={snippet}
              right={`s. ${ch.i}`}
              accent={on}
              bold={on}
              onPress={() => closeAnd(() => jump(ch.i))}
              c={c}
            />
          );
        })}
      </Sheet>

      {/* Yer imleri */}
      <Sheet visible={sheet === 'marks'} onClose={() => setSheet(null)} title="Yer imleri" c={c}>
        {marks.length === 0 && (
          <Text style={{ color: c.muted, padding: 12 }}>Henüz yer imi yok. Okurken ☆ düğmesine dokun.</Text>
        )}
        {marks.map((m) => (
          <Row key={m} label={`★ Sayfa ${pageNo(m)}`} accent onPress={() => closeAnd(() => jump(pageNo(m)))} c={c} />
        ))}
      </Sheet>

      {/* Kitapta ara */}
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
              {query.trim().length < 2 ? 'En az 2 harf yaz. ı/i, ş/s gibi harf farkları önemsenmez.' : `${hits.length}${hits.length >= 100 ? '+' : ''} sonuç · bulunan sayfada kelime vurgulanır`}
            </Text>
            <ScrollView keyboardShouldPersistTaps="handled">
              {hits.map((h, k) => (
                <Pressable
                  key={k}
                  onPress={() => {
                    const q = query.trim();
                    setSearchOpen(false);
                    setTimeout(() => { setHighlight(q); jump(pageNo(h.pos)); }, 250);
                  }}
                  style={[s.hit, { borderColor: c.border }]}
                  accessibilityRole="button"
                >
                  <Text style={{ color: c.muted, fontSize: 12 }}>Bölüm {h.chapter + 1} · Sayfa {pageNo(h.pos)}</Text>
                  <Text style={{ color: c.text, marginTop: 2 }}>{h.snippet}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Sayfaya git */}
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
  floating: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 12 },
  pill: { height: 44, borderRadius: 22, borderWidth: 1, paddingHorizontal: 18, justifyContent: 'center' },
  chip: { flex: 1, maxWidth: 190 },
  pillText: { fontWeight: '600', fontSize: 14 },
  kicker: { fontSize: 11, letterSpacing: 1.6, fontWeight: '700' },
  head: { fontSize: 30, lineHeight: 35, fontWeight: '700', marginTop: 4 },
  coverKicker: { fontSize: 11, letterSpacing: 1.6, fontWeight: '700' },
  ytBtn: { marginTop: 10, minHeight: 48, borderRadius: 24, borderWidth: 1.5, paddingHorizontal: 26, justifyContent: 'center' },
  card: { marginHorizontal: 20, borderWidth: 1, borderRadius: 16, padding: 14, gap: 6 },
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  square: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  nav: { height: 44, paddingHorizontal: 4, justifyContent: 'center' },
  sheetRoot: { flex: 1, justifyContent: 'flex-end' },
  sheet: { maxHeight: '78%', borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderBottomWidth: 0, paddingHorizontal: 16, paddingTop: 8 },
  handle: { width: 44, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 6 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', minHeight: 48 },
  sheetClose: { minHeight: 44, minWidth: 56, alignItems: 'flex-end', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingVertical: 8, paddingHorizontal: 4 },
  sep: { height: 1, marginVertical: 6 },
  searchInput: { flex: 1, height: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, fontSize: 16 },
  hit: { paddingVertical: 12, borderBottomWidth: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-start', paddingTop: 120, paddingHorizontal: 32 },
  dialog: { borderRadius: 14, padding: 20, gap: 12 },
  gotoInput: { borderWidth: 1, borderRadius: 10, padding: 10, fontSize: 18 },
});
