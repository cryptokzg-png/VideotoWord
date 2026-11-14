import { useColorScheme } from 'react-native';

export const light = {
  bg: '#F5F2EA',
  surface: '#FFFFFF',
  text: '#141B34',
  muted: '#5F6578',
  primary: '#1E3A8A',
  primaryDark: '#142041',
  accent: '#D4AF37',
  danger: '#BE123C',
  border: '#E3DED5',
  page: '#FFFFFF',
};

export const dark: typeof light = {
  bg: '#0B1228',
  surface: '#121B3A',
  text: '#E8ECF8',
  muted: '#9AA6C8',
  primary: '#93A8F0',
  primaryDark: '#142041',
  accent: '#D4AF37',
  danger: '#FB7185',
  border: '#2A3566',
  page: '#0B1228',
};

export type Theme = typeof light;
export const serif = 'serif';

export function useTheme(override?: 'light' | 'dark'): Theme {
  const scheme = useColorScheme();
  return (override ?? scheme) === 'dark' ? dark : light;
}

const COVERS = ['#1E3A8A', '#0F766E', '#9A3412', '#9F1239', '#4338CA', '#4D7C0F'];

/** Stable cover color per book id. */
export function coverColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return COVERS[h % COVERS.length];
}
