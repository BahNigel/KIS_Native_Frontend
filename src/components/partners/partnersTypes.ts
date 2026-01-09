// src/screens/tabs/partnersTypes.ts
export type PartnerAdmin = {
  id: string;
  name?: string | null;
  initials?: string;
  position?: string;
  avatarUrl?: string | null;
};

export type PartnerApi = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  avatar_url?: string | null;
  is_active?: boolean;
  main_conversation_id?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type Partner = PartnerApi & {
  initials: string;
  tagline: string;
  admins: PartnerAdmin[];
};

export type PartnerGroup = {
  id: string;
  name: string;
  partner?: string | null;
  community?: string | null;
  channel?: string | null;
  conversation_id?: string | null;
};

export type PartnerCommunity = {
  id: string;
  name: string;
  description?: string | null;
  avatar_url?: string | null;
  partner?: string | null;
  main_conversation_id?: string | null;
  posts_conversation_id?: string | null;
};

export type PartnerPost = {
  id: string;
  partner: string;
  author?: {
    id?: string;
    display_name?: string | null;
    phone?: string | null;
    avatar_url?: string | null;
  };
  text?: string | null;
  styled_text?: any;
  attachments?: any[];
  poll?: any;
  event?: any;
  link?: string | null;
  reactions?: { emoji: string; count: number }[];
  comments_count?: number;
  has_reacted?: boolean;
  comment_conversation_id?: string | null;
  created_at?: string;
};

export const LEFT_RAIL_WIDTH = 72;
export const RIGHT_PEEK_WIDTH = 72;
