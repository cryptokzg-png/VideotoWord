import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import {
  ActivityIndicator, Alert, Image, Linking, Modal, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, ToastAndroid, useWindowDimensions, View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { addNote, deleteNote, getBook, getMarks, listNotes, setLastPos, setNoteFavorite, setPageCount, toggleMark, updateChapters, updateNoteText } from '../db/db';
import { autoTitle } from '../lib/titles';
import { RenameDialog } from '../components/RenameDialog';
import { highlightKey, paragraphRange, selectQuote, shareText, tapWord, tokenize, wordCount } from '../lib/notes';
import { COVER, pageForPos, pageStarts, pagesFromLines } from '../lib/layout';
import { foldChapters, searchBook, type SearchHit } from '../lib/search';
import { exportPdf, sharePageImage } from '../lib/shareBook';
import { describeBook } from '../lib/sizeLabel';
import type { Book, Note } from '../types';
import { FONT_FAMILIES, FONT_SCALES, useSettings } from '../settings';
import { useIsDark } from '../theme';
import { PageFlipper, type FlipHandle } from '../components/PageFlipper';
import { Measurer } from '../components/Measurer';
import * as Speech from 'expo-speech';

type Props = NativeStackScreenProps<RootStackParamList, 'Reader'>;

type SpeechSentence = { text: string; page: number; start: number; end: number };
function makeSpeechSentences(pages: string[]): SpeechSentence[] {
  const out: SpeechSentence[] = [];
  pages.forEach((pageText, page) => {
    if (page === 0) return;
    const sep = pageText.startsWith('# ') ? pageText.indexOf('\n\n') : -1;
    const body = sep >= 0 ? pageText.slice(sep + 2) : pageText;
    const re = /[^.!?…]+(?:[.!?…]+["'”’»)}]*)?|[.!?…]+/gu;
    for (const match of body.matchAll(re)) {
      const raw=match[0], leading=raw.length-raw.trimStart().length, trimmed=raw.trim();
      if(!trimmed) continue;
      const start=(match.index??0)+leading;
      if(trimmed.length<=360) out.push({text:trimmed,page,start,end:start+trimmed.length});
      else { let offset=0; while(offset<trimmed.length){let cut=Math.min(offset+300,trimmed.length);if(cut<trimmed.length){const space=trimmed.lastIndexOf(' ',cut);if(space>offset+160)cut=space;} const part=trimmed.slice(offset,cut).trim();if(part){const local=trimmed.indexOf(part,offset);out.push({text:part,page,start:start+local,end:start+local+part.length});}offset=cut;} }
    }
  });
  return out;
}

const NIGHT = { bg: '#0B1228', card: '#121B3A', border: '#2A3566', text: '#DDE3F5', head: '#FFFFFF', muted: '#9AA6C8', accent: '#D4AF37', onAccent: '#1B1204', mark: '#6B5A12' };
const DAY = { bg: '#F5F2EA', card: '#FFFFFF', border: '#E3DED5', text: '#141B34', head: '#141B34', muted: '#5F6578', accent: '#1E3A8A', onAccent: '#FFFFFF', mark: '#FFE58A' };
type Palette = typeof NIGHT;

const PAD_X = 28;
const PAD_TOP = 20;
const PAD_BOTTOM = 22;
const BASE_FONT = 19;

/** Short confirmation message (Android toast). */
function toast(msg: string) {
  if (Platform.OS === 'android') ToastAndroid.show(msg, ToastAndroid.SHORT);
}

function Heading({ chapter, title, c, family }: { chapter: number; title: string; c: Palette; family: string }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text allowFontScaling={false} style={[s.kicker, { color: c.accent }]}>BÖLÜM {chapter}</Text>
      <Text allowFontScaling={false} style={[s.head, { color: c.head, fontFamily: family }]}>{title}</Text>
    </View>
  );
}

type TextStyleSpec = { fontFamily: string; fontSize: number; lineHeight: number };

function TextPage({ text, chapter, c, width, height, spec, speechRange, selecting, sel, onWord }: {
  text: string; chapter: number; c: Palette; width: number; height: number; spec: TextStyleSpec;
  speechRange?: { start: number; end: number } | null;
  selecting?: boolean; sel?: { a: number; b: number } | null; onWord?: (i: number) => void;
}) {
  const isHeading = text.startsWith('# ');
  const sep = text.indexOf('\n\n');
  const title = isHeading ? text.slice(2, sep) : null;
  const body = isHeading ? text.slice(sep + 2) : text;
  const lo = sel ? Math.min(sel.a, sel.b) : -1;
  const hi = sel ? Math.max(sel.a, sel.b) : -1;
  return (
    <View style={{ width, height, paddingHorizontal: PAD_X, paddingTop: PAD_TOP, overflow: 'hidden' }}>
      {title !== null && <Heading chapter={chapter} title={title} c={c} family={spec.fontFamily} />}
      <Text
        allowFontScaling={false}
        textBreakStrategy="simple"
        android_hyphenationFrequency="none"
        style={{ color: c.text, ...spec }}
      >
        {tokenize(body).map((t, i) =>
          t.word ? (
            <Text
              key={i}
              onPress={() => onWord?.(t.index)}
              style={selecting && t.index >= lo && t.index <= hi ? { backgroundColor: c.mark } : undefined}
            >
              {t.text}
            </Text>
          ) : (
            t.text
          ),
        )}
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
  const [sheet, setSheet] = useState<null | 'menu' | 'chapters' | 'marks' | 'notes'>(null);
  const [goto, setGoto] = useState(false);
  const [gotoText, setGotoText] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(route.params.hl ?? '');
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [selecting, setSelecting] = useState(false);
  const [sel, setSel] = useState<{ a: number; b: number } | null>(null);
  const [noteDialog, setNoteDialog] = useState<null | { id?: number; quote: string; pos: number; text: string }>(null);
  const [notesTab, setNotesTab] = useState<'all' | 'fav'>('all');
  const [renaming, setRenaming] = useState<number | null>(null); // chapter index being renamed
  const [area, setArea] = useState({ w: 0, h: 0 });
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const flip = useRef<FlipHandle>(null);
  const shot = useRef<ComponentRef<typeof View>>(null);
  const posRef = useRef(0); // reading position (non-space chars); survives re-layout
  const startedFresh = useRef(true);
  const pageRef = useRef(page); pageRef.current = page;
  const speechToken = useRef(0), speechIndex = useRef(0);
  const [speechOpen,setSpeechOpen]=useState(false);
  const [speechStatus,setSpeechStatus]=useState<'idle'|'playing'|'paused'>('idle');
  const [speechAt,setSpeechAt]=useState(-1);
  const [sleepTimerMinutes,setSleepTimerMinutes]=useState<number | null>(null);
  const [sleepTimerEndsAt,setSleepTimerEndsAt]=useState<number | null>(null);
  const [dictionaryOpen,setDictionaryOpen]=useState(false);
  const [dictionaryWord,setDictionaryWord]=useState('');
  const [dictionaryResult,setDictionaryResult]=useState('');
  const [dictionaryLoading,setDictionaryLoading]=useState(false);

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
        posRef.current = route.params.pos ?? b.lastPos;
        startedFresh.current = posRef.current === 0 && route.params.pos === undefined;
      }
      setBook(b);
    });
    getMarks(route.params.id).then(setMarks);
    listNotes(route.params.id).then(setNotes);
  }, [route.params.id, route.params.pos]);

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
      setSelecting(false);
      setSel(null);
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
    const had = marks.some((m) => m >= starts[page] && m < end);
    await toggleMark(book.id, starts[page], end);
    setMarks(await getMarks(book.id));
    toast(had ? 'Yer imi kaldırıldı' : '★ Yer imi eklendi');
  };

  const foldedText = useMemo(() => (book && searchOpen ? foldChapters(book.chapters) : []), [book, searchOpen]);
  const hits: SearchHit[] = useMemo(
    () => (book && searchOpen ? searchBook(book.chapters, query, 100, foldedText) : []),
    [book, searchOpen, query, foldedText],
  );

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

  const bodyOfPage = (i: number) => {
    const t = pages[i] ?? '';
    return t.startsWith('# ') ? t.slice(t.indexOf('\n\n') + 2) : t;
  };

  const speechSentences = useMemo(() => makeSpeechSentences(pages), [pages]);
  const speakFrom = async (index: number) => {
    if(index<0||index>=speechSentences.length)return;
    const token=++speechToken.current; speechIndex.current=index; setSpeechAt(index); setSpeechStatus('playing');
    const sentence=speechSentences[index]; if(pageRef.current!==sentence.page)jump(sentence.page);
    try {
      if(token!==speechToken.current)return;
      Speech.stop(); // replace any currently playing sentence when the user skips or resumes
      Speech.speak(sentence.text,{language:'tr-TR',rate:settings.speechRate,onDone:()=>{if(token!==speechToken.current)return;const next=index+1;if(next<speechSentences.length)void speakFrom(next);else{setSpeechStatus('idle');setSpeechAt(-1);}},onError:(e)=>{if(token!==speechToken.current)return;setSpeechStatus('idle');Alert.alert('Sesli okuma durdu',e.message||'Metin okunamadı.');}});
    }catch(e:any){if(token!==speechToken.current)return;setSpeechStatus('idle');Alert.alert('Sesli okuma başlatılamadı',String(e?.message??e));}
  };
  const pauseSpeech=()=>{if(speechStatus!=='playing')return;speechToken.current+=1;Speech.stop();setSpeechStatus('paused');};
  const stopSpeech=()=>{speechToken.current+=1;Speech.stop();setSpeechStatus('idle');setSpeechAt(-1);};
  const skipSpeech=(delta:-1|1)=>{const base=speechAt>=0?speechAt:speechIndex.current;void speakFrom(Math.max(0,Math.min(speechSentences.length-1,base+delta)));};
  useEffect(()=>()=>{speechToken.current+=1;Speech.stop();},[]);

  useEffect(() => {
    if (!sleepTimerEndsAt) return;
    const timer = setTimeout(() => {
      stopSpeech();
      setSleepTimerEndsAt(null);
      setSleepTimerMinutes(null);
      toast('Uyku zamanlayıcısı: Sesli okuma durduruldu');
    }, Math.max(0, sleepTimerEndsAt - Date.now()));
    return () => clearTimeout(timer);
  }, [sleepTimerEndsAt]);

  const startSleepTimer = (minutes: number) => {
    setSleepTimerMinutes(minutes);
    setSleepTimerEndsAt(Date.now() + minutes * 60 * 1000);
    toast(`Sesli okuma ${minutes} dakika sonra duracak`);
  };
  const cancelSleepTimer = () => { setSleepTimerEndsAt(null); setSleepTimerMinutes(null); };

  const lookupWord = async (value = dictionaryWord) => {
    const word = value.trim().replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '');
    if (!word) { setDictionaryResult('Lütfen bir kelime yaz.'); return; }
    setDictionaryWord(word);
    setDictionaryOpen(true);
    setDictionaryLoading(true);
    setDictionaryResult('');
    try {
      // Use the Turkish Language Association dictionary first.
      let result = '';
      try {
        const tdkUrl = `https://sozluk.gov.tr/gts?ara=${encodeURIComponent(word)}`;
        const response = await fetch(tdkUrl, { headers: { Accept: 'application/json' } });
        if (response.ok) {
          const data = await response.json();
          const entries = Array.isArray(data) ? data : [];
          const lines: string[] = [];
          for (const entry of entries) {
            if (entry?.madde) lines.push(String(entry.madde));
            for (const item of entry?.anlamlarListe ?? []) {
              if (item?.anlam) lines.push(String(item.anlam));
              for (const example of item?.orneklerListe ?? []) {
                const sample = example?.ornek ?? example?.ornekMetni;
                if (sample) lines.push(`Örnek: ${String(sample).replace(/<[^>]*>/g, '')}`);
              }
            }
          }
          result = lines.filter(Boolean).join('\n\n').trim();
        }
      } catch { /* Fall back to Wiktionary if TDK is unavailable. */ }

      // Keep Wiktionary as a secondary source.
      if (!result) {
        const apiUrl = `https://tr.wiktionary.org/w/api.php?action=query&prop=extracts&explaintext=1&exsectionformat=plain&titles=${encodeURIComponent(word)}&format=json`;
        try {
          const response = await fetch(apiUrl, { headers: { Accept: 'application/json' } });
          if (response.ok) {
            const data = await response.json();
            const pagesData = data?.query?.pages ?? {};
            const pageData = Object.values(pagesData)[0] as { title?: string; extract?: string } | undefined;
            const extract = (pageData?.extract ?? '').trim();
            if (extract) result = `${pageData?.title ?? word}\n\n${extract}`;
          }
        } catch { /* Try REST endpoint below. */ }
      }
      if (!result) {
        const restUrl = `https://tr.wiktionary.org/api/rest_v1/page/summary/${encodeURIComponent(word)}`;
        try {
          const response = await fetch(restUrl, { headers: { Accept: 'application/json' } });
          if (response.ok) {
            const data = await response.json();
            result = [data?.title, data?.extract ?? data?.description].filter(Boolean).join('\n\n').trim();
          }
        } catch { /* Show the service fallback message below. */ }
      }
      setDictionaryResult(result ? result.slice(0, 1800) : 'Bu kelime için sözlük kaydı bulunamadı. Başka yazılış deneyebilir veya “Vikisözlük’te aç” seçeneğini kullanabilirsin.');
    } catch {
      setDictionaryResult('Sözlük servisine ulaşılamadı. İnternet bağlantını kontrol et veya “Vikisözlük’te aç” seçeneğini kullan.');
    } finally { setDictionaryLoading(false); }
  };

  const onWord = (i: number) => {
    setSelecting(true);
    setSel((cur) => tapWord(cur, i));
  };

  const pageWords = selecting ? wordCount(bodyOfPage(page)) : 0;
  const extend = (side: 'start' | 'end') =>
    setSel((cur) => {
      if (!cur) return cur;
      const lo = Math.min(cur.a, cur.b);
      const hi = Math.max(cur.a, cur.b);
      return side === 'start' ? { a: Math.max(0, lo - 1), b: hi } : { a: lo, b: Math.min(pageWords - 1, hi + 1) };
    });
  const selectParagraph = () => setSel((cur) => (cur ? paragraphRange(bodyOfPage(page), cur.a) : cur));

  const picked = sel && selecting ? selectQuote(bodyOfPage(page), sel.a, sel.b) : null;

  const saveQuote = async (favorite: boolean, text: string, dialog?: { id?: number; quote: string; pos: number }) => {
    if (!book) return;
    const d = dialog ?? (picked ? { quote: picked.quote, pos: (starts[page] ?? 0) + picked.offset } : null);
    if (!d) return;
    if (d.id !== undefined) await updateNoteText(d.id, text.trim());
    else await addNote({ bookId: book.id, pos: d.pos, quote: d.quote, note: text.trim(), favorite });
    setNotes(await listNotes(book.id));
    setSelecting(false);
    setSel(null);
    setNoteDialog(null);
    toast(d.id !== undefined ? 'Not güncellendi' : favorite ? '★ Favori sözlere eklendi' : 'Notlara eklendi');
  };

  const saveChapterTitle = async (index: number, title: string | null) => {
    if (!book) return;
    const chapters = book.chapters.map((ch, i) =>
      i !== index ? ch : title === null ? { title: autoTitle(ch.text), text: ch.text } : { title: title.trim(), text: ch.text, custom: true },
    );
    await updateChapters(book.id, chapters);
    setBook({ ...book, chapters });
    setRenaming(null);
    setSheet('chapters');
    toast(title === null ? 'Otomatik başlık geri geldi' : 'Başlık güncellendi');
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
  const titlesKey = book.chapters.map((ch) => ch.title).join('|'); // heading heights depend on the titles
  const layoutKey = `${contentW}-${contentH}-${spec.fontFamily}-${spec.fontSize}-${titlesKey}`;
  const pageNo = (pos: number) => Math.max(1, pageForPos(starts, pos));

  return (
    <View style={[s.root, { backgroundColor: c.bg }]}>
      <View style={[s.progressTrack, { backgroundColor: c.border, marginTop: insets.top }]}>
        <View style={[s.progressFill, { backgroundColor: c.accent, width: `${progress * 100}%` }]} />
      </View>

      <View style={s.floating}>
        {selecting ? (
          <>
            <Pressable
              onPress={() => extend('start')}
              disabled={!sel}
              style={[s.pill, s.grow, { backgroundColor: c.card, borderColor: c.border, opacity: sel ? 1 : 0.4 }]}
              accessibilityRole="button"
              accessibilityLabel="Başa bir kelime ekle"
            >
              <Text style={[s.pillText, { color: c.text }]}>◀ Başa</Text>
            </Pressable>
            <Pressable
              onPress={() => extend('end')}
              disabled={!sel}
              style={[s.pill, s.grow, { backgroundColor: c.card, borderColor: c.border, opacity: sel ? 1 : 0.4 }]}
              accessibilityRole="button"
              accessibilityLabel="Sona bir kelime ekle"
            >
              <Text style={[s.pillText, { color: c.text }]}>Sona ▶</Text>
            </Pressable>
            <Pressable
              onPress={selectParagraph}
              disabled={!sel}
              style={[s.pill, s.grow, { backgroundColor: c.card, borderColor: c.border, opacity: sel ? 1 : 0.4 }]}
              accessibilityRole="button"
              accessibilityLabel="Paragrafın tamamını seç"
            >
              <Text style={[s.pillText, { color: c.text }]}>¶ Paragraf</Text>
            </Pressable>
          </>
        ) : null}
        {selecting ? null : highlight ? (
          <Pressable onPress={() => setHighlight('')} style={[s.pill, s.chip, { backgroundColor: c.mark, borderColor: c.border }]} accessibilityRole="button" accessibilityLabel="Vurguyu temizle">
            <Text numberOfLines={1} style={[s.pillText, { color: isDark ? '#fff' : '#141B34' }]}>“{highlight}” ✕</Text>
          </Pressable>
        ) : <View style={{ flex: 1 }} />}
        {selecting ? null : <Pressable onPress={() => setLarge((v) => !v)} style={btn} accessibilityRole="button" accessibilityState={{ selected: large }}>
          <Text style={[s.pillText, { color: c.text }]}>{large ? 'Küçült' : 'Büyüt'}</Text>
        </Pressable>}
        {selecting ? null : (
          <Pressable onPress={() => setSpeechOpen(true)} style={btn} accessibilityRole="button" accessibilityLabel="Sesli okumayı aç">
            <Text style={[s.pillText, { color: c.text }]}>🔊 Dinle</Text>
          </Pressable>
        )}
        {selecting ? null : (
          <Pressable onPress={() => setSheet('menu')} style={btn} accessibilityRole="button">
            <Text style={[s.pillText, { color: c.text }]}>Menü</Text>
          </Pressable>
        )}
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
                <TextPage
                  text={pages[i]} chapter={chapterOf[i]} c={c} width={width} height={area.h} spec={spec}
                  speechRange={speechAt >= 0 && speechSentences[speechAt]?.page === i ? { start: speechSentences[speechAt].start, end: speechSentences[speechAt].end } : null}
                  selecting={selecting && i === page} sel={i === page ? sel : null} onWord={onWord}
                />
              )
            }
          />
        ) : (
          <View style={s.center}><ActivityIndicator color={c.accent} /></View>
        )}
      </View>

      <View style={[s.card, { backgroundColor: c.card, borderColor: c.border, marginBottom: Math.max(insets.bottom, 12) }]}>
        <View style={[s.cardRow, { justifyContent: 'flex-end' }]}>
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

      {selecting && (
        <View
          style={[s.selBar, { backgroundColor: c.card, borderColor: c.accent, bottom: Math.max(insets.bottom, 12) }]}
          accessibilityLiveRegion="polite"
        >
          <Text numberOfLines={2} style={{ color: picked ? c.text : c.muted, fontSize: 14, minHeight: 38 }}>
            {picked
              ? `“${picked.quote}”`
              : 'Bir kelimeye dokun. Sözü uzatmak için başka kelimelere dokun ya da yukarıdaki düğmeleri kullan.'}
          </Text>
          {picked && (
            <Text style={{ color: c.muted, fontSize: 12 }}>
              {picked.quote.split(/\s+/).length} kelime · uzatmak için başka kelimeye dokun, yeniden başlamak için seçili kelimeye dokun
            </Text>
          )}
          <View style={s.selActions}>
            <Pressable
              onPress={() => {
                if (!picked || picked.quote.trim().split(/\s+/).length !== 1) {
                  toast('Anlamını aramak için tek kelime seç');
                  return;
                }
                void lookupWord(picked.quote);
              }}
              disabled={!picked || picked.quote.trim().split(/\s+/).length !== 1}
              hitSlop={8}
              style={[s.selSearchButton, { backgroundColor: c.accent, opacity: picked && picked.quote.trim().split(/\s+/).length === 1 ? 1 : 0.45 }]}
              accessibilityRole="button"
              accessibilityLabel="Seçilen kelimenin anlamını bul"
            >
              <Text style={{ color: c.onAccent, fontWeight: '800', fontSize: 15 }}>⌕  Anlamını bul</Text>
            </Pressable>
            <View style={s.selSecondaryRow}>
              <Pressable
                onPress={() => saveQuote(true, '')}
                disabled={!picked}
                hitSlop={6}
                style={[s.selSecondaryButton, { borderColor: c.border, backgroundColor: c.bg, opacity: picked ? 1 : 0.45 }]}
                accessibilityRole="button"
              >
                <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: c.accent, fontWeight: '800' }}>★ Favori söz</Text>
              </Pressable>
              <Pressable
                onPress={() => picked && setNoteDialog({ quote: picked.quote, pos: (starts[page] ?? 0) + picked.offset, text: '' })}
                disabled={!picked}
                hitSlop={6}
                style={[s.selSecondaryButton, { borderColor: c.border, backgroundColor: c.bg, opacity: picked ? 1 : 0.45 }]}
                accessibilityRole="button"
              >
                <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: c.accent, fontWeight: '800' }}>✎ Notlara ekle</Text>
              </Pressable>
            </View>
            <Pressable
              onPress={() => { setSelecting(false); setSel(null); }}
              style={s.selCancelButton}
              accessibilityRole="button"
            >
              <Text style={{ color: c.muted, fontWeight: '700' }}>Vazgeç</Text>
            </Pressable>
          </View>
        </View>
      )}

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
        <Row
          label="Notlar ve sözler"
          hint="Seçtiğin sözler ve notların"
          right={notes.length ? String(notes.length) : undefined}
          onPress={() => closeAnd(() => setSheet('notes'))}
          c={c}
        />
        <Row label="Kelime sözlüğü" hint="Türkçe kelime anlamını çevrimiçi ara" onPress={() => closeAnd(() => { setDictionaryWord(''); setDictionaryResult(''); setDictionaryOpen(true); })} c={c} />
        <Row label="Söz seç ve not al" onPress={() => closeAnd(() => { setSel(null); setSelecting(true); })} c={c} />
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

      {/* Sesli okuma */}
      <Sheet visible={speechOpen} onClose={() => setSpeechOpen(false)} title="Türkçe sesli okuma" c={c}>
        <Text style={{color:c.muted,fontSize:13,paddingHorizontal:4,paddingBottom:8}}>{speechAt>=0?`Cümle ${speechAt+1} / ${speechSentences.length}`:'Kitap başından veya seçtiğin sayfadan okumaya başla'}</Text>
        <View style={{flexDirection:'row',flexWrap:'wrap',gap:8,paddingVertical:8}}>
          <Pressable onPress={()=>skipSpeech(-1)} disabled={!speechSentences.length} style={[s.pill,{backgroundColor:c.card,borderColor:c.border,opacity:speechSentences.length?1:0.4}]}><Text style={{color:c.text}}>‹ Cümle</Text></Pressable>
          <Pressable onPress={()=>speechStatus==='playing'?pauseSpeech():void speakFrom(speechAt>=0?speechAt:Math.max(0,speechSentences.findIndex(x=>x.page===page)))} disabled={!speechSentences.length} style={[s.pill,{backgroundColor:c.accent,borderColor:c.accent}]}><Text style={{color:c.onAccent,fontWeight:'800'}}>{speechStatus==='playing'?'Duraklat':speechStatus==='paused'?'Sürdür':'Başlat'}</Text></Pressable>
          <Pressable onPress={()=>skipSpeech(1)} disabled={!speechSentences.length} style={[s.pill,{backgroundColor:c.card,borderColor:c.border,opacity:speechSentences.length?1:0.4}]}><Text style={{color:c.text}}>Cümle ›</Text></Pressable>
          <Pressable onPress={stopSpeech} style={[s.pill,{backgroundColor:c.card,borderColor:c.border}]}><Text style={{color:c.text}}>Durdur</Text></Pressable>
        </View>
        <Text style={{color:c.muted,fontSize:12,paddingTop:12}}>Ses, telefonun varsayılan Türkçe metin okuma motorundan alınır.</Text>
        <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingVertical:8}}>
          <Text style={{color:c.text}}>Okuma hızı</Text><View style={{flexDirection:'row',alignItems:'center',gap:12}}>
            <Pressable onPress={()=>update({speechRate:Math.max(0.7,Math.round((settings.speechRate-0.1)*10)/10)})} style={s.square}><Text style={{color:c.text}}>−</Text></Pressable>
            <Text style={{color:c.accent,fontWeight:'800'}}>{settings.speechRate.toFixed(1)}×</Text>
            <Pressable onPress={()=>update({speechRate:Math.min(1.5,Math.round((settings.speechRate+0.1)*10)/10)})} style={s.square}><Text style={{color:c.text}}>+</Text></Pressable>
          </View>
        </View>
        <View style={{height:1,backgroundColor:c.border,marginVertical:10}} />
        <Text style={{color:c.text,fontWeight:'800',paddingBottom:6}}>Uyku zamanlayıcısı</Text>
        <Text style={{color:c.muted,fontSize:12,paddingBottom:8}}>{sleepTimerMinutes ? `Sesli okuma ${sleepTimerMinutes} dakika sonra duracak.` : 'Belirlediğin süre sonunda sesli okuma otomatik durur.'}</Text>
        <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>
          {[10,20,30,60].map((minutes) => <Pressable key={minutes} onPress={() => startSleepTimer(minutes)} style={[s.pill,{backgroundColor:sleepTimerMinutes===minutes?c.accent:c.card,borderColor:sleepTimerMinutes===minutes?c.accent:c.border}]}><Text style={{color:sleepTimerMinutes===minutes?c.onAccent:c.text,fontWeight:'700'}}>{minutes} dk</Text></Pressable>)}
          {sleepTimerMinutes !== null && <Pressable onPress={cancelSleepTimer} style={[s.pill,{backgroundColor:c.card,borderColor:c.border}]}><Text style={{color:c.text}}>İptal</Text></Pressable>}
        </View>
        <Text style={{color:c.muted,fontSize:12,paddingVertical:8}}>Android pil yönetimi nedeniyle uygulama uzun süre arka planda kalırsa zamanlayıcının çalışması telefona bağlı olabilir.</Text>
      </Sheet>

      {/* Bölümler */}
      <Sheet visible={sheet === 'chapters'} onClose={() => setSheet(null)} title="Bölümler" c={c}>
        <Row label="Kapak" right={currentChapter === 0 ? '●' : undefined} onPress={() => closeAnd(() => jump(0))} c={c} accent={currentChapter === 0} />
        {chapterPages.map((ch, k) => {
          const on = currentChapter === k + 1;
          const title = book.chapters[k]?.title ?? ch.title;
          const snippet = (book.chapters[k]?.text ?? '').replace(/\s+/g, ' ').slice(0, 70);
          return (
            <View key={ch.i} style={s.chapRow}>
              <Pressable onPress={() => closeAnd(() => jump(ch.i))} style={s.chapMain} accessibilityRole="button">
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={2} style={{ color: on ? c.accent : c.text, fontWeight: on ? '800' : '500', fontSize: 16 }}>{k + 1}. {title}</Text>
                  {!!snippet && <Text numberOfLines={1} style={{ color: c.muted, fontSize: 13, marginTop: 2 }}>{snippet}</Text>}
                </View>
                <Text style={{ color: c.muted, marginLeft: 10 }}>s. {ch.i}</Text>
              </Pressable>
              <Pressable
                onPress={() => closeAnd(() => setRenaming(k))}
                style={s.chapEdit}
                accessibilityRole="button"
                accessibilityLabel={`${k + 1}. bölümün başlığını değiştir`}
              >
                <Text style={{ color: c.muted, fontSize: 18 }}>✎</Text>
              </Pressable>
            </View>
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

      <RenameDialog
        visible={renaming !== null}
        label={renaming !== null ? `${renaming + 1}. bölüm` : ''}
        initial={renaming !== null ? book.chapters[renaming]?.title ?? '' : ''}
        c={c}
        onCancel={() => { setRenaming(null); setSheet('chapters'); }}
        onSave={(t) => renaming !== null && saveChapterTitle(renaming, t)}
        onReset={() => renaming !== null && saveChapterTitle(renaming, null)}
      />

      {/* Notlar ve sözler */}
      <Sheet visible={sheet === 'notes'} onClose={() => setSheet(null)} title="Notlar ve sözler" c={c}>
        <View style={s.tabs}>
          {([['all', `Notlarım (${notes.length})`], ['fav', `★ Favori sözler (${notes.filter((x) => x.favorite).length})`]] as const).map(([key, label]) => {
            const on = notesTab === key;
            return (
              <Pressable
                key={key}
                onPress={() => setNotesTab(key)}
                style={[s.tab, { backgroundColor: on ? c.accent : 'transparent', borderColor: on ? c.accent : c.border }]}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
              >
                <Text style={{ color: on ? c.onAccent : c.text, fontWeight: on ? '800' : '500', fontSize: 13 }}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
        {notes.filter((x) => notesTab === 'all' || x.favorite).length === 0 && (
          <Text style={{ color: c.muted, padding: 12 }}>
            {notesTab === 'fav' ? 'Henüz favori söz yok.' : 'Henüz not yok.'} Okurken ✎ düğmesine dokunup bir söz seç.
          </Text>
        )}
        {notes.filter((x) => notesTab === 'all' || x.favorite).map((n) => (
          <View key={n.id} style={[s.noteItem, { borderColor: c.border }]}>
            <View style={[s.noteBar, { backgroundColor: c.accent }]} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.text, fontSize: 15, lineHeight: 22 }}>“{n.quote}”</Text>
              {!!n.note && <Text style={{ color: c.muted, fontSize: 14, marginTop: 6 }}>✎ {n.note}</Text>}
              <Text style={{ color: c.muted, fontSize: 12, marginTop: 6 }}>Sayfa {pageNo(n.pos)}</Text>
              <View style={s.noteActions}>
                <Pressable onPress={() => closeAnd(() => { setHighlight(highlightKey(n.quote)); jump(pageNo(n.pos)); })} style={s.noteBtn} accessibilityRole="button">
                  <Text style={{ color: c.accent, fontWeight: '700', fontSize: 13 }}>Git</Text>
                </Pressable>
                <Pressable onPress={() => Share.share({ message: shareText(n.quote, book.title, n.note) }).catch(() => {})} style={s.noteBtn} accessibilityRole="button">
                  <Text style={{ color: c.text, fontWeight: '600', fontSize: 13 }}>Paylaş</Text>
                </Pressable>
                <Pressable
                  onPress={() => closeAnd(() => setNoteDialog({ id: n.id, quote: n.quote, pos: n.pos, text: n.note }))}
                  style={s.noteBtn}
                  accessibilityRole="button"
                >
                  <Text style={{ color: c.text, fontWeight: '600', fontSize: 13 }}>{n.note ? 'Düzenle' : 'Not ekle'}</Text>
                </Pressable>
                <Pressable
                  onPress={async () => { await setNoteFavorite(n.id, !n.favorite); setNotes(await listNotes(book.id)); }}
                  style={s.noteBtn}
                  accessibilityRole="button"
                  accessibilityState={{ selected: !!n.favorite }}
                >
                  <Text style={{ color: n.favorite ? c.accent : c.text, fontWeight: '700', fontSize: 15 }}>{n.favorite ? '★' : '☆'}</Text>
                </Pressable>
                <Pressable
                  onPress={() =>
                    Alert.alert('Notu sil', 'Bu söz ve notu silinsin mi?', [
                      { text: 'Vazgeç', style: 'cancel' },
                      { text: 'Sil', style: 'destructive', onPress: async () => { await deleteNote(n.id); setNotes(await listNotes(book.id)); } },
                    ])
                  }
                  style={s.noteBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Sil"
                >
                  <Text style={{ color: '#E5546B', fontWeight: '700', fontSize: 13 }}>Sil</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ))}
      </Sheet>

      {/* Not ekle / düzenle */}
      <Modal visible={!!noteDialog} transparent animationType="fade" onRequestClose={() => setNoteDialog(null)}>
        <View style={s.backdrop}>
          <View style={[s.dialog, { backgroundColor: c.card }]}>
            <Text style={{ color: c.text, fontWeight: '800' }}>{noteDialog?.id !== undefined ? 'Notu düzenle' : 'Notlara ekle'}</Text>
            <Text numberOfLines={4} style={{ color: c.muted, fontStyle: 'italic' }}>“{noteDialog?.quote}”</Text>
            <TextInput
              value={noteDialog?.text ?? ''}
              onChangeText={(t) => setNoteDialog((d) => (d ? { ...d, text: t } : d))}
              placeholder="Kendi notun (isteğe bağlı)"
              placeholderTextColor={c.muted}
              multiline
              autoFocus
              style={[s.gotoInput, { color: c.text, borderColor: c.border, minHeight: 80, textAlignVertical: 'top', fontSize: 16 }]}
              accessibilityLabel="Not"
            />
            <View style={{ flexDirection: 'row', gap: 16, justifyContent: 'flex-end' }}>
              <Pressable onPress={() => setNoteDialog(null)} accessibilityRole="button" style={s.noteBtn}>
                <Text style={{ color: c.muted }}>Vazgeç</Text>
              </Pressable>
              <Pressable
                onPress={() => noteDialog && saveQuote(false, noteDialog.text, noteDialog)}
                accessibilityRole="button"
                style={s.noteBtn}
              >
                <Text style={{ color: c.accent, fontWeight: '800' }}>Kaydet</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={dictionaryOpen} transparent animationType="fade" onRequestClose={() => setDictionaryOpen(false)}>
        <View style={s.backdrop}><View style={[s.dialog,{backgroundColor:c.card,maxHeight:'82%'}]}>
          <Text style={{color:c.head,fontWeight:'800',fontSize:18}}>Kelime sözlüğü</Text>
          <TextInput value={dictionaryWord} onChangeText={setDictionaryWord} placeholder="Türkçe kelime yaz" placeholderTextColor={c.muted} onSubmitEditing={() => { void lookupWord(); }} returnKeyType="search" style={[s.gotoInput,{color:c.text,borderColor:c.border,fontSize:16}]} />
          <Pressable onPress={() => { void lookupWord(); }} disabled={dictionaryLoading} style={[s.pill,{backgroundColor:c.accent,borderColor:c.accent,alignSelf:'flex-start',opacity:dictionaryLoading?0.6:1}]}><Text style={{color:c.onAccent,fontWeight:'800'}}>{dictionaryLoading?'Aranıyor…':'Anlamını bul'}</Text></Pressable>
          <ScrollView style={{maxHeight:300}}><Text selectable style={{color:c.text,fontSize:14,lineHeight:21}}>{dictionaryResult || 'Türkçe Vikisözlük üzerinden çevrimiçi aranır. İnternet bağlantısı gerekir.'}</Text></ScrollView>
          {!!dictionaryWord.trim() && <Pressable onPress={() => Linking.openURL('https://tr.wiktionary.org/wiki/'+encodeURIComponent(dictionaryWord.trim())).catch(()=>{})} style={s.noteBtn}><Text style={{color:c.accent,fontWeight:'700'}}>Vikisözlük'te aç</Text></Pressable>}
          <Pressable onPress={() => setDictionaryOpen(false)} style={s.noteBtn}><Text style={{color:c.muted,fontWeight:'700'}}>Kapat</Text></Pressable>
        </View></View>
      </Modal>

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
  grow: { flex: 1, paddingHorizontal: 8, alignItems: 'center' },
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
  chapRow: { flexDirection: 'row', alignItems: 'center' },
  chapMain: { flex: 1, flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingVertical: 8, paddingHorizontal: 4 },
  chapEdit: { width: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  selBar: { position: 'absolute', left: 20, right: 20, borderWidth: 1.5, borderRadius: 16, padding: 12, gap: 8 },
  selActions: { flexDirection: 'column', width: '100%', gap: 8 },
  selSearchButton: { width: '100%', minHeight: 50, borderRadius: 13, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  selSecondaryRow: { width: '100%', flexDirection: 'row', gap: 8 },
  selSecondaryButton: { flex: 1, minWidth: 0, minHeight: 48, paddingHorizontal: 8, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  selCancelButton: { width: '100%', minHeight: 38, alignItems: 'center', justifyContent: 'center' },
  selBtn: { minHeight: 44, paddingHorizontal: 12, borderRadius: 12, justifyContent: 'center' },
  selPrimary: { paddingHorizontal: 16 },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  tab: { minHeight: 40, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, justifyContent: 'center' },
  noteItem: { flexDirection: 'row', gap: 12, paddingVertical: 12, borderBottomWidth: 1 },
  noteBar: { width: 4, borderRadius: 2 },
  noteActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 2, marginTop: 4 },
  noteBtn: { minHeight: 44, minWidth: 44, paddingHorizontal: 10, justifyContent: 'center', alignItems: 'center' },
  searchInput: { flex: 1, height: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, fontSize: 16 },
  hit: { paddingVertical: 12, borderBottomWidth: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-start', paddingTop: 120, paddingHorizontal: 32 },
  dialog: { borderRadius: 14, padding: 20, gap: 12 },
  gotoInput: { borderWidth: 1, borderRadius: 10, padding: 10, fontSize: 18 },
});

// Final reader UI: summary panel intentionally removed for a cleaner reading layout.





