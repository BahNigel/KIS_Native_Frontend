// src/screens/tabs/profile/ProfileStyles.ts
import { StyleSheet, Dimensions, Platform } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const profileLayout = { SCREEN_WIDTH, SCREEN_HEIGHT };

export const styles = StyleSheet.create({
  wrap: { flex: 1 },

  // Screen spacing matches mock (tighter than before)
  scroll: { padding: 16, gap: 14, paddingBottom: 48 },

  /** ─────────────────────────
   *  Cards (mock-like)
   *  ───────────────────────── */
  card: {
    borderRadius: 20,
    padding: 16,
    gap: 12,
  },

  sectionCard: {
    borderRadius: 20,
    padding: 16,
    gap: 12,
    borderWidth: 3,
  },

  /** ─────────────────────────
   *  Hero
   *  ───────────────────────── */
  heroCard: { borderRadius: 26, overflow: 'hidden' },

  // gradient/top bar area (HeroHeader uses these)
  heroTop: { height: 132, position: 'relative' },

  // subtle glows like the mock (orange/purple)
  heroCoverImg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '300%',
    resizeMode: 'cover',
    },

    heroCoverScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: "-120%",
    backgroundColor: 'rgba(0,0,0,0.42)', // dark enough for white text
    },

  heroGlow: {
    position: 'absolute',
    right: -56,
    top: -46,
    width: 190,
    height: 190,
    borderRadius: 120,
    opacity: 0.55,
  },
  heroGlow2: {
    position: 'absolute',
    left: -52,
    bottom: -72,
    width: 210,
    height: 210,
    borderRadius: 140,
    opacity: 0.35,
  },

  heroBody: {
    flexDirection: 'row',
    gap: 14,
    padding: 16,
    alignItems: 'center',
  },

  avatarWrap: {
    width: 94,
    height: 94,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: 94, height: 94, borderRadius: 30 },

  heroName: { fontSize: 22, fontWeight: '800' },
  heroHandle: { fontSize: 12, marginTop: 2 },
  heroHeadline: { fontSize: 13, marginTop: 6, lineHeight: 18 },

  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    flexWrap: 'wrap',
  },

  pill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  pillText: { fontSize: 12, fontWeight: '800' },

  /** ─────────────────────────
   *  Stats chips (mock-like)
   *  ───────────────────────── */
  statRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 8,
  },

  statChip: {
    minWidth: 112,
    flexGrow: 1,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 4,
    ...Platform.select({
      ios: {
        shadowOpacity: 0.08,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 6 },
      },
      android: { elevation: 2 },
      default: {},
    }),
  },

  statLabel: { fontSize: 12, fontWeight: '700' },
  statValue: { fontSize: 20, fontWeight: '900' },
  statMeta: { fontSize: 12 },

  /** ─────────────────────────
   *  Section headers
   *  ───────────────────────── */
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },

  title: { fontSize: 18, fontWeight: '900' },
  link: { fontWeight: '900' },

  /** ─────────────────────────
   *  Rows / Items
   *  ───────────────────────── */
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },

  itemInfo: { flex: 1, gap: 4 },

  itemTitle: { fontSize: 14, fontWeight: '800' },

  subtext: { fontSize: 12 },

  thumb: { width: 48, height: 48, borderRadius: 14 },

  rowActions: { flexDirection: 'row', gap: 12 },

  /** ─────────────────────────
   *  Chips
   *  ───────────────────────── */
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999 },

  /** ─────────────────────────
   *  Actions
   *  ───────────────────────── */
  actionRow: { flexDirection: 'row', gap: 12 },

  /** ─────────────────────────
   *  Edit media (Edit Profile sheet)
   *  ───────────────────────── */
  editMediaRow: { flexDirection: 'row', gap: 12 },

  mediaPickCard: {
    borderRadius: 16,
    padding: 12,
    gap: 10,
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
  },

  mediaPickImage: {
    width: 66,
    height: 66,
    borderRadius: 22,
  },

  mediaPickImageWide: {
    width: '100%',
    height: 92,
    borderRadius: 14,
  },

  mediaPickLabel: { fontSize: 13, fontWeight: '800' },

  /** ─────────────────────────
   *  Privacy sheet
   *  ───────────────────────── */
  privacyRow: {
    gap: 8,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },

  privacyLabel: { fontWeight: '800' },

  privacyOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  privacyChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },

  /** ─────────────────────────
   *  Wallet sheet
   *  ───────────────────────── */
  walletModeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  walletModeChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },

  /** ─────────────────────────
   *  Upgrade sheet
   *  ───────────────────────── */
  tierCard: {
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    gap: 10,
  },

  tierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  tierTitle: { fontSize: 16, fontWeight: '900' },
  tierTagline: { marginTop: 4, fontSize: 13 },

  tierBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  tierBadgeText: { fontSize: 12, fontWeight: '900' },

  tierPrice: { fontSize: 20, fontWeight: '900' },
  tierHighlight: { fontSize: 13, fontWeight: '800' },

  tierFeatures: { gap: 6, marginTop: 2 },

  tierFeatureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  tierFeatureText: { fontSize: 13, fontWeight: '600' },

  tierActionRow: { marginTop: 8 },

  /** ─────────────────────────
   *  Overlay slide + sheet host
   *  ───────────────────────── */
  slideContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: SCREEN_WIDTH,
    right: 0,
    elevation: 25,
    zIndex: 99,
  },

  sheetWrap: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: SCREEN_WIDTH,
    zIndex: 120,
  },

  sheet: {
    marginTop: 80,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: 16,
    flex: 1,
  },
});
