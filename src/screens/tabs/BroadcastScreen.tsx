// src/screens/tabs/BroadcastScreen.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, View, Text, StyleSheet, TextInput, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useKISTheme } from '../../theme/useTheme';
import KISButton from '../../constants/KISButton';
import Skeleton from '@/components/common/Skeleton';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { ROUTES } from '@/network';
import { CacheConfig } from '@/network/cacheKeys';
import {
  getCachedProfile,
  getTierFromProfile,
  isBusinessTier,
  normalizeTierName,
} from '@/services/tierAccess';
import NewChannelForm from '@/Module/AddContacts/components/NewChannelForm';

export default function BroadcastScreen() {
  const { palette } = useKISTheme();
  const navigation = useNavigation();
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [channels, setChannels] = useState<any[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [query, setQuery] = useState('');
  const [broadcasts, setBroadcasts] = useState<any[]>([]);
  const [loadingBroadcasts, setLoadingBroadcasts] = useState(false);

  useEffect(() => {
    let mounted = true;
    const loadProfile = async () => {
      const cached = await getCachedProfile();
      if (mounted && cached) setProfile(cached);
      const res = await getRequest(ROUTES.profiles.me, {
        cacheKey: CacheConfig.userProfile.key,
        cacheType: CacheConfig.userProfile.type,
      });
      if (mounted) {
        if (res.success) setProfile(res.data);
        setLoading(false);
      }
    };
    loadProfile();
    return () => {
      mounted = false;
    };
  }, []);

  const accountTier = useMemo(() => getTierFromProfile(profile), [profile]);
  const tierLabel = useMemo(() => {
    const name = normalizeTierName(accountTier);
    return name ? name.replace(/\b\w/g, (char) => char.toUpperCase()) : 'Free';
  }, [accountTier]);
  const canUseBroadcast = isBusinessTier(accountTier);

  const loadBroadcasts = useCallback(async () => {
    setLoadingBroadcasts(true);
    const res = await getRequest(ROUTES.broadcasts.list, {
      errorMessage: 'Unable to load broadcasts.',
    });
    if (res?.success) {
      const payload = res.data?.results ?? res.data ?? [];
      setBroadcasts(Array.isArray(payload) ? payload : []);
    }
    setLoadingBroadcasts(false);
  }, []);

  const loadChannels = useCallback(
    async (search: string) => {
      setLoadingChannels(true);
      const q = search.trim();
      const url = q
        ? `${ROUTES.channels.getAllChannels}?q=${encodeURIComponent(q)}`
        : ROUTES.channels.getAllChannels;
      const res = await getRequest(url, {
        errorMessage: 'Unable to load channels.',
      });
      if (res.success) {
        const payload = res.data?.results ?? res.data ?? [];
        setChannels(Array.isArray(payload) ? payload : []);
      }
      setLoadingChannels(false);
    },
    [setChannels],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      loadChannels(query);
    }, 250);
    return () => clearTimeout(timer);
  }, [query, loadChannels]);

  useEffect(() => {
    loadBroadcasts();
  }, [loadBroadcasts]);

  const handleSubscribe = async (channelId: string) => {
    const res = await postRequest(
      ROUTES.channels.subscribeChannel(channelId),
      {},
      { errorMessage: 'Unable to subscribe.' },
    );
    if (!res.success) {
      Alert.alert('Channel', res.message || 'Unable to subscribe.');
      return;
    }
    loadChannels(query);
  };

  return (
    <View style={[styles.wrap, { backgroundColor: palette.bg }]}>
      <Text style={{ color: palette.text, fontSize: 28, fontWeight: '900' }}>Broadcast</Text>
      <Text style={{ color: palette.subtext, marginTop: 6 }}>
        Discover channels and broadcasts. Create channels with a Business+ tier.
      </Text>

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        {loading ? (
          <View style={[styles.card, { backgroundColor: palette.card, marginTop: 16 }]}>
            <Skeleton height={18} width={180} />
            <View style={{ marginTop: 12, gap: 8 }}>
              <Skeleton height={14} width={220} />
              <Skeleton height={14} width={200} />
              <Skeleton height={14} width={160} />
            </View>
          </View>
        ) : (
          <View style={[styles.card, { backgroundColor: palette.card, marginTop: 16 }]}>
            <Text style={[styles.cardTitle, { color: palette.text }]}>
              KIS Business Broadcast Studio
            </Text>
            <Text style={[styles.cardSubtitle, { color: palette.subtext }]}>
              Publish announcements, offers, and partner updates to your audience.
            </Text>
            <View style={styles.chipRow}>
              <View style={[styles.tierChip, { backgroundColor: palette.primarySoft }]}>
                <Text style={{ color: palette.primaryStrong, fontWeight: '700' }}>{tierLabel}</Text>
              </View>
              <View style={[styles.tierChip, { backgroundColor: palette.surface }]}>
                <Text style={{ color: palette.subtext }}>
                  {canUseBroadcast ? 'Broadcast enabled' : 'Upgrade required'}
                </Text>
              </View>
            </View>
            <View style={styles.featureList}>
              {[
                'Channel profile + branded header',
                'Invite-only messages for non-subscribers',
                'Subscriber notifications & insights',
              ].map((item) => (
                <Text key={item} style={[styles.featureItem, { color: palette.subtext }]}>
                  • {item}
                </Text>
              ))}
            </View>
            {canUseBroadcast ? (
              <KISButton
                title="Open Business Broadcast"
                onPress={() => Alert.alert('Broadcast', 'Business broadcast setup is coming next.')}
              />
            ) : (
              <View style={{ marginTop: 12 }}>
                <KISButton
                  title="Upgrade account"
                  onPress={() => navigation.navigate('Profile' as never)}
                />
              </View>
            )}
          </View>
        )}

        {canUseBroadcast ? (
          <View style={[styles.card, { backgroundColor: palette.card, marginTop: 16 }]}>
            <NewChannelForm
              palette={{
                bg: palette.bg,
                card: palette.card,
                text: palette.text,
                subtext: palette.subtext,
                primary: palette.primary,
                inputBorder: palette.divider,
              }}
              onSuccess={() => loadChannels(query)}
            />
          </View>
        ) : null}

        <View style={[styles.card, { backgroundColor: palette.card, marginTop: 16 }]}>
          <Text style={[styles.cardTitle, { color: palette.text }]}>Latest broadcasts</Text>
          <Text style={[styles.cardSubtitle, { color: palette.subtext }]}>
            Broadcast items are available for up to 10 days. Channel chatrooms stay permanent.
          </Text>
          {loadingBroadcasts ? (
            <View style={{ marginTop: 12, gap: 10 }}>
              <Skeleton height={52} radius={12} />
              <Skeleton height={52} radius={12} />
            </View>
          ) : (
            <View style={{ marginTop: 12, gap: 12 }}>
              {broadcasts.length === 0 ? (
                <Text style={{ color: palette.subtext }}>No broadcasts yet.</Text>
              ) : (
                broadcasts.map((item) => {
                  const body = item.text || item.styled_text?.text || '';
                  return (
                  <View key={item.id} style={[styles.broadcastCard, { borderColor: palette.divider }]}>
                    <Text style={[styles.broadcastTitle, { color: palette.text }]}>
                      {item.title || 'Broadcast'}
                    </Text>
                    {body ? (
                      <Text style={[styles.broadcastText, { color: palette.subtext }]}>
                        {body}
                      </Text>
                    ) : null}
                    <Text style={[styles.broadcastMeta, { color: palette.subtext }]}>
                      {item.source_type ? `${item.source_type} • ` : ''}
                      {item.created_at ? new Date(item.created_at).toLocaleString() : 'Just now'}
                    </Text>
                  </View>
                  );
                })
              )}
            </View>
          )}
        </View>

        <View style={[styles.card, { backgroundColor: palette.card, marginTop: 16 }]}>
          <Text style={[styles.cardTitle, { color: palette.text }]}>Channel directory</Text>
          <Text style={[styles.cardSubtitle, { color: palette.subtext }]}>
            Search and subscribe to channels. Order refreshes each time you open.
          </Text>
          <View style={[styles.searchWrap, { borderColor: palette.divider }]}>
            <TextInput
              placeholder="Search channels"
              placeholderTextColor={palette.subtext}
              value={query}
              onChangeText={setQuery}
              style={{ color: palette.text, flex: 1 }}
            />
          </View>
          {loadingChannels ? (
            <View style={{ marginTop: 12, gap: 10 }}>
              <Skeleton height={52} radius={12} />
              <Skeleton height={52} radius={12} />
            </View>
          ) : (
            <View style={{ marginTop: 12, gap: 12 }}>
              {channels.length === 0 ? (
                <Text style={{ color: palette.subtext }}>No channels found.</Text>
              ) : (
                channels.map((channel) => (
                  <View key={channel.id} style={[styles.channelCard, { borderColor: palette.divider }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.channelName, { color: palette.text }]}>{channel.name}</Text>
                      <Text style={[styles.channelMeta, { color: palette.subtext }]}>
                        {channel.description || 'Community updates and invitations.'}
                      </Text>
                      {!channel.is_subscribed ? (
                        <Text style={[styles.channelInvite, { color: palette.subtext }]}>
                          {Array.isArray(channel.invite_messages) && channel.invite_messages.length > 0
                            ? channel.invite_messages[0]
                            : 'Subscribe to access full updates.'}
                        </Text>
                      ) : null}
                    </View>
                    <View style={{ gap: 8 }}>
                      {channel.is_subscribed ? (
                        <KISButton
                          title="Open"
                          size="sm"
                          onPress={() => navigation.navigate('Messages' as never)}
                        />
                      ) : (
                        <KISButton
                          title="Subscribe"
                          size="sm"
                          onPress={() => handleSubscribe(String(channel.id))}
                        />
                      )}
                      {channel.can_post ? (
                        <View style={[styles.roleChip, { backgroundColor: palette.primarySoft }]}>
                          <Text style={{ color: palette.primaryStrong, fontSize: 12 }}>Admin</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                ))
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 16 },
  card: { padding: 16, borderRadius: 16 },
  cardTitle: { fontSize: 18, fontWeight: '800' },
  cardSubtitle: { marginTop: 6 },
  chipRow: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  tierChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  featureList: { marginTop: 12, gap: 6 },
  featureItem: { fontSize: 14 },
  searchWrap: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  channelCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    gap: 12,
  },
  channelName: { fontSize: 16, fontWeight: '700' },
  channelMeta: { marginTop: 4, fontSize: 13 },
  channelInvite: { marginTop: 6, fontSize: 12 },
  roleChip: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  broadcastCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 6,
  },
  broadcastTitle: { fontSize: 16, fontWeight: '700' },
  broadcastText: { fontSize: 13 },
  broadcastMeta: { fontSize: 12 },
});
