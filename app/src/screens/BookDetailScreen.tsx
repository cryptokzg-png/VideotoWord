import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { getBook } from '../db/db';
import type { Book } from '../types';
import { describeBook } from '../lib/sizeLabel';
import { serif, useTheme } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'BookDetail'>;

export default function BookDetailScreen({ route, navigation }: Props) {
  const t = useTheme();
  const [book, setBook] = useState<Book | null>(null);
  useEffect(() => { getBook(route.params.id).then(setBook); }, [route.params.id]);
  if (!book) return <View style={[s.root, { backgroundColor: t.bg }]} />;

  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={s.root}>
      <View style={[s.cover, { backgroundColor: t.primaryDark }]}>
        <Text style={[s.coverTitle, { fontFamily: serif }]}>{book.title}</Text>
        <Text style={{ color: t.accent, marginTop: 8 }}>{book.author}</Text>
      </View>
      <Text style={[s.size, { color: t.primary }]}>{describeBook(book.pageCount ?? book.pages.length)}</Text>
      <Pressable
        onPress={() => navigation.navigate('Reader', { id: book.id })}
        style={[s.read, { backgroundColor: t.primary }]}
        accessibilityRole="button"
      >
        <Text style={s.readText}>{book.lastPos > 0 ? `Devam et (%${Math.round((book.lastPos / Math.max(1, book.totalChars)) * 100)})` : 'Oku'}</Text>
      </Pressable>
      <Text style={[s.h2, { color: t.text, fontFamily: serif }]}>Bölümler</Text>
      {book.chapters.map((c, i) => (
        <Text key={i} style={{ color: t.muted, paddingVertical: 4 }}>{i + 1}. {c.title}</Text>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { padding: 20, gap: 12 },
  cover: { borderRadius: 16, padding: 24, minHeight: 200, justifyContent: 'flex-end' },
  coverTitle: { color: '#fff', fontSize: 28, fontWeight: '800' },
  size: { fontSize: 15, fontWeight: '700' },
  read: { borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  readText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  h2: { fontSize: 20, fontWeight: '700', marginTop: 12 },
});
