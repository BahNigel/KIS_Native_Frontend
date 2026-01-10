import React from 'react';
import { View } from 'react-native';
import styles from '@/components/partners/partnersStyles';
import PartnersLeftRail from '@/components/partners/PartnersLeftRail';
import PartnersCenterPane from '@/components/partners/PartnersCenterPane';
import PartnersMessagesPane from '@/components/partners/PartnersMessagesPane';
import PartnerSheet from '@/components/partners/PartnerSheet';
import PartnerPanels from './PartnerPanels';

type Props = {
  palette: any;
  rootPanHandlers: Record<string, any>;
  partners: any[];
  selectedPartnerId: string | null;
  setSelectedPartnerId: (id: string | null) => void;
  onAddPartnerPress: () => void;
  onLogout: () => void;
  selectedPartner: any | null;
  selectedGroupId: string | null;
  selectedChannelId: string | null;
  selectedFeed: string | null;
  selectedCommunityFeedId: string | null;
  rootGroups: any[];
  rootChannels: any[];
  groupsForPartner: any[];
  channelsForPartner: any[];
  communitiesForPartner: any[];
  expandedCommunities: Record<string, boolean>;
  toggleCommunity: (id: string) => void;
  onGroupPress: (id: string) => void;
  onChannelPress: (id: string) => void;
  onFeedPress: () => void;
  onCommunityFeedPress: (id: string) => void;
  onPartnerHeaderPress: () => void;
  width: number;
  messagesOffsetAnim: any;
  isMessagesExpanded: boolean;
  toggleMessagesPane: () => void;
  handleCloseMessages: () => void;
  onOpenInfo: any;
  isPartnerSheetOpen: boolean;
  sheetHeight: number;
  sheetOffsetAnim: any;
  overlayOpacity: any;
  sheetPanHandlers: any;
  communitiesCount: number;
  groupsCount: number;
  channelsCount: number;
  partnerRole: any;
  settingsSections: any[];
  openSection: (sectionKey: string) => void;
  onOpenCreate: (kind: 'community' | 'group' | 'channel') => void;
  animatePartnerSheet: (open: boolean) => void;
  panels: {
    settingsPanel: any;
    createPanel: any;
    discoveryPanel: any;
    recruitmentPanel: any;
    auditPanel: any;
    policyPanel: any;
    integrationsPanel: any;
    automationPanel: any;
    reportsPanel: any;
    governancePanel: any;
    featurePanel: any;
    orgProfilePanel: any;
    coursesPanel: any;
  };
};

export default function PartnerLayout({
  palette,
  rootPanHandlers,
  partners,
  selectedPartnerId,
  setSelectedPartnerId,
  onAddPartnerPress,
  onLogout,
  selectedPartner,
  selectedGroupId,
  selectedChannelId,
  selectedFeed,
  selectedCommunityFeedId,
  rootGroups,
  rootChannels,
  groupsForPartner,
  channelsForPartner,
  communitiesForPartner,
  expandedCommunities,
  toggleCommunity,
  onGroupPress,
  onChannelPress,
  onFeedPress,
  onCommunityFeedPress,
  onPartnerHeaderPress,
  width,
  messagesOffsetAnim,
  isMessagesExpanded,
  toggleMessagesPane,
  handleCloseMessages,
  onOpenInfo,
  isPartnerSheetOpen,
  sheetHeight,
  sheetOffsetAnim,
  overlayOpacity,
  sheetPanHandlers,
  communitiesCount,
  groupsCount,
  channelsCount,
  partnerRole,
  settingsSections,
  openSection,
  onOpenCreate,
  animatePartnerSheet,
  panels,
}: Props) {
  return (
    <View
      style={[styles.root, { backgroundColor: palette.bg }]}
      {...rootPanHandlers}
    >
      <PartnersLeftRail
        partners={partners}
        selectedPartnerId={selectedPartnerId}
        onSelectPartner={setSelectedPartnerId}
        onAddPartnerPress={onAddPartnerPress}
        onLogout={onLogout}
      />

      <PartnersCenterPane
        selectedPartner={selectedPartner}
        isReadOnly={selectedPartner?.member_role === 'readonly'}
        selectedGroupId={selectedGroupId}
        selectedChannelId={selectedChannelId}
        rootGroups={rootGroups}
        rootChannels={rootChannels}
        groupsForPartner={groupsForPartner}
        communitiesForPartner={communitiesForPartner}
        expandedCommunities={expandedCommunities}
        onToggleCommunity={toggleCommunity}
        onGroupPress={onGroupPress}
        onChannelPress={onChannelPress}
        onFeedPress={onFeedPress}
        onCommunityFeedPress={onCommunityFeedPress}
        onPartnerHeaderPress={onPartnerHeaderPress}
      />

      <PartnersMessagesPane
        width={width}
        messagesOffsetAnim={messagesOffsetAnim}
        isMessagesExpanded={isMessagesExpanded}
        toggleMessagesPane={toggleMessagesPane}
        closeMessagesPane={handleCloseMessages}
        selectedGroupId={selectedGroupId}
        selectedChannelId={selectedChannelId}
        selectedFeed={selectedFeed}
        selectedCommunityFeedId={selectedCommunityFeedId}
        groupsForPartner={groupsForPartner}
        channelsForPartner={channelsForPartner}
        communitiesForPartner={communitiesForPartner}
        selectedPartner={selectedPartner}
        onOpenInfo={onOpenInfo}
      />

      <PartnerSheet
        isOpen={isPartnerSheetOpen}
        sheetHeight={sheetHeight}
        sheetOffsetAnim={sheetOffsetAnim}
        overlayOpacity={overlayOpacity}
        sheetPanHandlers={sheetPanHandlers}
        selectedPartner={selectedPartner}
        communitiesCount={communitiesCount}
        groupsCount={groupsCount}
        channelsCount={channelsCount}
        partnerRole={partnerRole}
        sections={settingsSections}
        onOpenSettingsSection={openSection}
        onOpenCreate={onOpenCreate}
        animatePartnerSheet={animatePartnerSheet}
      />

      <PartnerPanels
        selectedPartnerId={selectedPartner?.id}
        settingsPanel={panels.settingsPanel}
        createPanel={panels.createPanel}
        discoveryPanel={panels.discoveryPanel}
        recruitmentPanel={panels.recruitmentPanel}
        auditPanel={panels.auditPanel}
        policyPanel={panels.policyPanel}
        integrationsPanel={panels.integrationsPanel}
        automationPanel={panels.automationPanel}
        reportsPanel={panels.reportsPanel}
        governancePanel={panels.governancePanel}
        featurePanel={panels.featurePanel}
        orgProfilePanel={panels.orgProfilePanel}
        coursesPanel={panels.coursesPanel}
      />
    </View>
  );
}
