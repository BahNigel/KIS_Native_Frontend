import { TEXT_PRESETS, TypographyPreset } from './fonts';

export type TypographyStyle = {
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  lineHeight: number;
};

/** Re-exported presets so consumers only need one import path. */
export const TYPOGRAPHY_PRESETS = TEXT_PRESETS;

/** Helper to merge color overrides into preset styles. */
export const getTypographyStyle = (
  preset: TypographyPreset,
  color?: string,
): TypographyStyle & { color?: string } => {
  const base = TYPOGRAPHY_PRESETS[preset];
  return color ? { ...base, color } : base;
};
