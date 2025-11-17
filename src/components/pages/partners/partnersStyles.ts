// src/screens/tabs/partnersStyles.ts
import { StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
  },

  // LEFT RAIL
  leftRail: {
    flexDirection: 'column',
    paddingVertical: 8,
    alignItems: 'center',
    borderRightWidth: 1,
  },
  addPartnerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  partnerList: {
    alignItems: 'center',
  },
  partnerAvatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginBottom: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  logoutButton: {
    marginTop: 'auto',
    marginBottom: 4,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // CENTER
  centerPane: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  centerScrollContent: {
    paddingBottom: 24,
  },
  partnerHeader: {
    marginBottom: 12,
  },
  partnerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  partnerName: {
    flex: 1,
    fontSize: 22,
    fontWeight: '900',
    marginRight: 8,
  },
  partnerTagline: {
    fontSize: 13,
    marginTop: 4,
  },

  // Admins
  adminsSection: {
    marginBottom: 12,
  },
  adminsLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  adminsList: {
    paddingVertical: 2,
  },
  adminCard: {
    width: 80,
    marginRight: 10,
    alignItems: 'center',
  },
  adminAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },

  // Sections
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sectionHeaderText: {
    fontSize: 16,
    fontWeight: '700',
  },
  sectionHeaderMeta: {
    fontSize: 12,
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 4,
  },
  groupHash: {
    width: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },

  // Communities
  communityCard: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginTop: 8,
  },
  communityHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  communityGroupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginBottom: 2,
    marginLeft: 4,
  },

  // RIGHT MESSAGES PANE
  messagesPane: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    borderLeftWidth: 1,
  },
  messagesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  toggleButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  messagesTitleWrap: {
    flex: 1,
  },
  messagesTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  messagesSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  messagesBody: {
    flex: 1,
    paddingVertical: 8,
  },
  messagesPlaceholderTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  messagesPlaceholderText: {
    fontSize: 13,
    lineHeight: 18,
  },

  // PARTNER SETTINGS BOTTOM SHEET
  sheetOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheetContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 16,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 48,
    height: 4,
    borderRadius: 2,
    marginBottom: 10,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  sheetSubtitle: {
    fontSize: 13,
    marginBottom: 12,
  },
  sheetSection: {
    marginBottom: 12,
  },
  sheetSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  sheetSectionText: {
    fontSize: 13,
    lineHeight: 18,
  },
});

export default styles;
