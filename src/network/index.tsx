// network/routes/index.ts
import { Platform } from 'react-native';

/**
 * Set USE_EMULATOR = true when testing on Android/iOS emulator/simulator.
 * Set USE_EMULATOR = false when testing on a real device connected via Wi-Fi.
 */
const USE_EMULATOR = true;
const LAN_IP = '192.168.110.62'; // Change only when using real device on LAN

// Django API (HTTP)
const API_PORT = 8000;

// KIS Chat backend (NestJS + Fastify)
const CHAT_PORT = 4000;

const emulatorHost = Platform.OS === 'android' ? '10.0.2.2' : '127.0.0.1';
const host = USE_EMULATOR ? emulatorHost : LAN_IP;
console.log('KIS host =', host);

// Django API base
export const API_BASE_URL = `http://${host}:${API_PORT}`;

export const BG_REMOVAL_START_URL = `${API_BASE_URL}/api/v1/remove-background/`;
export const BG_REMOVAL_STATUS_URL = (jobId: string) =>
  `${API_BASE_URL}/api/v1/gbJobs/${jobId}/`;

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

export const NEST_API_BASE_URL = CHAT_BASE_URL; // keep in sync with CHAT_BASE_URL

const ROUTES = {
  auth: {
    login: `${API_BASE_URL}/api/v1/auth/login/`,
    register: `${API_BASE_URL}/api/v1/auth/register/`,
    logout: `${API_BASE_URL}/api/v1/auth/logout/`,
    checkLogin: `${API_BASE_URL}/api/v1/users/me/`,
    otp: `${API_BASE_URL}/api/v1/auth/otp/initiate/`,
    sendDeviceCode: `${API_BASE_URL}/api/v1/auth/otp/verify/`,
    status: `${API_BASE_URL}/api/v1/auth/otp/status`,
    forgotPassword: `${API_BASE_URL}/api/v1/auth/password/forgot/`,
    resetPassword: `${API_BASE_URL}/api/v1/auth/password/reset/`,
    e2eeRegisterKeys: `${API_BASE_URL}/api/v1/auth/e2ee/keys/`,
    e2eeFetchBundle: (userId: string) => `${API_BASE_URL}/api/v1/auth/e2ee/keys/${userId}/`,
    checkContact: `${API_BASE_URL}/api/v1/contacts/check`
  },
  user: {
    profile: `${API_BASE_URL}/user-info/`,
    updateProfile: `${API_BASE_URL}/user-info/update/`,
    preferences: `${API_BASE_URL}/privacy-settings/`,
    detail: (id: string) => `${API_BASE_URL}/api/v1/users/${id}/`,
  },
  profiles: {
    me: `${API_BASE_URL}/api/v1/profiles/me/`,
    view: (id: string) => `${API_BASE_URL}/api/v1/profiles/${id}/view/`,
    update: (id: string) => `${API_BASE_URL}/api/v1/profiles/${id}/`,
  },
  profilePrivacy: {
    list: `${API_BASE_URL}/api/v1/profile-privacy/`,
    detail: (id: string) => `${API_BASE_URL}/api/v1/profile-privacy/${id}/`,
  },
  profileArticles: {
    list: `${API_BASE_URL}/api/v1/profile-articles/`,
    detail: (id: string) => `${API_BASE_URL}/api/v1/profile-articles/${id}/`,
  },
  profilePreferences: {
    list: `${API_BASE_URL}/api/v1/profile-preferences/`,
    detail: (id: string) => `${API_BASE_URL}/api/v1/profile-preferences/${id}/`,
    me: `${API_BASE_URL}/api/v1/profile-preferences/me/`,
  },
  profileShowcases: {
    list: `${API_BASE_URL}/api/v1/profile-showcases/`,
    detail: (id: string) => `${API_BASE_URL}/api/v1/profile-showcases/${id}/`,
  },
  profileItems: {
    experiences: `${API_BASE_URL}/api/v1/experiences/`,
    educations: `${API_BASE_URL}/api/v1/educations/`,
    skills: `${API_BASE_URL}/api/v1/skills/`,
    projects: `${API_BASE_URL}/api/v1/projects/`,
    recommendations: `${API_BASE_URL}/api/v1/recommendations/`,
  },
  subscriptions: {
    list: `${API_BASE_URL}/api/v1/subscriptions/`,
    detail: (id: string) => `${API_BASE_URL}/api/v1/subscriptions/${id}/`,
    create: `${API_BASE_URL}/api/v1/subscriptions/`,
  },
  wallet: {
    me: `${API_BASE_URL}/api/v1/wallet/me/`,
    ledger: `${API_BASE_URL}/api/v1/wallet/ledger/`,
    transactions: `${API_BASE_URL}/api/v1/wallet/transactions/`,
    deposit: `${API_BASE_URL}/api/v1/wallet/deposit/`,
    convert: `${API_BASE_URL}/api/v1/wallet/convert/`,
    transfer: `${API_BASE_URL}/api/v1/wallet/transfer/`,
    upgrade: `${API_BASE_URL}/api/v1/wallet/upgrade/`,
    redeem: `${API_BASE_URL}/api/v1/wallet/redeem/`,
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
    getAllChannels: `${API_BASE_URL}/api/v1/channels/`,
    getChannelById: (id: string) => `${API_BASE_URL}/api/v1/channels/${id}/`,
    createChannel: `${API_BASE_URL}/api/v1/channels/`,
    subscribeChannel: (id: string) => `${API_BASE_URL}/api/v1/channels/${id}/subscribe/`,
    addMembersToChannel: (channelId: string) =>
      `${API_BASE_URL}/api/v1/channels/${channelId}/members/`,
    getChannelMembers: (channelId: string) =>
      `${API_BASE_URL}/api/v1/channels/${channelId}/members/`,
  },
  subchannels: {
    getAllSubchannels: `${API_BASE_URL}/subchannels/`,
    getSubchannelById: (id: string) => `${API_BASE_URL}/subchannels/${id}/`,
    createSubchannel: `${API_BASE_URL}/subchannels/create/`,
    getSubchannelMembers: (id: string) =>
      `${API_BASE_URL}/subchannels/${id}/members/`,
  },
  groups: {
    list: `${API_BASE_URL}/api/v1/groups/`,
    create: `${API_BASE_URL}/api/v1/groups/`,
    detail: (id: string) => `${API_BASE_URL}/api/v1/groups/${id}/`,
    members: (id: string) => `${API_BASE_URL}/api/v1/groups/${id}/members/`,
    addMembers: (id: string) => `${API_BASE_URL}/api/v1/groups/${id}/add-members/`,
    join: (id: string) => `${API_BASE_URL}/api/v1/groups/${id}/join/`,
    leave: (id: string) => `${API_BASE_URL}/api/v1/groups/${id}/leave/`,
    requestJoin: (id: string) => `${API_BASE_URL}/api/v1/groups/${id}/request-join/`,
    approveRequest: (id: string) => `${API_BASE_URL}/api/v1/groups/${id}/approve-request/`,
    rejectRequest: (id: string) => `${API_BASE_URL}/api/v1/groups/${id}/reject-request/`,
    ban: (id: string) => `${API_BASE_URL}/api/v1/groups/${id}/ban/`,
    unban: (id: string) => `${API_BASE_URL}/api/v1/groups/${id}/unban/`,
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
    list: `${API_BASE_URL}/api/v1/communities/`,
    create: `${API_BASE_URL}/api/v1/communities/`,
    detail: (id: string) => `${API_BASE_URL}/api/v1/communities/${id}/`,
    members: (id: string) => `${API_BASE_URL}/api/v1/communities/${id}/members/`,
    addMembers: (id: string) => `${API_BASE_URL}/api/v1/communities/${id}/add-members/`,
    join: (id: string) => `${API_BASE_URL}/api/v1/communities/${id}/join/`,
    leave: (id: string) => `${API_BASE_URL}/api/v1/communities/${id}/leave/`,
    requestJoin: (id: string) => `${API_BASE_URL}/api/v1/communities/${id}/request-join/`,
    approveRequest: (id: string) => `${API_BASE_URL}/api/v1/communities/${id}/approve-request/`,
    rejectRequest: (id: string) => `${API_BASE_URL}/api/v1/communities/${id}/reject-request/`,
    ban: (id: string) => `${API_BASE_URL}/api/v1/communities/${id}/ban/`,
    unban: (id: string) => `${API_BASE_URL}/api/v1/communities/${id}/unban/`,
    posts: `${API_BASE_URL}/api/v1/posts/`,
    postDetail: (id: string) => `${API_BASE_URL}/api/v1/posts/${id}/`,
    postComment: (id: string) => `${API_BASE_URL}/api/v1/posts/${id}/comment/`,
    postComments: (id: string) => `${API_BASE_URL}/api/v1/posts/${id}/comments/`,
    postCommentRoom: (id: string) => `${API_BASE_URL}/api/v1/posts/${id}/comment-room/`,
    postReact: (id: string) => `${API_BASE_URL}/api/v1/posts/${id}/react/`,
    postPin: (id: string) => `${API_BASE_URL}/api/v1/posts/${id}/pin/`,
    postUnpin: (id: string) => `${API_BASE_URL}/api/v1/posts/${id}/unpin/`,
    postDelete: (id: string) => `${API_BASE_URL}/api/v1/posts/${id}/delete/`,
    postBroadcast: (id: string) => `${API_BASE_URL}/api/v1/posts/${id}/broadcast/`,
  },
  partners: {
    list: `${API_BASE_URL}/api/v1/partners/`,
    create: `${API_BASE_URL}/api/v1/partners/`,
    detail: (id: string) => `${API_BASE_URL}/api/v1/partners/${id}/`,
    posts: `${API_BASE_URL}/api/v1/partners/posts/`,
    postComment: (id: string) => `${API_BASE_URL}/api/v1/partners/posts/${id}/comment/`,
    postComments: (id: string) => `${API_BASE_URL}/api/v1/partners/posts/${id}/comments/`,
    postCommentRoom: (id: string) => `${API_BASE_URL}/api/v1/partners/posts/${id}/comment-room/`,
    postReact: (id: string) => `${API_BASE_URL}/api/v1/partners/posts/${id}/react/`,
    postDelete: (id: string) => `${API_BASE_URL}/api/v1/partners/posts/${id}/delete/`,
    postBroadcast: (id: string) => `${API_BASE_URL}/api/v1/partners/posts/${id}/broadcast/`,
  },
  moderation: {
    flags: `${API_BASE_URL}/api/v1/flags/`,
    userBlocks: `${API_BASE_URL}/api/v1/user-blocks/`,
  },
  broadcasts: {
    list: `${API_BASE_URL}/api/v1/broadcasts/`,
  },
  statuses: {
    list: `${API_BASE_URL}/api/v1/statuses/`,
    create: `${API_BASE_URL}/api/v1/statuses/`,
    mine: `${API_BASE_URL}/api/v1/statuses/mine/`,
    view: (id: string) => `${API_BASE_URL}/api/v1/statuses/${id}/view/`,
  },
  // Optional: chat backend REST endpoints could be added here later if needed
};

export default ROUTES;
