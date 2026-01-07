import { CacheConfig } from '@/network/cacheKeys';
import { getCache } from '@/network/cache';

export type AccountTierShape = {
  name?: string;
  code?: string;
  slug?: string;
  id?: string | number;
};

const TIER_ORDER = ['free', 'basic', 'pro', 'business', 'business pro', 'partner'];

export const normalizeTierName = (tier?: AccountTierShape | string | null) => {
  if (!tier) return '';
  if (typeof tier === 'string') return tier.trim().toLowerCase();
  return String(tier.name || tier.code || tier.slug || '').trim().toLowerCase();
};

export const tierRank = (tier?: AccountTierShape | string | null) => {
  const key = normalizeTierName(tier);
  const idx = TIER_ORDER.findIndex((name) => name === key);
  return idx >= 0 ? idx : 0;
};

export const isTierAtLeast = (tier: AccountTierShape | string | null, required: string) =>
  tierRank(tier) >= tierRank(required);

export const isBusinessTier = (tier?: AccountTierShape | string | null) =>
  isTierAtLeast(tier || '', 'business');

export const isPartnerTier = (tier?: AccountTierShape | string | null) =>
  normalizeTierName(tier).includes('partner');

export const getCachedProfile = async () =>
  getCache(CacheConfig.userProfile.type, CacheConfig.userProfile.key);

export const getTierFromProfile = (profile: any): AccountTierShape | null =>
  profile?.account?.tier || profile?.tier || null;
