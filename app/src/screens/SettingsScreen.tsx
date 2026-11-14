import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme';

export default function SettingsScreen() {
  const t = useTheme();
  return (
    <View style={[s.root, { backgroundColor: t.bg }]}>
      <Text style={{ color: t.muted }}>Ayarlar (tema, yazı tipi, sayfa boyutu) sonraki aşamada.</Text>
    </View>
  );
}
const s = StyleSheet.create({ root: { flex: 1, padding: 24 } });
