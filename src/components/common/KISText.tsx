import React from 'react';
import { Text, TextProps, TextStyle } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { TypographyPreset } from '@/theme/foundations/fonts';

type Props = TextProps & {
  preset?: TypographyPreset;
  color?: string;
  weight?: TextStyle['fontWeight'];
};

export default function KISText({
  preset = 'body',
  color,
  weight,
  style,
  children,
  ...rest
}: Props) {
  const { typography } = useKISTheme();
  const baseStyle = typography.getStyle(preset, color);

  return (
    <Text style={[baseStyle, weight ? { fontWeight: weight } : undefined, style]} {...rest}>
      {children}
    </Text>
  );
}
