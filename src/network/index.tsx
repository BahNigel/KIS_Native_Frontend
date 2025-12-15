// network/routes/index.ts
import { Platform } from 'react-native';

/**
 * Set USE_EMULATOR = true when testing on Android/iOS emulator/simulator.
 * Set USE_EMULATOR = false when testing on a real device connected via Wi-Fi.
 */
const USE_EMULATOR = true;
const LAN_IP = '127.0.0.1'; // Change only when using real device on LAN

// Django API (HTTP)
const API_PORT = 8000;

// KIS Chat backend (NestJS + Fastify)
const CHAT_PORT = 4000;

const API_BASE = 'http://localhost:8000/api/v1';
export const BG_REMOVAL_START_URL = `${API_BASE}/remove-background/`;
export const BG_REMOVAL_STATUS_URL = (jobId: string) => `${API_BASE}/gbJobs/${jobId}/`;


const emulatorHost = Platform.OS === 'android' ? '10.0.2.2' : '127.0.0.1';
const host = USE_EMULATOR ? emulatorHost : LAN_IP;
console.log('KIS host =', host);

// Django API base
export const API_BASE_URL = `http://${host}:${API_PORT}`;

// Chat backend base (Nest)
export const CHAT_BASE_URL = `http://${host}:${CHAT_PORT}`;

// Socket.IO websocket endpoint (Nest gateway)
// NOTE: Socket.IO client uses http(s) scheme; path is where the WS upgrade happens.
export const CHAT_WS_URL = CHAT_BASE_URL;
export const CHAT_WS_PATH = '/ws';

// File uploads to Nest backend
export const CHAT_UPLOAD_URL = `${CHAT_BASE_URL}/uploads/file`;

// Backwards-compat: old WEBSOCKET_URL now points to the Nest chat backend
export const WEBSOCKET_URL = CHAT_WS_URL;

export const NEST_API_BASE_URL = 'http://localhost:4000'; // or from env/config

const ROUTES = {
  auth: {
    login: `${API_BASE_URL}/api/v1/auth/login/`,
    register: `${API_BASE_URL}/api/v1/auth/register/`,
    logout: `${API_BASE_URL}/api/v1/auth/logout/`,
    checkLogin: `${API_BASE_URL}/api/v1/users/me/`,
    otp: `${API_BASE_URL}/api/v1/auth/otp/initiate/`,
    sendDeviceCode: `${API_BASE_URL}/api/v1/auth/otp/verify/`,
    status: `${API_BASE_URL}/api/v1/auth/otp/status`,
    checkContact: `${API_BASE_URL}/api/v1/contacts/check`
  },
  user: {
    profile: `${API_BASE_URL}/user-info/`,
    updateProfile: `${API_BASE_URL}/user-info/update/`,
    preferences: `${API_BASE_URL}/privacy-settings/`,
  },
  contacts: {
    check: `${API_BASE_URL}/user/check-contacts/`,
  },
  messaging: {
    getMessages: `${API_BASE_URL}/messages/fetch_messages/`,
    sendMessage: `${API_BASE_URL}/messages/send_message/`,
    exchangeKeys: `${API_BASE_URL}/messages/exchange_keys/`,
  },
  channels: {
    getAllChannels: `${API_BASE_URL}/channels/`,
    getChannelById: (id: string) => `${API_BASE_URL}/channels/${id}/`,
    createChannel: `${API_BASE_URL}/channels/create/`,
    addMembersToChannel: `${API_BASE_URL}/channels/add-members/`,
    getChannelMembers: (channelId: string) =>
      `${API_BASE_URL}/channels/${channelId}/members/`,
  },
  subchannels: {
    getAllSubchannels: `${API_BASE_URL}/subchannels/`,
    getSubchannelById: (id: string) => `${API_BASE_URL}/subchannels/${id}/`,
    createSubchannel: `${API_BASE_URL}/subchannels/create/`,
    getSubchannelMembers: (id: string) =>
      `${API_BASE_URL}/subchannels/${id}/members/`,
  },
  groups: {
    createGroup: `${API_BASE_URL}/api/v1/groups/`,
    getAllGroups: `${API_BASE_URL}/groups/`,
    getGroupById: (id: string) => `${API_BASE_URL}/groups/${id}/`,
    addMembersToGroup: `${API_BASE_URL}/groups/members/`,
    getGroupMembers: (id: string) =>
      `${API_BASE_URL}/groups/${id}/members/`,
  },
  permissions: {
    getPermissionTypes: `${API_BASE_URL}/permissions/types/`,
    assignPermission: `${API_BASE_URL}/permissions/assign/`,
    removeUserRole: `${API_BASE_URL}/permissions/remove-user-role/`,
  },
  securityActions: {
    getSecurityActions: (id: string) =>
      `${API_BASE_URL}/security-actions/${id}/`,
  },
  chat: {
    // Django DRF ConversationViewSet @action(detail=False, url_path='direct')
    directConversation: `${API_BASE_URL}/api/v1/conversations/direct/`,
    listConversations: `${API_BASE_URL}/api/v1/conversations/`,
  },
  community: {
    followCommunity: `${API_BASE_URL}/community_action/`,
    createCommunity: `${API_BASE_URL}/api/v1/communities/`,
  },
  partners: {
    create: `${API_BASE_URL}/api/v1/partners/`
  }
  // Optional: chat backend REST endpoints could be added here later if needed
};

export default ROUTES;
