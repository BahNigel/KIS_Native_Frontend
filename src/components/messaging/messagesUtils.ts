// src/screens/tabs/messagesUtils.ts
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { KIS_TOKENS } from '../../theme/constants';

/* ----------------------------- Types & Storage ----------------------------- */

export type Chat = {
  id: string;
  name: string;
  lastMessage: string;
  lastAt: string; // ISO or humanized
  isGroup: boolean;
  unreadCount: number;
  hasMention: boolean; // e.g. “@you”
  hasMedia?: boolean;
  participants?: string[]; // usernames
};

export type CustomFilterRule = {
  name: string;              // display name (e.g., “Media only”)
  includeGroups?: boolean;   // undefined means ignore this rule
  includeDMs?: boolean;
  onlyUnread?: boolean;
  onlyMentions?: boolean;
  withMedia?: boolean;
  minUnread?: number;        // 0+ (if set)
  participantIncludes?: string; // substring match on participant
  nameIncludes?: string;        // substring match on chat name
};

export type CustomFilter = {
  id: string;     // uuid-ish
  label: string;  // user visible name
  rules: CustomFilterRule;
};

export const CUSTOM_FILTERS_KEY = 'kis_custom_filters:v1';

/* -------------------------- Emoji fallback Icon --------------------------- */


/* -------------------------- Sample Chat Data (demo) ----------------------- */
export const SAMPLE_CHATS: Chat[] = [
  { id: '1', name: 'Anna', lastMessage: 'Blessed Sunday to everyone!', lastAt: '5m', isGroup: false, unreadCount: 0, hasMention: false, participants: ['anna'], hasMedia: false },
  { id: '2', name: 'Team KIS', lastMessage: '@you can you review PR?', lastAt: '12m', isGroup: true, unreadCount: 4, hasMention: true, participants: ['anna', 'ben', 'you'], hasMedia: true },
  { id: '3', name: 'Ben', lastMessage: 'dropping the slides here', lastAt: '1h', isGroup: false, unreadCount: 2, hasMention: false, participants: ['ben'], hasMedia: true },
  { id: '4', name: 'Church Media', lastMessage: 'New clip uploaded', lastAt: '2h', isGroup: true, unreadCount: 0, hasMention: false, participants: ['you', 'media'], hasMedia: true },
  { id: '5', name: 'Grace', lastMessage: 'see you later!', lastAt: 'yesterday', isGroup: false, unreadCount: 1, hasMention: false, participants: ['grace'], hasMedia: false },
  { id: '6', name: 'Mentors', lastMessage: 'weekly standup notes', lastAt: 'Mon', isGroup: true, unreadCount: 6, hasMention: false, participants: ['you', 'coach'], hasMedia: false },
  { id: '7', name: 'Samuel', lastMessage: 'Praying for your meeting 🙏', lastAt: 'Tue', isGroup: false, unreadCount: 0, hasMention: false, participants: ['samuel'], hasMedia: false },
  { id: '8', name: 'Worship Team', lastMessage: 'Setlist for next Sunday posted', lastAt: 'Wed', isGroup: true, unreadCount: 3, hasMention: false, participants: ['you', 'anna', 'joel'], hasMedia: false },
  { id: '9', name: 'Joel', lastMessage: 'Great rehearsal tonight!', lastAt: 'Thu', isGroup: false, unreadCount: 0, hasMention: false, participants: ['joel'], hasMedia: false },
  { id: '10', name: 'Youth Leaders', lastMessage: 'Planning the next retreat', lastAt: 'Fri', isGroup: true, unreadCount: 7, hasMention: false, participants: ['you', 'grace', 'samuel'], hasMedia: true },
  { id: '11', name: 'Lydia', lastMessage: 'Do you have the flyer ready?', lastAt: 'Sat', isGroup: false, unreadCount: 1, hasMention: false, participants: ['lydia'], hasMedia: false },
  { id: '12', name: 'Outreach Team', lastMessage: 'Bus will leave at 8am sharp', lastAt: '3d', isGroup: true, unreadCount: 0, hasMention: false, participants: ['you', 'ben', 'grace'], hasMedia: false },
  { id: '13', name: 'Joshua', lastMessage: 'Can you send me the notes?', lastAt: '4d', isGroup: false, unreadCount: 2, hasMention: true, participants: ['joshua'], hasMedia: false },
  { id: '14', name: 'Faith', lastMessage: 'Good news! My visa got approved 🎉', lastAt: '5d', isGroup: false, unreadCount: 0, hasMention: false, participants: ['faith'], hasMedia: true },
  { id: '15', name: 'Design Team', lastMessage: 'Final mockups are in the folder', lastAt: '6d', isGroup: true, unreadCount: 1, hasMention: false, participants: ['you', 'lydia', 'ben'], hasMedia: true },
  { id: '16', name: 'Intercessors', lastMessage: '@you will lead tomorrow’s prayer point', lastAt: '1w', isGroup: true, unreadCount: 5, hasMention: true, participants: ['you', 'grace', 'samuel'], hasMedia: false },
  { id: '17', name: 'Daniel', lastMessage: 'Got your message. Will call later.', lastAt: '1w', isGroup: false, unreadCount: 0, hasMention: false, participants: ['daniel'], hasMedia: false },
  { id: '18', name: 'Choir Alumni', lastMessage: 'Reunion meeting next month 🎶', lastAt: '2w', isGroup: true, unreadCount: 0, hasMention: false, participants: ['anna', 'joel', 'grace'], hasMedia: true },
  { id: '19', name: 'Naomi', lastMessage: 'Check the attachment please', lastAt: '2w', isGroup: false, unreadCount: 1, hasMention: false, participants: ['naomi'], hasMedia: true },
  { id: '20', name: 'Leadership Board', lastMessage: 'Agenda for next session shared', lastAt: '3w', isGroup: true, unreadCount: 3, hasMention: false, participants: ['you', 'coach', 'grace', 'ben'], hasMedia: true },
];


