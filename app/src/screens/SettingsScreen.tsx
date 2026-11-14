import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { FONT_FAMILIES, FONT_LABELS, FONT_SCALES, useSettings, type FontKey, type Mode } from '../settings';
import { serif, useTheme } from '../theme';

const MODES: { key: Mode; label: string }[] = [
  { key: 'auto', label: 'Sistem' },
  { key: 'night', label: 'Gece' },
  { key: 'day', label: 'Gündüz' },
];

function Segment<T extends string>({ value, options, onChange }: {
  value: T; options: { key: T; label: string }[]; onChange: (k: T) => void;
}) {
  const t = useTheme();
  return (
    <View style={[s.segment, { backgroundColor: t.border }]}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            style={[s.segBtn, on && { backgroundColor: t.surface }]}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
          >
            <Text style={{ color: on ? t.text : t.muted, fontWeight: on ? '700' : '500' }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function SettingsScreen() {
  const t = useTheme();
  const { settings, update } = useSettings();
  const version = Constants.expoConfig?.version ?? '0.1.0';
  const build = Constants.expoConfig?.android?.versionCode;
  const fontSize = 19 * FONT_SCALES[settings.fontIdx];

  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={s.root}>
      <Text style={[s.label, { color: t.muted }]}>GÖRÜNÜM</Text>
      <Segment value={settings.mode} options={MODES} onChange={(mode) => update({ mode })} />

      <Text style={[s.label, { color: t.muted }]}>YAZI TİPİ</Text>
      <Segment
        value={settings.font}
        options={(Object.keys(FONT_LABELS) as FontKey[]).map((k) => ({ key: k, label: FONT_LABELS[k] }))}
        onChange={(font) => update({ font })}
      />

      <Text style={[s.label, { color: t.muted }]}>YAZI BOYUTU</Text>
      <View style={s.sizeRow}>
        <Pressable
          onPress={() => update({ fontIdx: Math.max(0, settings.fontIdx - 1) })}
          style={[s.square, { borderColor: t.border, backgroundColor: t.surface }]}
          accessibilityRole="button" accessibilityLabel="Yazıyı küçült"
        >
          <Text style={{ color: t.text, fontWeight: '600' }}>A−</Text>
        </Pressable>
        <Text style={{ color: t.muted, flex: 1, textAlign: 'center' }}>{settings.fontIdx + 1} / {FONT_SCALES.length}</Text>
        <Pressable
          onPress={() => update({ fontIdx: Math.min(FONT_SCALES.length - 1, settings.fontIdx + 1) })}
          style={[s.square, { borderColor: t.border, backgroundColor: t.surface }]}
          accessibilityRole="button" accessibilityLabel="Yazıyı büyüt"
        >
          <Text style={{ color: t.text, fontWeight: '700', fontSize: 18 }}>A+</Text>
        </Pressable>
      </View>
      <View style={[s.preview, { backgroundColor: t.surface, borderColor: t.border }]}>
        <Text allowFontScaling={false} style={{ color: t.text, fontFamily: FONT_FAMILIES[settings.font], fontSize, lineHeight: fontSize * 1.7 }}>
          Okurken iki parmağınla yazıyı büyütüp küçültebilirsin. Sayfayı çevirmek için kaydır ya da kenarlara dokun.
        </Text>
      </View>

      <Text style={[s.label, { color: t.muted }]}>HAKKINDA</Text>
      <Text style={{ color: t.text, fontFamily: serif, fontSize: 18, fontWeight: '700' }}>Barış Kitaplık</Text>
      <Text style={{ color: t.muted }}>Sürüm {version}{build ? ` (derleme ${build})` : ''}</Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { padding: 20, gap: 12 },
  label: { fontSize: 11, letterSpacing: 1.4, fontWeight: '600', marginTop: 12 },
  segment: { flexDirection: 'row', borderRadius: 12, padding: 3 },
  segBtn: { flex: 1, minHeight: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  sizeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  square: { width: 48, height: 48, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  preview: { borderWidth: 1, borderRadius: 14, padding: 16 },
});
