import { useColorScheme } from 'react-native';

export const light = {
  bg: '#F4F1EC',
  surface: '#FFFFFF',
  text: '#1B1B2F',
  muted: '#6B6B80',
  primary: '#5B21B6',
  primaryDark: '#2A1065',
  accent: '#F5C542',
  danger: '#E11D48',
  border: '#E3DED5',
  page: '#FFFFFF',
};

export const dark: typeof light = {
  bg: '#0F0F1A',
  surface: '#1A1A2B',
  text: '#ECECF4',
  muted: '#9A9AB0',
  primary: '#A78BFA',
  primaryDark: '#2A1065',
  accent: '#F5C542',
  danger: '#FB7185',
  border: '#2C2C42',
  page: '#16162A',
};

export type Theme = typeof light;
export const serif = 'serif';

export function useTheme(override?: 'light' | 'dark'): Theme {
  const scheme = useColorScheme();
  return (override ?? scheme) === 'dark' ? dark : light;
}