/* ------------------------------ Filter utils ------------------------------ */

export type QuickChip = 'Unread' | 'Groups' | 'Mentions';

export function applyQuickChips(chat: Chat, chips: Set<QuickChip>) {
  if (chips.has('Unread') && chat.unreadCount <= 0) return false;
  if (chips.has('Groups') && !chat.isGroup) return false;
  if (chips.has('Mentions') && !chat.hasMention) return false;
  return true;
}

export function applyCustomRules(chat: Chat, rules?: CustomFilterRule) {
  if (!rules) return true;
  if (rules.onlyUnread && chat.unreadCount <= 0) return false;
  if (rules.onlyMentions && !chat.hasMention) return false;

  if (rules.includeGroups === true && !chat.isGroup) return false;
  if (rules.includeDMs === true && chat.isGroup) return false;

  if (typeof rules.minUnread === 'number' && chat.unreadCount < rules.minUnread) return false;

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
    chat.lastMessage.toLowerCase().includes(q) ||
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
  appBarRight: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 10 },

  /* Search */
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    height: KIS_TOKENS.controlHeights.md,
    borderRadius: KIS_TOKENS.radius.xl,
    paddingHorizontal: 12,
  },
  searchInput: { flex: 1, fontSize: KIS_TOKENS.typography.input, marginHorizontal: 8 },
  searchIconBtn: { paddingHorizontal: 6, paddingVertical: 6, borderRadius: 8 },
  searchDivider: { width: 1, height: 24, opacity: 0.5, marginHorizontal: 4 },

  /* Chips */
  chipsRow: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
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
  menuOverlay: { position: 'absolute', top: 0, bottom: -100, left: 0, right: 0 },
  menuBox: { position: 'absolute', width: 200, borderRadius: 12, borderWidth: 1, paddingVertical: 6 },
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
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
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
