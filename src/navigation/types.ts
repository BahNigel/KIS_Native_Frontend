// src/navigation/types.ts
import type { PartnerOrganizationApp } from '@/screens/tabs/partners/hooks/usePartnerOrganizationApps';

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  DeviceVerification: { phone?: string | null; email?: string | null } | undefined;
  MainTabs: undefined;
  ProfileInsights: undefined;
  PartnerInsights: undefined;
  AdminTools: undefined;
  AdminDashboard: { target: string; title: string };
  AnalyticsDashboard: undefined;
  EventsDashboard: undefined;
  ContentDashboard: undefined;
  SurveysDashboard: undefined;
  MediaDashboard: undefined;
  BridgeDashboard: undefined;
  TiersDashboard: undefined;
  NotificationsDashboard: undefined;
  OrganizationApp: { app: PartnerOrganizationApp };
  OrganizationAppForm: { partnerId: string; app?: PartnerOrganizationApp };
};

export type BroadcastTabId = 'feeds' | 'education' | 'market' | 'health';
export type BroadcastProfileKey = 'broadcast_feed' | 'health' | 'market' | 'education';

export type BroadcastCreationType = 'broadcast_feed' | 'health_profile' | 'market_profile' | 'education_profile';

export type BroadcastRouteParams = {
  focusTab?: BroadcastTabId;
  openCreate?: boolean;
  openManageFeeds?: boolean;
  creationType?: BroadcastCreationType;
  actionId?: string;
};

export type MainTabsParamList = {
  Partners: undefined;
  Bible: undefined;
  Messages: undefined;
  Broadcast: BroadcastRouteParams | undefined;
  Profile: { broadcastProfileKey?: BroadcastProfileKey; educationProfileId?: string } | undefined;
};
