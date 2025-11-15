import React from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

export type KISIconName =
  | 'people'
  | 'book'
  | 'chat'
  | 'megaphone'
  | 'person'
  | 'home'
  | 'search'
  | 'cart'
  | 'bell'
  | 'settings'
  | 'back'
  | 'close'
  | 'check'
  | 'edit'
  | 'add'
  | 'camera'
  | 'mic'
  | 'send'
  | 'filter'
  | 'menu'
  | 'mention'
  | 'unread'
  | 'trash'
  | 'arrow-left'
  | 'pin'
  | 'mute'
  | 'smiley'
  | 'keypad'
  | 'keyboard'
  // Voice
  | 'play'
  | 'pause'
  | 'volume'
  // Message actions
  | 'forward'
  | 'copy'
  | 'more-vert'
  | 'report'
  | 'reply'
  // NEW SUB-ROOM / THREAD / LAYERS ICON
  | 'layers'
  | 'thread'
  | 'sub-channel'
  // NEW optional message info
  | 'info';

type IconPair = { filled: string; outline: string };

type IonMap = Partial<Record<KISIconName, IconPair>>;

const ion: IonMap = {
  // Tabs
  people: { filled: 'people', outline: 'people-outline' },
  book: { filled: 'book', outline: 'book-outline' },
  chat: { filled: 'chatbubble', outline: 'chatbubble-outline' },
  megaphone: { filled: 'megaphone', outline: 'megaphone-outline' },
  person: { filled: 'person', outline: 'person-outline' },

  // UI
  home: { filled: 'home', outline: 'home-outline' },
  search: { filled: 'search', outline: 'search-outline' },
  cart: { filled: 'cart', outline: 'cart-outline' },
  bell: { filled: 'notifications', outline: 'notifications-outline' },
  settings: { filled: 'settings', outline: 'settings-outline' },

  // Navigation
  back: { filled: 'chevron-back', outline: 'chevron-back' },
  'arrow-left': { filled: 'chevron-back', outline: 'chevron-back' },

  // Chat tools
  pin: { filled: 'pin', outline: 'pin-outline' },
  mute: { filled: 'volume-mute', outline: 'volume-mute-outline' },

  // Base
  close: { filled: 'close', outline: 'close' },
  check: { filled: 'checkmark-circle', outline: 'checkmark-circle-outline' },
  edit: { filled: 'create', outline: 'create-outline' },
  add: { filled: 'add-circle', outline: 'add-circle-outline' },
  camera: { filled: 'camera', outline: 'camera-outline' },
  mic: { filled: 'mic', outline: 'mic-outline' },
  send: { filled: 'send', outline: 'send-outline' },

  // Special UI
  filter: { filled: 'options', outline: 'options-outline' },
  menu: { filled: 'ellipsis-vertical', outline: 'ellipsis-vertical' },
  mention: { filled: 'at', outline: 'at-outline' },
  unread: { filled: 'mail-unread', outline: 'mail-unread-outline' },

  // Trash
  trash: { filled: 'trash', outline: 'trash-outline' },

  // Voice messages
  play: { filled: 'play', outline: 'play-outline' },
  pause: { filled: 'pause', outline: 'pause-outline' },
  volume: { filled: 'volume-high', outline: 'volume-high-outline' },

  // Emojis
  smiley: { filled: 'happy', outline: 'happy-outline' },

  keypad: { filled: 'keypad', outline: 'keypad-outline' },

  // Forward messages
  forward: { filled: 'arrow-forward', outline: 'arrow-forward-outline' },

  // Copy
  copy: { filled: 'copy', outline: 'copy-outline' },

  // Vertical menu
  'more-vert': { filled: 'ellipsis-vertical', outline: 'ellipsis-vertical' },

  // Report
  report: { filled: 'alert-circle', outline: 'alert-circle-outline' },

  // Reply
  reply: { filled: 'arrow-undo', outline: 'arrow-undo-outline' },

  // NEW — Sub-rooms (layers)
  layers: { filled: 'layers', outline: 'layers-outline' },

  // Aliases for layers
  thread: { filled: 'layers', outline: 'layers-outline' },
  'sub-channel': { filled: 'layers', outline: 'layers-outline' },

  // NEW — Message info (optional)
  info: { filled: 'information-circle', outline: 'information-circle-outline' },
};

export interface KISIconProps {
  name: KISIconName;
  size?: number;
  color?: string;
  focused?: boolean;
  style?: any;
}

export const KISIcon: React.FC<KISIconProps> = ({
  name,
  size = 22,
  color = '#999',
  focused = false,
  style,
}) => {
  // Material icon overrides
  if (name === 'keyboard') {
    return (
      <MaterialCommunityIcons
        name="keyboard-outline"
        size={size}
        color={color}
        style={style}
      />
    );
  }

  const pair = ion[name] ?? ion['home']!;
  const iconName = focused ? pair.filled : pair.outline;

  return (
    <Ionicons
      name={iconName}
      size={size}
      color={color}
      style={style}
    />
  );
};
