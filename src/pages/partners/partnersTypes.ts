// src/screens/tabs/partnersTypes.ts
export type PartnerAdmin = {
  id: string;
  name: string;
  initials: string;
  position: string;
  avatarUrl?: string;
};

export type Partner = {
  id: string;
  name: string;
  initials: string;
  tagline: string;
  admins: PartnerAdmin[];
};

export type PartnerGroup = {
  id: string;
  partnerId: string;
  name: string;
  type: 'public' | 'private';
  communityId?: string;
};

export type PartnerCommunity = {
  id: string;
  partnerId: string;
  name: string;
  description?: string;
};

export const LEFT_RAIL_WIDTH = 72;
export const RIGHT_PEEK_WIDTH = 72;
