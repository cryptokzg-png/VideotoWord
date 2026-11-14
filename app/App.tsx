import { useEffect } from 'react';
import { Linking } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import LibraryScreen from './src/screens/LibraryScreen';
import ConvertScreen from './src/screens/ConvertScreen';
import BookDetailScreen from './src/screens/BookDetailScreen';
import ReaderScreen from './src/screens/ReaderScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { parseVideoId } from './src/lib/youtube';

export type RootStackParamList = {
  Library: undefined;
  Convert: { videoId: string };
  BookDetail: { id: string };
  Reader: { id: string };
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const navRef = createNavigationContainerRef<RootStackParamList>();

export default function App() {
  // Handle links shared from YouTube ("Paylaş") or opened via deep link.
  useEffect(() => {
    const handle = (url?: string | null) => {
      const id = url ? parseVideoId(url) : null;
      if (id && navRef.isReady()) navRef.navigate('Convert', { videoId: id });
    };
    Linking.getInitialURL().then(handle);
    const sub = Linking.addEventListener('url', (e) => handle(e.url));
    return () => sub.remove();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer ref={navRef}>
          <Stack.Navigator>
            <Stack.Screen name="Library" component={LibraryScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Convert" component={ConvertScreen} options={{ headerShown: false }} />
            <Stack.Screen name="BookDetail" component={BookDetailScreen} options={{ title: 'Kitap' }} />
            <Stack.Screen name="Reader" component={ReaderScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Ayarlar' }} />
          </Stack.Navigator>
        </NavigationContainer>
        <StatusBar style="auto" />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
