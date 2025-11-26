// src/screens/tabs/messagesUtils.ts

import { KIS_TOKENS } from '@/theme/constants';
import React from 'react';
import { StyleSheet, Text } from 'react-native';

/* ----------------------------- Types & Storage ----------------------------- */

export type Chat = {
  /* Core identity */
  id: string;
  name: string;
  title?: string;
  avatarUrl?: string;

  /* List-preview metadata (Messages tab) */
  lastMessage?: string;
  lastAt?: string;
  unreadCount?: number;
  hasMention?: boolean;
  hasMedia?: boolean;
  participants?: string[];

  /* Type flags */
  kind?: 'direct' | 'group' | 'community' | 'channel';
  isGroup?: boolean;
  isGroupChat?: boolean;
  isCommunityChat?: boolean;
  isContactChat?: boolean;
  isDirect?: boolean;

  groupId?: string | number;
  communityId?: string | number;
  contactPhone?: string;

  /* Backend / conversation metadata */
  conversationId?: string;

  /* DM request / lock metadata */
  requestState?: 'none' | 'pending' | 'accepted' | 'rejected';
  requestInitiatorId?: string;
  requestRecipientId?: string;
  isRequestOutbound?: boolean;
  isRequestInbound?: boolean;
};

export type CustomFilterRule = {
  name: string;
  includeGroups?: boolean;
  includeDMs?: boolean;
  onlyUnread?: boolean;
  onlyMentions?: boolean;
  withMedia?: boolean;
  minUnread?: number;
  participantIncludes?: string;
  nameIncludes?: string;
};

export type CustomFilter = {
  id: string;
  label: string;
  rules: CustomFilterRule;
};

export const CUSTOM_FILTERS_KEY = 'kis_custom_filters:v1';

/* ------------------------------ Filter utils ------------------------------ */

export type QuickChip = 'Unread' | 'Groups' | 'Mentions';

export function applyQuickChips(chat: Chat, chips: Set<QuickChip>) {
  if (chips.has('Unread') && (chat.unreadCount ?? 0) <= 0) return false;
  if (chips.has('Groups') && !chat.isGroup) return false;
  if (chips.has('Mentions') && !chat.hasMention) return false;
  return true;
}

export function applyCustomRules(chat: Chat, rules?: CustomFilterRule) {
  if (!rules) return true;
  if (rules.onlyUnread && (chat.unreadCount ?? 0) <= 0) return false;
  if (rules.onlyMentions && !chat.hasMention) return false;

  if (rules.includeGroups === true && !chat.isGroup) return false;
  if (rules.includeDMs === true && chat.isGroup) return false;

  if (
    typeof rules.minUnread === 'number' &&
    (chat.unreadCount ?? 0) < rules.minUnread
  )
    return false;

  if (rules.withMedia === true && !chat.hasMedia) return false;

  if (rules.participantIncludes?.trim()) {
    const q = rules.participantIncludes.trim().toLowerCase();
    const hay = (chat.participants || []).join(' ').toLowerCase();
    if (!hay.includes(q)) return false;
  }

  if (rules.nameIncludes?.trim()) {
    const q = rules.nameIncludes.trim().toLowerCase();
    if (!chat.name.toLowerCase().includes(q)) return false;
  }

  return true;
}

export function bySearch(chat: Chat, query: string) {
  if (!query.trim()) return true;
  const q = query.toLowerCase();
  return (
    chat.name.toLowerCase().includes(q) ||
    (chat.lastMessage ?? '').toLowerCase().includes(q) ||
    (chat.participants || []).join(' ').toLowerCase().includes(q)
  );
}

/* --------------------------------- Styles --------------------------------- */

export const styles = StyleSheet.create({
  wrap: { flex: 1 },

  /* App Bar */
  appBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingBottom: 10,
    paddingTop: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  appBarLeft: { flex: 1 },
  appName: { fontSize: 22, fontWeight: '900', letterSpacing: 0.3 },
  appSubtitle: { marginTop: 2, fontSize: 12, letterSpacing: 0.2 },
  appBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 10,
  },

  /* Search */
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    height: KIS_TOKENS.controlHeights.md,
    borderRadius: KIS_TOKENS.radius.xl,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: KIS_TOKENS.typography.input,
    marginHorizontal: 8,
  },
  searchIconBtn: {
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderRadius: 8,
  },
  searchDivider: { width: 1, height: 24, opacity: 0.5, marginHorizontal: 4 },

  /* Chips */
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    flexWrap: 'wrap',
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },

  /* Chat Row */
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  name: { fontWeight: '700', marginBottom: 2, fontSize: 16 },
  avatar: { width: 44, height: 44, borderRadius: 22 },

  /* Dropdown */
  menuOverlay: {
    position: 'absolute',
    top: 0,
    bottom: -100,
    left: 0,
    right: 0,
  },
  menuBox: {
    position: 'absolute',
    width: 200,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 6,
  },
  menuItem: { paddingHorizontal: 14, paddingVertical: 12 },

  /* Centers */
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  /* Modal */
  modalWrap: { flex: 1, justifyContent: 'flex-end' },
  modalCard: {
    padding: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 10 },

  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 6,
  },
  pillBtn: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  checkboxBox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedFilterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  footerBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
});
