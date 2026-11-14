import { useEffect, useState } from 'react';
import { Linking } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ShareIntentProvider, useShareIntentContext } from 'expo-share-intent';
import LibraryScreen from './src/screens/LibraryScreen';
import ConvertScreen from './src/screens/ConvertScreen';
import BookDetailScreen from './src/screens/BookDetailScreen';
import ReaderScreen from './src/screens/ReaderScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { parseVideoId } from './src/lib/youtube';
import { SettingsProvider } from './src/settings';
import { useIsDark, useTheme } from './src/theme';

export type RootStackParamList = {
  Library: undefined;
  Convert: { videoId: string };
  BookDetail: { id: string };
  Reader: { id: string; pos?: number; hl?: string };
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const navRef = createNavigationContainerRef<RootStackParamList>();

/** Links shared from YouTube ("Paylaş" > Barış Kitaplık) and deep links open the conversion screen. */
function LinkHandler({ ready }: { ready: boolean }) {
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext();

  useEffect(() => {
    if (!ready || !hasShareIntent) return;
    const id = parseVideoId(shareIntent.webUrl ?? shareIntent.text ?? '');
    resetShareIntent();
    if (id) navRef.navigate('Convert', { videoId: id });
  }, [ready, hasShareIntent, shareIntent, resetShareIntent]);

  useEffect(() => {
    if (!ready) return;
    const handle = (url?: string | null) => {
      const id = url ? parseVideoId(url) : null;
      if (id) navRef.navigate('Convert', { videoId: id });
    };
    Linking.getInitialURL().then(handle);
    const sub = Linking.addEventListener('url', (e) => handle(e.url));
    return () => sub.remove();
  }, [ready]);

  return null;
}

function Root() {
  const t = useTheme();
  const isDark = useIsDark();
  const [ready, setReady] = useState(false);
  return (
    <>
      <NavigationContainer ref={navRef} onReady={() => setReady(true)}>
        <Stack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: t.bg },
            headerTintColor: t.text,
            contentStyle: { backgroundColor: t.bg },
          }}
        >
          <Stack.Screen name="Library" component={LibraryScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Convert" component={ConvertScreen} options={{ headerShown: false }} />
          <Stack.Screen name="BookDetail" component={BookDetailScreen} options={{ title: 'Kitap' }} />
          <Stack.Screen name="Reader" component={ReaderScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Ayarlar' }} />
        </Stack.Navigator>
        <LinkHandler ready={ready} />
      </NavigationContainer>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ShareIntentProvider>
          <SettingsProvider>
            <Root />
          </SettingsProvider>
        </ShareIntentProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
