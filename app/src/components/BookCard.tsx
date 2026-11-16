import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { BookRow } from '../types';
import { describeBook } from '../lib/sizeLabel';
import { coverColor, serif, useTheme } from '../theme';
import { progressOf } from '../db/db';

type Props = { book: BookRow; onPress: () => void; onLongPress?: () => void; onToggleFavorite?: () => void; onSummary?: () => void };

function Star({ on, onPress, title }: { on: boolean; onPress: () => void; title: string }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={s.star}
      accessibilityRole="button"
      accessibilityLabel={on ? `${title} favorilerden çıkar` : `${title} favorilere ekle`}
      accessibilityState={{ selected: on }}
    >
      <Text style={{ fontSize: 24, color: on ? t.accent : t.muted }}>{on ? '★' : '☆'}</Text>
    </Pressable>
  );
}

/** Compact list row (A: Kâğıt ve Mürekkep). */
export function BookCard({ book, onPress, onLongPress, onToggleFavorite, onSummary }: Props) {
  const t = useTheme();
  return (
    <View style={[s.compactCard,{backgroundColor:t.surface,borderColor:t.border}]}>
      <Pressable onPress={onPress} onLongPress={onLongPress} style={s.row} accessibilityRole="button" accessibilityLabel={`${book.title}, ${describeBook(book.pageCount)}`}>
        <View style={[s.miniCover, { backgroundColor: coverColor(book.id) }]} />
        <View style={{ flex: 1 }}>
          <Text style={[s.rowTitle, { color: t.text, fontFamily: serif }]} numberOfLines={1}>{book.title}</Text>
          <Text style={{ color: t.muted, fontSize: 12 }} numberOfLines={1}>{describeBook(book.pageCount)}</Text>
        </View>
        {onToggleFavorite && <Star on={!!book.favorite} onPress={onToggleFavorite} title={book.title} />}
      </Pressable>
      {onSummary && <View style={s.compactActions}>
        <Pressable onPress={onSummary} style={[s.actionButton,{backgroundColor:t.bg,borderColor:t.border}]} accessibilityRole="button"><Text style={{color:t.primary,fontWeight:'700',fontSize:12}}>Özeti gör</Text></Pressable>
        <Pressable onPress={onPress} style={[s.actionButton,{backgroundColor:t.bg,borderColor:t.border}]} accessibilityRole="button"><Text style={{color:t.primary,fontWeight:'700',fontSize:12}}>Kitabı aç</Text></Pressable>
      </View>}
    </View>
  );
}

/** Featured "continue reading" card. */
export function ContinueCard({ book, onPress, onLongPress, onToggleFavorite, onSummary }: Props) {
  const t = useTheme();
  const progress = progressOf(book);
  return (
    <View style={[s.featuredWrap,{backgroundColor:t.surface,borderColor:t.border}]}>
      <Pressable onPress={onPress} onLongPress={onLongPress} style={s.featured} accessibilityRole="button" accessibilityLabel={`Devam et: ${book.title}`}>
        <View style={[s.cover, { backgroundColor: coverColor(book.id) }]}><Text style={[s.coverTitle, { fontFamily: serif }]} numberOfLines={4}>{book.title}</Text></View>
        <View style={s.info}>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 4 }}>
              <Text style={[s.title, { color: t.text, fontFamily: serif, flex: 1 }]} numberOfLines={2}>{book.title}</Text>
              {onToggleFavorite && <Star on={!!book.favorite} onPress={onToggleFavorite} title={book.title} />}
            </View>
            <Text style={{ color: t.muted, fontSize: 13 }} numberOfLines={1}>{book.author}</Text>
            <Text style={[s.size, { color: t.primary }]}>{describeBook(book.pageCount)}</Text>
            <View style={[s.bar, { backgroundColor: t.border,marginTop:8 }]}><View style={[s.fill, { width: `${progress * 100}%`, backgroundColor: t.accent }]} /></View>
            <Text style={{ color: t.muted, fontSize: 12, marginTop: 5 }}>%{Math.round(progress * 100)} okundu</Text>
          </View>
        </View>
      </Pressable>
      {onSummary && <View style={s.featuredActions}>
        <Pressable onPress={onSummary} style={[s.actionButton,{backgroundColor:t.bg,borderColor:t.border}]} accessibilityRole="button"><Text style={{color:t.primary,fontWeight:'700'}}>Özeti gör</Text></Pressable>
        <Pressable onPress={onPress} style={[s.actionButton,{backgroundColor:t.bg,borderColor:t.border}]} accessibilityRole="button"><Text style={{color:t.primary,fontWeight:'700'}}>Kitabı aç</Text></Pressable>
      </View>}
    </View>
  );
}

const s = StyleSheet.create({
  compactCard: { borderRadius:14,borderWidth:1,overflow:'hidden' },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center', padding: 10 },
  compactActions: { flexDirection:'row',gap:8,paddingHorizontal:10,paddingBottom:10 },
  actionButton: { flex:1,minHeight:36,borderRadius:10,borderWidth:1,alignItems:'center',justifyContent:'center',paddingHorizontal:8 },
  miniCover: { width: 44, height: 58, borderRadius: 4 },
  star: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -6, marginTop: -4 },
  rowTitle: { fontSize: 16, fontWeight: '700' },
  featuredWrap: { borderRadius:16,borderWidth:1,overflow:'hidden' },
  featured: { flexDirection: 'row', gap: 14, padding: 12 },
  featuredActions: { flexDirection:'row',gap:8,paddingHorizontal:12,paddingBottom:12 },
  cover: { width: 78, height: 104, borderRadius: 6, padding: 8, justifyContent: 'flex-end' },
  coverTitle: { color: '#fff', fontSize: 12, fontWeight: '700' },
  info: { flex: 1, justifyContent: 'space-between', minHeight: 104 },
  title: { fontSize: 18, fontWeight: '700' },
  size: { fontSize: 12, fontWeight: '600', marginTop: 6 },
  bar: { height: 5, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 5 },
});
