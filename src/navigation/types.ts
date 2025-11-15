// src/navigation/types.ts
export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  DeviceVerification: { phone?: string | null; email?: string | null } | undefined;
  MainTabs: undefined;
};
