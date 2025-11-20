// src/screens/chat/AddContactsPage.tsx

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  RefreshControl,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Alert,
  useWindowDimensions,
  TextInput,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useKISTheme } from '../../theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';
import { KIS_TOKENS } from '../../theme/constants';
import {
  KISContact,
  KISDeviceContact,
  markRegisteredOnBackend,
  refreshFromDeviceAndBackend,
  saveContactToDevice,
} from './contactsService';
import { EntryActionRow } from './components/EntryActionRow';
import { ContactRow } from './components/ContactRow';
import { AddContactForm } from './components/AddContactForm';
import { NewGroupForm } from './components/NewGroupForm';
import { NewCommunityForm } from './components/NewCommunityForm';
import { addContactsStyles as styles } from './addContactsStyles';
import type { Chat } from '@/Module/ChatRoom/componets/messagesUtils';

export type AddContactsPageProps = {
  onClose: () => void;
  onOpenChat: (chat: Chat) => void;
};

const CONTACTS_CACHE_KEY = 'kis.contacts.cache.v1';

// 🔐 Local cache for *all user chats* (direct, groups, communities, channels)
const USER_CHATS_CACHE_KEY = 'kis.user_chats.cache.v1';

// 🔗 TODO: replace with real public download / invite link
const KIS_INVITE_LINK = 'https://your-kis-download-link';

// 🔁 Helper: merge by phone, never downgrading isRegistered from true → false
const mergeContactsByPhone = (
  previous: KISContact[],
  next: KISContact[],
): KISContact[] => {
  const prevMap = new Map<string, KISContact>();
  previous.forEach((c) => {
    prevMap.set(c.phone, c);
  });

  return next.map((c) => {
    const prev = prevMap.get(c.phone);
    if (!prev) return c;

    return {
      ...c,
      isRegistered: c.isRegistered || prev.isRegistered,
    };
  });
};

// 📨 Build a nice invite message
const buildInviteMessage = (contact: KISContact): string => {
  const firstName = contact.name?.split(' ')[0] ?? '';
  const greet = firstName ? `Hey ${firstName},` : 'Hey,';
  return (
    `${greet} I’m using KIS (Kingdom Impact Social), a new app for believers to connect, share prayer requests, join Bible-centered communities and chat in a distraction-free, faith-first space.\n\n` +
    `I’d love to stay in touch with you there. Download KIS and sign up with your phone number so we can chat: ${KIS_INVITE_LINK}`
  );
};

// 📱 Launch SMS app with invite text
const sendSmsInvite = async (contact: KISContact) => {
  try {
    const message = buildInviteMessage(contact);
    const phone = contact.phone.replace(/[^0-9+]/g, '');
    const separator = Platform.OS === 'ios' ? '&' : '?';
    const url = `sms:${phone}${separator}body=${encodeURIComponent(message)}`;

    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      Alert.alert(
        'Cannot open Messages',
        'Your device could not open the SMS app.',
      );
      return;
    }
    await Linking.openURL(url);
  } catch (e) {
    Alert.alert('Error', 'Could not open SMS app.');
  }
};

// 💬 Launch WhatsApp with invite text
const sendWhatsAppInvite = async (contact: KISContact) => {
  try {
    const message = buildInviteMessage(contact);
    const phone = contact.phone.replace(/[^0-9+]/g, '');
    const url = `whatsapp://send?phone=${phone}&text=${encodeURIComponent(
      message,
    )}`;

    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      Alert.alert(
        'WhatsApp not available',
        'WhatsApp does not seem to be installed on this device.',
      );
      return;
    }
    await Linking.openURL(url);
  } catch (e) {
    Alert.alert('Error', 'Could not open WhatsApp.');
  }
};

type Mode = 'list' | 'addContact' | 'addGroup' | 'addCommunity';

/**
 * Append a chat to the local "user chats" cache.
 *
 * This cache is meant to hold ALL chats the user is part of:
 * - direct chats
 * - groups
 * - communities
 * - channels
 */
const appendChatToUserChats = async (chat: Chat) => {
  try {
    const existingRaw = await AsyncStorage.getItem(USER_CHATS_CACHE_KEY);
    let existing: Chat[] = [];
    if (existingRaw) {
      existing = JSON.parse(existingRaw);
    }

    // De-dupe by id, but keep newest version at the front
    const filtered = existing.filter((c) => c.id !== chat.id);
    const next = [chat, ...filtered];

    await AsyncStorage.setItem(USER_CHATS_CACHE_KEY, JSON.stringify(next));
  } catch (e) {
    console.warn('[appendChatToUserChats] Failed to update cache:', e);
    // Non-fatal: we don’t block UX if cache fails
  }
};

