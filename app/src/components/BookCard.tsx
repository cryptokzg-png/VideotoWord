import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { BookRow } from '../types';
import { describeBook } from '../lib/sizeLabel';
import { coverColor, serif, useTheme } from '../theme';
import { progressOf } from '../db/db';

type Props = { book: BookRow; onPress: () => void; onLongPress?: () => void };

/** Compact list row (A: Kâğıt ve Mürekkep). */
export function BookCard({ book, onPress, onLongPress }: Props) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={[s.row, { backgroundColor: t.surface, borderColor: t.border }]}
      accessibilityRole="button"
      accessibilityLabel={`${book.title}, ${describeBook(book.pageCount)}`}
    >
      <View style={[s.miniCover, { backgroundColor: coverColor(book.id) }]} />
      <View style={{ flex: 1 }}>
        <Text style={[s.rowTitle, { color: t.text, fontFamily: serif }]} numberOfLines={1}>{book.title}</Text>
        <Text style={{ color: t.muted, fontSize: 12 }} numberOfLines={1}>{describeBook(book.pageCount)}</Text>
      </View>
    </Pressable>
  );
}

/** Featured "continue reading" card. */
export function ContinueCard({ book, onPress }: { book: BookRow; onPress: () => void }) {
  const t = useTheme();
  const progress = progressOf(book);
  return (
    <Pressable
      onPress={onPress}
      style={[s.featured, { backgroundColor: t.surface, borderColor: t.border }]}
      accessibilityRole="button"
      accessibilityLabel={`Devam et: ${book.title}`}
    >
      <View style={[s.cover, { backgroundColor: coverColor(book.id) }]}>
        <Text style={[s.coverTitle, { fontFamily: serif }]} numberOfLines={4}>{book.title}</Text>
      </View>
      <View style={s.info}>
        <View>
          <Text style={[s.title, { color: t.text, fontFamily: serif }]} numberOfLines={2}>{book.title}</Text>
          <Text style={{ color: t.muted, fontSize: 13 }} numberOfLines={1}>{book.author}</Text>
          <Text style={[s.size, { color: t.primary }]}>{describeBook(book.pageCount)}</Text>
        </View>
        <View>
          <View style={[s.bar, { backgroundColor: t.border }]}>
            <View style={[s.fill, { width: `${progress * 100}%`, backgroundColor: t.accent }]} />
          </View>
          <Text style={{ color: t.muted, fontSize: 12, marginTop: 5 }}>
            %{Math.round(progress * 100)} okundu
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, alignItems: 'center', borderRadius: 14, borderWidth: 1, padding: 10 },
  miniCover: { width: 44, height: 58, borderRadius: 4 },
  rowTitle: { fontSize: 16, fontWeight: '700' },
  featured: { flexDirection: 'row', gap: 14, borderRadius: 16, borderWidth: 1, padding: 12 },
  cover: { width: 78, height: 104, borderRadius: 6, padding: 8, justifyContent: 'flex-end' },
  coverTitle: { color: '#fff', fontSize: 12, fontWeight: '700' },
  info: { flex: 1, justifyContent: 'space-between', minHeight: 104 },
  title: { fontSize: 18, fontWeight: '700' },
  size: { fontSize: 12, fontWeight: '600', marginTop: 6 },
  bar: { height: 5, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 5 },
});
