import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { BookRow } from '../types';
import { describeBook } from '../lib/sizeLabel';
import { serif, useTheme } from '../theme';

export function BookCard({ book, onPress, onLongPress }: {
  book: BookRow; onPress: () => void; onLongPress?: () => void;
}) {
  const t = useTheme();
  const progress = book.pageCount ? Math.min(1, (book.lastPage + 1) / book.pageCount) : 0;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={[s.card, { backgroundColor: t.surface, borderColor: t.border }]}
      accessibilityRole="button"
      accessibilityLabel={`${book.title}, ${describeBook(book.pageCount)}`}
    >
      <View style={[s.cover, { backgroundColor: t.primaryDark }]}>
        <Text style={[s.coverTitle, { fontFamily: serif }]} numberOfLines={4}>{book.title}</Text>
      </View>
      <View style={s.info}>
        <Text style={[s.title, { color: t.text, fontFamily: serif }]} numberOfLines={2}>{book.title}</Text>
        <Text style={{ color: t.muted }} numberOfLines={1}>{book.author}</Text>
        <Text style={[s.size, { color: t.primary }]}>{describeBook(book.pageCount)}</Text>
        <View style={[s.bar, { backgroundColor: t.border }]}>
          <View style={[s.fill, { width: `${progress * 100}%`, backgroundColor: t.accent }]} />
        </View>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: { flexDirection: 'row', borderRadius: 14, borderWidth: 1, overflow: 'hidden', marginBottom: 12 },
  cover: { width: 84, padding: 8, justifyContent: 'flex-end' },
  coverTitle: { color: '#fff', fontSize: 12, fontWeight: '700' },
  info: { flex: 1, padding: 12, gap: 4 },
  title: { fontSize: 17, fontWeight: '700' },
  size: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  bar: { height: 4, borderRadius: 2, marginTop: 6, overflow: 'hidden' },
  fill: { height: 4 },
});