export const AddContactsPage: React.FC<AddContactsPageProps> = ({
  onClose,
  onOpenChat,
}) => {
  const { palette } = useKISTheme();
  const insets = useSafeAreaInsets();
  const { width: SCREEN_WIDTH } = useWindowDimensions();

  const [contacts, setContacts] = useState<KISContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');

  // 'list' = entry page, 'addContact' / 'addGroup' / 'addCommunity' = slide-in second page
  const [mode, setMode] = useState<Mode>('list');
  const slideX = useRef(new Animated.Value(0)).current;

  // Animate between pages
  useEffect(() => {
    Animated.timing(slideX, {
      toValue: mode === 'list' ? 0 : -SCREEN_WIDTH,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [mode, SCREEN_WIDTH, slideX]);

  // Load contacts from cache, then refresh from device + backend
  const loadContacts = useCallback(async () => {
    setError(null);
    setLoading(true);

    let cachedContacts: KISContact[] = [];

    try {
      // 1) Cache for instant UI
      const cached = await AsyncStorage.getItem(CONTACTS_CACHE_KEY);
      if (cached) {
        cachedContacts = JSON.parse(cached);
        setContacts(cachedContacts);
      }

      // 2) Always refresh from device + backend
      const fresh = await refreshFromDeviceAndBackend();
      const merged = mergeContactsByPhone(cachedContacts, fresh);

      setContacts(merged);
      await AsyncStorage.setItem(CONTACTS_CACHE_KEY, JSON.stringify(merged));
    } catch (e) {
      console.warn(`Error loading contacts: ${String(e)}`);
      setError('Could not load contacts. Pull down to retry.');
    } finally {
      setLoading(false);
    }
  }, []);

  const onRefresh = async () => {
    setError(null);
    setRefreshing(true);
    try {
      const fresh = await refreshFromDeviceAndBackend();
      const merged = mergeContactsByPhone(contacts, fresh);

      setContacts(merged);
      await AsyncStorage.setItem(CONTACTS_CACHE_KEY, JSON.stringify(merged));
    } catch (e) {
      console.warn(`Refresh error: ${String(e)}`);
      setError('Could not refresh contacts.');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  const onOpenAddContact = () => {
    setMode('addContact');
  };

  const onOpenAddGroup = () => {
    setMode('addGroup');
  };

  const onOpenAddCommunity = () => {
    setMode('addCommunity');
  };

  const onCloseDetailPage = () => {
    setMode('list');
  };

  // When a contact is added via the in-app form:
  const handleContactAddedFromApp = async (payload: {
    name: string;
    phone: string;
    countryCode: string;
  }) => {
    try {
      await saveContactToDevice(payload);

      const newDeviceContact: KISDeviceContact = {
        id: Date.now().toString(),
        name: payload.name.trim(),
        phone: payload.phone,
      };

      const [marked] = await markRegisteredOnBackend([newDeviceContact]);

      const updated = mergeContactsByPhone(contacts, [marked]);
      const finalList = [marked, ...contacts];

      const phonesSeen = new Set<string>();
      const deduped: KISContact[] = [];
      for (const c of finalList) {
        if (phonesSeen.has(c.phone)) continue;
        phonesSeen.add(c.phone);
        const merged = updated.find((u) => u.phone === c.phone) ?? c;
        deduped.push(merged);
      }

      setContacts(deduped);
      await AsyncStorage.setItem(CONTACTS_CACHE_KEY, JSON.stringify(deduped));

      setMode('list');
    } catch (e) {
      console.warn(`Error handling contact added from app: ${String(e)}`);
      Alert.alert(
        'Error',
        'Could not save the contact. Please try again.',
      );
    }
  };

  // When a group is created successfully
  const handleGroupCreated = async (group: any) => {
    const groupName = group?.name ?? 'New group';
    const conversationId =
      group?.conversation_id ?? group?.conversation ?? group?.id;

    const chat: Chat = {
      id: conversationId,
      title: groupName,
      name: groupName,
      isGroupChat: true,
      groupId: group?.id,
      kind: 'group',
    } as any;

    await appendChatToUserChats(chat);

    onClose();

    setTimeout(() => {
      onOpenChat(chat);
    }, 150);
  };

  // When a community is created successfully
  const handleCommunityCreated = async (community: any) => {
    const communityName = community?.name ?? 'New community';
    const conversationId =
      community?.conversation_id ??
      community?.conversation ??
      community?.id;

    const chat: Chat = {
      id: conversationId,
      title: communityName,
      name: communityName,
      isCommunityChat: true,
      communityId: community?.id,
      kind: 'community',
    } as any;

    await appendChatToUserChats(chat);

    onClose();

    setTimeout(() => {
      onOpenChat(chat);
    }, 150);
  };

  // 🔍 Filter contacts by search term
  const filteredContacts = useMemo(() => {
    if (!searchTerm.trim()) return contacts;
    const q = searchTerm.trim().toLowerCase();

    return contacts.filter((c) => {
      const name = c.name?.toLowerCase() ?? '';
      const phone = c.phone?.toLowerCase() ?? '';
      return name.includes(q) || phone.includes(q);
    });
  }, [contacts, searchTerm]);

  const kisContacts = filteredContacts.filter((c) => c.isRegistered);
  const inviteContacts = filteredContacts.filter((c) => !c.isRegistered);

  const hasSearch = searchTerm.trim().length > 0;
  const noSearchResults =
    hasSearch && kisContacts.length === 0 && inviteContacts.length === 0;

  // 🚪 When tap on a KIS contact → close page + open chat
  const handleKISContactPress = (c: KISContact) => {
    const chat: Chat = {
      id: `contact-${c.phone}`,
      title: c.name,
      name: c.name,
      contactPhone: c.phone,
      isContactChat: true,
      kind: 'direct',
    } as any;

    appendChatToUserChats(chat).catch((e) =>
      console.warn('[handleKISContactPress] cache error:', e),
    );

    onClose();

    setTimeout(() => {
      onOpenChat(chat);
    }, 150);
  };

  // 🚪 When tap on non-KIS contact → offer invite via SMS / WhatsApp
  const handleInviteContactPress = (c: KISContact) => {
    Alert.alert(
      'Invite to KIS',
      `${c.name} is not yet on KIS. How would you like to invite them?`,
      [
        {
          text: 'SMS invite',
          onPress: () => sendSmsInvite(c),
        },
        {
          text: 'WhatsApp invite',
          onPress: () => sendWhatsAppInvite(c),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ],
    );
  };

  const headerTitle =
    mode === 'list'
      ? 'Select contact'
      : mode === 'addContact'
      ? 'New contact'
      : mode === 'addGroup'
      ? 'New group'
      : 'New community';

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: palette.bg,
          paddingTop: insets.top,
        },
      ]}
    >
      {/* HEADER */}
      <View
        style={[
          styles.header,
          {
            borderBottomColor: palette.divider,
            backgroundColor: palette.card,
          },
        ]}
      >
        <Pressable
          onPress={mode === 'list' ? onClose : onCloseDetailPage}
          style={({ pressed }) => [
            styles.headerButton,
            { opacity: pressed ? KIS_TOKENS.opacity.pressed : 1 },
          ]}
        >
          <KISIcon
            name={mode === 'list' ? 'close' : 'arrow-left'}
            size={20}
            color={palette.text}
          />
        </Pressable>
        <Text style={[styles.headerTitle, { color: palette.text }]}>
          {headerTitle}
        </Text>
      </View>

      {/* PAGES CONTAINER */}
      <Animated.View
        style={{
          flex: 1,
          flexDirection: 'row',
          width: SCREEN_WIDTH * 2,
          transform: [{ translateX: slideX }],
        }}
      >
        {/* ENTRY PAGE: actions + CONTACT LIST */}
        <View style={{ width: SCREEN_WIDTH }}>
          <ScrollView
            style={styles.body}
            contentContainerStyle={{ paddingBottom: 32 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={palette.primary}
              />
            }
            keyboardShouldPersistTaps="handled"
          >
            {/* Quick actions */}
            <EntryActionRow
              icon="people"
              title="New group"
              subtitle="Create a group with your contacts"
              palette={palette}
              onPress={onOpenAddGroup}
            />
            <EntryActionRow
              icon="megaphone"
              title="New community"
              subtitle="Start a community for your audience"
              palette={palette}
              onPress={onOpenAddCommunity}
            />
            <EntryActionRow
              icon="add"
              title="New contact"
              subtitle="Add a new contact to your phone"
              palette={palette}
              onPress={onOpenAddContact}
            />

            {/* 🔍 Search box */}
            <View
              style={{
                marginTop: 16,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: palette.inputBorder,
                backgroundColor: palette.card,
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 10,
                paddingVertical: 6,
              }}
            >
              <KISIcon name="search" size={16} color={palette.subtext} />
              <TextInput
                value={searchTerm}
                onChangeText={setSearchTerm}
                placeholder="Search contacts by name or number"
                placeholderTextColor={palette.subtext}
                style={{
                  flex: 1,
                  marginLeft: 6,
                  paddingVertical: 4,
                  color: palette.text,
                  fontSize: 14,
                }}
              />
              {hasSearch && (
                <Pressable
                  onPress={() => setSearchTerm('')}
                  style={({ pressed }) => ({
                    padding: 4,
                    opacity: pressed ? KIS_TOKENS.opacity.pressed : 1,
                  })}
                >
                  <KISIcon name="close" size={14} color={palette.subtext} />
                </Pressable>
              )}
            </View>

            {/* Error / loading hints */}
            {error ? (
              <Text
                style={[
                  styles.errorText,
                  { color: palette.error ?? '#e53935', marginTop: 8 },
                ]}
              >
                {error}
              </Text>
            ) : null}
            {loading && !refreshing ? (
              <Text
                style={{
                  color: palette.subtext,
                  marginTop: 8,
                  fontSize: 13,
                }}
              >
                Loading contacts…
              </Text>
            ) : null}

            {/* No results for search */}
            {noSearchResults && !loading && !error && (
              <View style={{ marginTop: 24 }}>
                <Text
                  style={{
                    color: palette.subtext,
                    fontSize: 13,
                  }}
                >
                  No contacts match “{searchTerm.trim()}”.
                </Text>
              </View>
            )}

            {/* ON KIS SECTION */}
            {kisContacts.length > 0 && (
              <View style={{ marginTop: 24 }}>
                <Text
                  style={[
                    styles.sectionTitle,
                    { color: palette.subtext },
                  ]}
                >
                  On KIS
                </Text>
                {kisContacts.map((c) => (
                  <ContactRow
                    key={c.id}
                    contact={c}
                    palette={palette}
                    onPress={() => handleKISContactPress(c)}
                    showInvite={false}
                  />
                ))}
              </View>
            )}

            {/* INVITE SECTION */}
            {inviteContacts.length > 0 && (
              <View style={{ marginTop: 24 }}>
                <Text
                  style={[
                    styles.sectionTitle,
                    { color: palette.subtext },
                  ]}
                >
                  Invite to KIS
                </Text>
                {inviteContacts.map((c) => (
                  <ContactRow
                    key={c.id}
                    contact={c}
                    palette={palette}
                    onPress={() => handleInviteContactPress(c)}
                    showInvite
                  />
                ))}
              </View>
            )}

            {/* No contacts at all */}
            {!loading &&
              contacts.length === 0 &&
              !error &&
              !hasSearch && (
                <View style={{ marginTop: 40, alignItems: 'center' }}>
                  <Text
                    style={{ color: palette.subtext, fontSize: 13 }}
                  >
                    No contacts yet. Pull down to refresh or add a new
                    contact.
                  </Text>
                </View>
              )}
          </ScrollView>
        </View>

        {/* SLIDE-IN FORM PAGE (Contact OR Group OR Community) */}
        <View style={{ width: SCREEN_WIDTH }}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <ScrollView
              style={styles.body}
              contentContainerStyle={{ paddingBottom: 32 }}
              keyboardShouldPersistTaps="handled"
            >
              {mode === 'addGroup' ? (
                <NewGroupForm
                  palette={palette}
                  onSuccess={handleGroupCreated}
                />
              ) : mode === 'addCommunity' ? (
                <NewCommunityForm
                  palette={palette}
                  onSuccess={handleCommunityCreated}
                />
              ) : (
                <AddContactForm
                  palette={palette}
                  onSubmit={handleContactAddedFromApp}
                />
              )}
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Animated.View>
    </View>
  );
};

export default AddContactsPage;
