// src/navigation/types.ts
export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  DeviceVerification: { phone?: string | null; email?: string | null } | undefined;
  MainTabs: undefined;
};

export type BroadcastTabId = 'feeds' | 'education' | 'market' | 'health';

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
  Profile: undefined;
};
