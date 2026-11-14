import { useColorScheme } from 'react-native';

export const light = {
  bg: '#F4F1EC',
  surface: '#FFFFFF',
  text: '#1B1B2F',
  muted: '#6B6258',
  primary: '#5B21B6',
  primaryDark: '#2A1065',
  accent: '#F5C542',
  danger: '#BE123C',
  border: '#E3DED5',
  page: '#FFFFFF',
};

export const dark: typeof light = {
  bg: '#0E0B1F',
  surface: '#151230',
  text: '#ECE9FA',
  muted: '#A9A3C8',
  primary: '#A78BFA',
  primaryDark: '#2A1065',
  accent: '#F5C542',
  danger: '#FB7185',
  border: '#3A3366',
  page: '#0E0B1F',
};

export type Theme = typeof light;
export const serif = 'serif';

export function useTheme(override?: 'light' | 'dark'): Theme {
  const scheme = useColorScheme();
  return (override ?? scheme) === 'dark' ? dark : light;
}

const COVERS = ['#5B21B6', '#0F766E', '#B45309', '#9F1239', '#1D4ED8', '#4D7C0F'];

/** Stable cover color per book id. */
export function coverColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return COVERS[h % COVERS.length];
}
