// src/constants/featureFlags.ts
const toBool = (value?: string | null) => value === 'true' || value === '1';
export const FEATURE_FLAGS = {
  EDUCATION_V2: toBool(process.env.KIS_EDU_V2 ?? null) || __DEV__,
};
