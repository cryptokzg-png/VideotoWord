import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

type Colors = { card: string; text: string; muted: string; border: string; accent: string };

/** Small dialog to rename a chapter. `onReset` brings back the automatic title. */
export function RenameDialog({ visible, label, initial, c, onCancel, onSave, onReset }: {
  visible: boolean; label: string; initial: string; c: Colors;
  onCancel: () => void; onSave: (title: string) => void; onReset: () => void;
}) {
  const [text, setText] = useState(initial);
  useEffect(() => { if (visible) setText(initial); }, [visible, initial]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={s.backdrop}>
        <View style={[s.dialog, { backgroundColor: c.card }]}>
          <Text style={{ color: c.text, fontWeight: '800' }}>Bölüm başlığı</Text>
          <Text style={{ color: c.muted, fontSize: 13 }}>{label}</Text>
          <TextInput
            value={text}
            onChangeText={setText}
            autoFocus
            selectTextOnFocus
            maxLength={80}
            placeholder="Bölüm başlığı"
            placeholderTextColor={c.muted}
            style={[s.input, { color: c.text, borderColor: c.border }]}
            accessibilityLabel="Bölüm başlığı"
            onSubmitEditing={() => text.trim() && onSave(text)}
          />
          <View style={s.row}>
            <Pressable onPress={onReset} accessibilityRole="button" style={s.btn}>
              <Text style={{ color: c.muted, fontSize: 13 }}>Otomatiğe döndür</Text>
            </Pressable>
            <View style={{ flex: 1 }} />
            <Pressable onPress={onCancel} accessibilityRole="button" style={s.btn}>
              <Text style={{ color: c.muted }}>Vazgeç</Text>
            </Pressable>
            <Pressable
              onPress={() => text.trim() && onSave(text)}
              disabled={!text.trim()}
              accessibilityRole="button"
              style={[s.btn, { opacity: text.trim() ? 1 : 0.4 }]}
            >
              <Text style={{ color: c.accent, fontWeight: '800' }}>Kaydet</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-start', paddingTop: 120, paddingHorizontal: 24 },
  dialog: { borderRadius: 14, padding: 20, gap: 10 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 17 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  btn: { minHeight: 44, minWidth: 44, paddingHorizontal: 8, justifyContent: 'center', alignItems: 'center' },
});
