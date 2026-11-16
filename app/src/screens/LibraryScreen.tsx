import { useCallback, useEffect, useRef, useState, type ComponentRef } from 'react';
import { Alert, Image, Platform, Pressable, Share, ToastAndroid, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { deleteBook, listBooks, listBookTexts, listFavoriteQuotes, saveBook, setFavorite, setNoteFavorite } from '../db/db';
import type { BookRow, Note } from '../types';
import { highlightKey, shareText } from '../lib/notes';
import { BookCard, ContinueCard } from '../components/BookCard';
import { parseVideoId } from '../lib/youtube';
import { fold, splitByMatch } from '../lib/search';
import { searchAllAsync, type BookHits, type BookText } from '../lib/searchAll';
import { buildBook } from '../lib/buildBook';
import { sampleVideo } from '../lib/sample';
import { serif, useTheme } from '../theme';
import { progressOf } from '../db/db';

type Props = NativeStackScreenProps<RootStackParamList, 'Library'>;

/** Snippet with the matched word marked. */
function Snippet({ text, query, color, mark }: { text: string; query: string; color: string; mark: string }) {
  return (
    <Text style={{ color, fontSize: 15, lineHeight: 22 }}>
      {splitByMatch(text, query).map((p, i) =>
        p.hit ? <Text key={i} style={{ backgroundColor: mark, fontWeight: '700' }}>{p.text}</Text> : p.text,
      )}
    </Text>
  );
}

export default function LibraryScreen({ navigation }: Props) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [books, setBooks] = useState<BookRow[]>([]);
  const [link, setLink] = useState('');
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'fav' | 'quotes'>('all');
  const [quotes, setQuotes] = useState<Note[]>([]);
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const searchInput = useRef<ComponentRef<typeof TextInput>>(null);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const textsCache = useRef<BookText[] | null>(null); // full text of every book, loaded on first search
  const [groups, setGroups] = useState<BookHits[]>([]);
  const [searchedFor, setSearchedFor] = useState(''); // the query the shown results belong to
  const [tookMs, setTookMs] = useState(0);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [clip, setClip] = useState<string | null>(null); // video id found on the clipboard
  const dismissed = useRef<Set<string>>(new Set());

  const load = useCallback(() => {
    textsCache.current = null; // books may have changed
    listFavoriteQuotes().then(setQuotes).catch(() => {});
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

  const toggleFav = async (b: BookRow) => {
    await setFavorite(b.id, !b.favorite);
    if (Platform.OS === 'android') ToastAndroid.show(b.favorite ? 'Favorilerden çıkarıldı' : '★ Favorilere eklendi', ToastAndroid.SHORT);
    load();
  };

  const query = fold(q.trim());
  const filtered = books.filter(
    (b) => (filter === 'all' || b.favorite) && (!query || fold(`${b.title} ${b.author}`).includes(query)),
  );
  const favCount = books.filter((b) => b.favorite).length;
  const flat = filter === 'fav' || !!query; // searching or viewing favorites: one simple list
  const shownQuotes = quotes.filter((n) => !query || fold(`${n.quote} ${n.bookTitle ?? ''}`).includes(query));

  const contentQuery = filter !== 'quotes' && query.length >= 2;

  // search the text of every book (debounced; texts are loaded once and cached, work is chunked)
  useEffect(() => {
    if (!contentQuery) {
      setGroups([]);
      setSearchedFor('');
      return;
    }
    const term = q.trim();
    let cancelled = false;
    const timer = setTimeout(async () => {
      const started = Date.now();
      let result: BookHits[] | null = [];
      try {
        const data = textsCache.current ?? (await listBookTexts());
        textsCache.current = data;
        if (cancelled) return;
        const allowed = new Set(books.filter((b) => filter === 'all' || b.favorite).map((b) => b.id));
        result = await searchAllAsync(data.filter((b) => allowed.has(b.id)), term, () => cancelled);
      } catch {
        result = []; // never leave the screen waiting
      }
      if (cancelled || result === null) return;
      setGroups(result);
      setTookMs(Date.now() - started);
      setSearchedFor(term);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q, filter, books, contentQuery]);

  // results are for an older query (or still being computed)
  const searching = contentQuery && searchedFor !== q.trim();

  const totalHits = groups.reduce((a, g) => a + g.hits.length, 0);

  // most recently opened-but-unfinished book, else none
  const reading = books.find((b) => progressOf(b) > 0 && progressOf(b) < 0.97);
  const favorites = books.filter((b) => b.favorite && b !== reading);
  const others = books.filter((b) => !b.favorite && b !== reading);

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

      <ScrollView ref={scroll} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
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

        {books.length > 0 && (
          <>
            <TextInput
              ref={searchInput}
              value={q}
              onChangeText={setQ}
              placeholder="Kitap adı veya kitapların içinde ara"
              placeholderTextColor={t.muted}
              style={[s.search, { backgroundColor: t.surface, borderColor: t.border, color: t.text }]}
              accessibilityLabel="Kitap adı veya kitapların içinde ara"
              returnKeyType="search"
            />
            <View style={s.chips}>
              {([['all', `Tümü (${books.length})`], ['fav', `★ Favoriler (${favCount})`], ['quotes', `❝ Sözler (${quotes.length})`]] as const).map(([key, label]) => {
                const on = filter === key;
                return (
                  <Pressable
                    key={key}
                    onPress={() => setFilter(key)}
                    style={[s.chip, { backgroundColor: on ? t.accent : 'transparent', borderColor: on ? t.accent : t.border }]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                  >
                    <Text style={{ color: on ? '#142041' : t.text, fontWeight: on ? '800' : '500' }}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        {filter === 'quotes' ? (
          <>
            {shownQuotes.map((n) => (
              <View key={n.id} style={[s.quoteCard, { backgroundColor: t.surface, borderColor: t.border }]}>
                <View style={[s.quoteBar, { backgroundColor: t.accent }]} />
                <View style={{ flex: 1 }}>
                  <Pressable
                    onPress={() => navigation.navigate('Reader', { id: n.bookId, pos: n.pos, hl: highlightKey(n.quote) })}
                    accessibilityRole="button"
                    accessibilityLabel={`Sözü kitapta aç: ${n.quote}`}
                  >
                    <Text style={{ color: t.text, fontFamily: serif, fontSize: 17, lineHeight: 25 }}>“{n.quote}”</Text>
                    {!!n.note && <Text style={{ color: t.muted, marginTop: 6 }}>✎ {n.note}</Text>}
                    <Text style={{ color: t.primary, fontSize: 12, fontWeight: '700', marginTop: 8 }} numberOfLines={1}>{n.bookTitle}</Text>
                  </Pressable>
                  <View style={s.quoteActions}>
                    <Pressable
                      onPress={() => navigation.navigate('Reader', { id: n.bookId, pos: n.pos, hl: highlightKey(n.quote) })}
                      style={s.quoteBtn}
                      accessibilityRole="button"
                    >
                      <Text style={{ color: t.primary, fontWeight: '700' }}>Kitapta aç</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => Share.share({ message: shareText(n.quote, n.bookTitle ?? '', n.note) }).catch(() => {})}
                      style={s.quoteBtn}
                      accessibilityRole="button"
                    >
                      <Text style={{ color: t.text, fontWeight: '600' }}>Paylaş</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => Alert.alert(
                        'Favorilerden çıkarılsın mı?',
                        'Bu söz ve kişisel notun silinmeyecek; yalnızca favori listesinden çıkarılacak.',
                        [
                          { text: 'Vazgeç', style: 'cancel' },
                          { text: 'Evet, çıkar', style: 'destructive', onPress: async () => { await setNoteFavorite(n.id, false); load(); } },
                        ],
                      )}
                      style={s.quoteBtn}
                      accessibilityRole="button"
                      accessibilityLabel="Favorilerden çıkar"
                    >
                      <Text style={{ color: t.text, fontWeight: '600', fontSize: 13 }}>Favorilerden çıkar</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            ))}
            {shownQuotes.length === 0 && (
              <Text style={{ color: t.muted, textAlign: 'center', marginTop: 24 }}>
                {quotes.length === 0
                  ? 'Henüz favori söz yok. Okurken ✎ düğmesiyle bir söz seçip "★ Favori söz"e dokun.'
                  : 'Sonuç bulunamadı.'}
              </Text>
            )}
          </>
        ) : flat ? (
          <>
            {filtered.map((b) => (
              <BookCard
                key={b.id}
                book={b}
                onPress={() => navigation.navigate('BookDetail', { id: b.id })}
                onLongPress={() => confirmDelete(b)}
                onToggleFavorite={() => toggleFav(b)}
                onSummary={() => openBookSummary(b)}
              />
            ))}
            {contentQuery && (
              <>
                {searching ? (
                  <Text style={{ color: t.muted, marginTop: 12 }}>Kitapların içinde aranıyor…</Text>
                ) : (
                  groups.length > 0 && (
                    <Text style={[s.label, { color: t.muted, marginTop: 14 }]}>
                      KİTAP İÇİNDE · {groups.length} KİTAPTA {totalHits}{groups.some((g) => g.capped) ? '+' : ''} SONUÇ · {(tookMs / 1000).toFixed(1)} SN
                    </Text>
                  )
                )}
                {!searching && groups.map((g) => {
                  const open = expanded.has(g.bookId);
                  const shown = open ? g.hits : g.hits.slice(0, 3);
                  return (
                    <View key={g.bookId} style={[s.hitCard, { backgroundColor: t.surface, borderColor: t.border }]}>
                      <View style={s.hitHead}>
                        <Text style={{ color: t.text, fontFamily: serif, fontWeight: '700', fontSize: 16, flex: 1 }} numberOfLines={1}>{g.title}</Text>
                        <Text style={{ color: t.primary, fontWeight: '700', fontSize: 12 }}>{g.hits.length}{g.capped ? '+' : ''} sonuç</Text>
                      </View>
                      {shown.map((h, k) => (
                        <Pressable
                          key={k}
                          onPress={() => navigation.navigate('Reader', { id: g.bookId, pos: h.pos, hl: q.trim() })}
                          style={[s.hitRow, { borderColor: t.border }]}
                          accessibilityRole="button"
                          accessibilityLabel={`${g.title}, bölüm ${h.chapter + 1}: ${h.snippet}`}
                        >
                          <Text style={{ color: t.muted, fontSize: 12, marginBottom: 2 }}>Bölüm {h.chapter + 1}</Text>
                          <Snippet text={h.snippet} query={q.trim()} color={t.text} mark={t.accent + '66'} />
                        </Pressable>
                      ))}
                      {g.hits.length > 3 && (
                        <Pressable
                          onPress={() =>
                            setExpanded((cur) => {
                              const next = new Set(cur);
                              if (next.has(g.bookId)) next.delete(g.bookId);
                              else next.add(g.bookId);
                              return next;
                            })
                          }
                          style={s.hitMore}
                          accessibilityRole="button"
                        >
                          <Text style={{ color: t.primary, fontWeight: '700' }}>{open ? 'Daha az göster' : `+${g.hits.length - 3} sonuç daha`}</Text>
                        </Pressable>
                      )}
                    </View>
                  );
                })}
              </>
            )}
            {filtered.length === 0 && !(contentQuery && (searching || groups.length > 0)) && (
              <Text style={{ color: t.muted, textAlign: 'center', marginTop: 24 }}>
                {filter === 'fav' && !query ? 'Henüz favori kitap yok. Kitaplardaki ☆ işaretine dokun.' : 'Sonuç bulunamadı.'}
              </Text>
            )}
          </>
        ) : (
          <>
            {reading && (
              <>
                <Text style={[s.label, { color: t.muted }]}>OKUMAYA DEVAM ET</Text>
                <ContinueCard
                  book={reading}
                  onPress={() => navigation.navigate('Reader', { id: reading.id })}
                  onLongPress={() => confirmDelete(reading)}
                  onToggleFavorite={() => toggleFav(reading)}
                  onSummary={() => openBookSummary(reading)}
                />
              </>
            )}
            {favorites.length > 0 && (
              <>
                <Text style={[s.label, { color: t.muted }]}>FAVORİLER</Text>
                {favorites.map((b) => (
                  <BookCard
                    key={b.id}
                    book={b}
                    onPress={() => navigation.navigate('BookDetail', { id: b.id })}
                    onLongPress={() => confirmDelete(b)}
                    onToggleFavorite={() => toggleFav(b)}
                  />
                ))}
              </>
            )}
            {others.length > 0 && (
              <>
                <Text style={[s.label, { color: t.muted }]}>{reading || favorites.length ? 'DİĞER KİTAPLAR' : 'KİTAPLARIM'}</Text>
                {others.map((b) => (
                  <BookCard
                    key={b.id}
                    book={b}
                    onPress={() => navigation.navigate('BookDetail', { id: b.id })}
                    onLongPress={() => confirmDelete(b)}
                    onToggleFavorite={() => toggleFav(b)}
                  />
                ))}
              </>
            )}
          </>
        )}

        {books.length > 0 && (
          <Text style={{ color: t.muted, fontSize: 12, textAlign: 'center', marginTop: 8 }}>
            Silmek için bir kitaba uzun bas ya da kitabı açıp "Kitabı sil"e dokun.
          </Text>
        )}
      </ScrollView>

      <View style={[s.tabs, { backgroundColor: t.surface, borderColor: t.border, paddingBottom: Math.max(insets.bottom, 8) }]}>
        <Pressable style={s.tab} accessibilityRole="tab" accessibilityState={{ selected: true }}>
          <Text style={{ color: t.primary, fontWeight: '700', fontSize: 12 }}>Kütüphane</Text>
        </Pressable>
        <Pressable
          style={s.tab}
          onPress={() => { scroll.current?.scrollTo({ y: 0, animated: true }); setTimeout(() => searchInput.current?.focus(), 150); }}
          accessibilityRole="tab"
        >
          <Text style={{ color: t.muted, fontWeight: '600', fontSize: 12 }}>Ara</Text>
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
  quoteCard: { flexDirection: 'row', gap: 12, borderWidth: 1, borderRadius: 16, padding: 14 },
  quoteBar: { width: 4, borderRadius: 2 },
  quoteActions: { flexDirection: 'row', gap: 4, marginTop: 4, marginLeft: -10 },
  quoteBtn: { minHeight: 44, minWidth: 44, paddingHorizontal: 10, justifyContent: 'center', alignItems: 'center' },
  search: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, height: 46 },
  chips: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  chip: { minHeight: 40, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, justifyContent: 'center' },
  empty: { alignItems: 'center', gap: 10, paddingTop: 32, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 20, fontWeight: '700' },
  demo: { borderWidth: 1.5, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 18, marginTop: 8 },
  tabs: { flexDirection: 'row', justifyContent: 'space-around', borderTopWidth: 1 },
  tab: { minWidth: 72, height: 56, alignItems: 'center', justifyContent: 'center' },
  hitCard: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 4 },
  hitHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  hitRow: { paddingVertical: 10, borderTopWidth: 1 },
  hitMore: { minHeight: 44, justifyContent: 'center' },
});
