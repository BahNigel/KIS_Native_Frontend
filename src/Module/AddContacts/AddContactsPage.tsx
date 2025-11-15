// src/screens/chat/AddContactsPage.tsx

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  RefreshControl,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useKISTheme } from '../../theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';
import { KIS_TOKENS } from '../../theme/constants';
import { KISContact, KISDeviceContact, markRegisteredOnBackend, refreshFromDeviceAndBackend, saveContactToDevice } from './contactsService';
import { EntryActionRow } from './components/EntryActionRow';
import { ContactRow } from './components/ContactRow';
import { AddContactForm } from './components/AddContactForm';
import { addContactsStyles as styles } from './addContactsStyles';


export type AddContactsPageProps = {
  onClose: () => void;
};

const CACHE_KEY = 'kis.contacts.cache.v1';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const AddContactsPage: React.FC<AddContactsPageProps> = ({ onClose }) => {
  const { palette } = useKISTheme();
  const insets = useSafeAreaInsets();

  const [contacts, setContacts] = useState<KISContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 'list' = entry page, 'add' = slide-in add-contact form
  const [mode, setMode] = useState<'list' | 'add'>('list');
  const slideX = useRef(new Animated.Value(0)).current;

  // Animate between pages
  useEffect(() => {
    Animated.timing(slideX, {
      toValue: mode === 'list' ? 0 : -SCREEN_WIDTH,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [mode, slideX]);

  // Load contacts from cache, then refresh from device/backend
  const loadContacts = useCallback(async () => {
    setError(null);
    setLoading(true);

    try {
      // 1) try cache
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed: KISContact[] = JSON.parse(cached);
        setContacts(parsed);
      }

      // 2) always refresh from "device + backend"
      const fresh = await refreshFromDeviceAndBackend();
      setContacts(fresh);
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(fresh));
    } catch (e) {
      console.warn('Error loading contacts:', e);
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
      setContacts(fresh);
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(fresh));
    } catch (e) {
      console.warn('Refresh error:', e);
      setError('Could not refresh contacts.');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  const onOpenAddContact = () => {
    setMode('add');
  };

  const onCloseAddContact = () => {
    setMode('list');
  };

  // When a contact is added from inside the app:
  const handleContactAddedFromApp = async (payload: {
    name: string;
    phone: string;
    countryCode: string;
  }) => {
    // 1) Add to device contacts (TODO: implement with react-native-contacts)
    await saveContactToDevice(payload);

    // 2) Ask backend if this contact is on KIS
    const newDeviceContact: KISDeviceContact = {
      id: Date.now().toString(),
      name: payload.name.trim(),
      phone: `${payload.countryCode} ${payload.phone.trim()}`,
    };

    const [marked] = await markRegisteredOnBackend([newDeviceContact]);

    // 3) Update local list + cache
    const updated = [marked, ...contacts];
    setContacts(updated);
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(updated));

    // 4) Go back to list
    setMode('list');
  };

  const kisContacts = contacts.filter((c) => c.isRegistered);
  const inviteContacts = contacts.filter((c) => !c.isRegistered);

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
          onPress={mode === 'list' ? onClose : onCloseAddContact}
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
          {mode === 'list' ? 'Select contact' : 'New contact'}
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
        {/* ENTRY PAGE: NEW GROUP / COMMUNITY / CONTACT + CONTACT LIST */}
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
          >
            {/* Quick actions (like WhatsApp) */}
            <EntryActionRow
              icon="people"
              title="New group"
              subtitle="Create a group with your contacts"
              palette={palette}
              onPress={() => {
                Alert.alert('New group', 'Implement New Group flow later.');
              }}
            />
            <EntryActionRow
              icon="megaphone"
              title="New community"
              subtitle="Start a community for your audience"
              palette={palette}
              onPress={() => {
                Alert.alert(
                  'New community',
                  'Implement New Community flow later.',
                );
              }}
            />
            <EntryActionRow
              icon="add"
              title="New contact"
              subtitle="Add a new contact to your phone"
              palette={palette}
              onPress={onOpenAddContact}
            />

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
                    onPress={() => {
                      // TODO: navigate to chat with this contact
                      Alert.alert(
                        'Open chat',
                        `Would open chat with ${c.name} here.`,
                      );
                    }}
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
                    onPress={() => {
                      // TODO: open SMS / share sheet to invite user
                      Alert.alert(
                        'Invite contact',
                        `Would send invite to ${c.name} (${c.phone}).`,
                      );
                    }}
                    showInvite
                  />
                ))}
              </View>
            )}

            {/* No contacts */}
            {!loading && contacts.length === 0 && !error && (
              <View style={{ marginTop: 40, alignItems: 'center' }}>
                <Text style={{ color: palette.subtext, fontSize: 13 }}>
                  No contacts yet. Pull down to refresh or add a new contact.
                </Text>
              </View>
            )}
          </ScrollView>
        </View>

        {/* SLIDE-IN NEW CONTACT FORM PAGE */}
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
              <AddContactForm
                palette={palette}
                onSubmit={handleContactAddedFromApp}
              />
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Animated.View>
    </View>
  );
};

export default AddContactsPage;
