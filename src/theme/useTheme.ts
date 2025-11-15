// src/theme/useTheme.ts
import { useColorScheme } from 'react-native';
import {
  KIS_COLORS,
  KIS_TOKENS,
  KISTone,
  createPalette,
  KISPalette,
} from './constants';

export function useKISTheme(forced?: KISTone) {
  const sys = useColorScheme();
  const tone: KISTone = forced ?? (sys === 'dark' ? 'dark' : 'light');

  const palette: KISPalette = createPalette(tone);
  const tokens = KIS_TOKENS;

  return {
    tone,
    isDark: tone === 'dark',
    palette,
    tokens,
    brand: KIS_COLORS.brand,
  };
}
