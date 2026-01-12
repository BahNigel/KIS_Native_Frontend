// src/screens/tabs/BroadcastScreen.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  DeviceEventEmitter,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useKISTheme } from '../../theme/useTheme';
import KISButton from '../../constants/KISButton';
import Skeleton from '@/components/common/Skeleton';
import BroadcastFeedSection from '@/components/broadcast/BroadcastFeedSection';
import MarketStudioSection from '@/components/broadcast/MarketStudioSection';
import { getRequest } from '@/network/get';
import { patchRequest } from '@/network/patch';
import { deleteRequest } from '@/network/delete';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';
import { CacheConfig } from '@/network/cacheKeys';
import {
  getCachedProfile,
  getTierFromProfile,
  isBusinessTier,
  isPartnerTier,
  isPartnerProTier,
  normalizeTierName,
} from '@/services/tierAccess';
import NewChannelForm from '@/Module/AddContacts/components/NewChannelForm';

type BroadcastSourceFilter = 'all' | 'channel' | 'community' | 'partner';
type ChannelListFilter = 'all' | 'subscribed' | 'open';
type LessonFilter = 'all' | 'global' | 'partner' | 'community';

export default function BroadcastScreen() {
  const { palette } = useKISTheme();
  const navigation = useNavigation();
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [channels, setChannels] = useState<any[]>([]);
  const [ownedChannels, setOwnedChannels] = useState<any[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [featureFlags, setFeatureFlags] = useState<any[]>([]);
  const [featureLoading, setFeatureLoading] = useState(false);
  const [featureUpdating, setFeatureUpdating] = useState(false);
  const [shortVideos, setShortVideos] = useState<any[]>([]);
  const [longVideos, setLongVideos] = useState<any[]>([]);
  const [videoLoading, setVideoLoading] = useState({ short: false, video: false });
  const [activeTab, setActiveTab] = useState('broadcasts');
  const [broadcastSearch, setBroadcastSearch] = useState('');
  const [broadcastFilter, setBroadcastFilter] = useState<BroadcastSourceFilter>('all');
  const [channelSearch, setChannelSearch] = useState('');
  const [channelFilter, setChannelFilter] = useState<ChannelListFilter>('all');
  const [lessons, setLessons] = useState<any[]>([]);
  const [lessonLoading, setLessonLoading] = useState(false);
  const [lessonSearch, setLessonSearch] = useState('');
  const [lessonFilter, setLessonFilter] = useState<LessonFilter>('all');
  const [lessonEnrollmentLoading, setLessonEnrollmentLoading] = useState<Record<string, boolean>>({});

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
  const canUseMarket = isBusinessTier(accountTier);
  const isPartner = isPartnerTier(accountTier);
  const isPartnerPro = isPartnerProTier(accountTier);
  const tabs = [
    { id: 'broadcasts', label: 'Broadcasts' },
    { id: 'lessons', label: 'Lessons' },
    { id: 'studio', label: 'Studio' },
    { id: 'market', label: 'Market' },
    { id: 'directory', label: 'Directory' },
    { id: 'shorts', label: 'Shorts' },
    { id: 'videos', label: 'Videos' },
  ];
  const broadcastFilterOptions: { id: BroadcastSourceFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'channel', label: 'Channels' },
    { id: 'community', label: 'Communities' },
    { id: 'partner', label: 'Partners' },
  ];
  const channelFilterOptions: { id: ChannelListFilter; label: string }[] = [
    { id: 'all', label: 'All channels' },
    { id: 'subscribed', label: 'Subscribed' },
    { id: 'open', label: 'Open to join' },
  ];
  const lessonTypeOptions: { id: LessonFilter; label: string }[] = [
    { id: 'all', label: 'All lessons' },
    { id: 'global', label: 'Global' },
    { id: 'partner', label: 'Partner' },
    { id: 'community', label: 'Community' },
  ];
const lessonTypeLabels: Record<LessonFilter, string> = {
  all: 'Lesson',
  global: 'Global Lesson',
  partner: 'Partner Lesson',
  community: 'Community Lesson',
};
const PARTNER_PRO_BENEFITS = [
  'Unlimited partner organizations, automation, and integrations',
  'Advanced analytics/export dashboards with compliance controls',
  'Priority partner webhooks, automation rules, and access reviews',
  'Broadcast-grade studio insights plus premium market intelligence',
];
  const filteredChannels = useMemo(() => {
    const term = channelSearch.trim().toLowerCase();
    return channels.filter((channel) => {
      const matchesSearch =
        !term ||
        (channel.name?.toLowerCase().includes(term) ?? false) ||
        (channel.description?.toLowerCase().includes(term) ?? false);
      if (!matchesSearch) return false;
      if (channelFilter === 'subscribed' && !channel.is_subscribed) return false;
      if (channelFilter === 'open') {
        if (channel.allow_subscribe === false) return false;
      }
      return true;
    });
    }, [channels, channelFilter, channelSearch]);

  const filteredLessons = useMemo(() => {
    const searchTerm = lessonSearch.trim().toLowerCase();
    return lessons.filter((lesson) => {
      if (lessonFilter !== 'all' && lesson.lesson_type !== lessonFilter) return false;
      if (!searchTerm) return true;
      const candidates = [
        lesson.title,
        lesson.summary,
        lesson.partner_name,
        lesson.community_name,
        lesson.public_info?.tagline,
      ];
      return candidates.some((value) => (value ?? '').toLowerCase().includes(searchTerm));
    });
  }, [lessons, lessonFilter, lessonSearch]);

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

  const loadMyChannels = useCallback(async () => {
    const ownerId = profile?.user?.id;
    if (!ownerId) {
      setOwnedChannels([]);
      return;
    }
    const url = `${ROUTES.channels.getAllChannels}?owner=${ownerId}`;
    const res = await getRequest(url, {
      errorMessage: 'Unable to load your channels.',
    });
    if (res?.success) {
      const payload = res.data?.results ?? res.data ?? [];
      setOwnedChannels(Array.isArray(payload) ? payload : []);
    }
  }, [profile?.user?.id]);

  const loadChannelFeatures = useCallback(
    async (channelId: string) => {
      if (!channelId) return;
      setFeatureLoading(true);
      const res = await getRequest(ROUTES.broadcasts.channelFeatures(channelId), {
        errorMessage: 'Unable to load feature flags.',
      });
      if (res?.success) {
        setFeatureFlags(res.data?.features || []);
      }
      setFeatureLoading(false);
    },
    [],
  );

  const updateFeatureFlag = useCallback(
    async (slug: string, enabled: boolean) => {
      if (!selectedChannelId) return;
      setFeatureUpdating(true);
      const payload = { flags: [{ slug, enabled }] };
      const res = await patchRequest(ROUTES.broadcasts.channelFeatures(selectedChannelId), payload, {
        errorMessage: 'Unable to update feature.',
      });
      if (res?.success) {
        setFeatureFlags(res.data?.features || []);
      } else {
        Alert.alert('Feature', res?.message || 'Unable to update feature.');
      }
      setFeatureUpdating(false);
    },
    [selectedChannelId],
  );

  const loadVideos = useCallback(async (type: 'short' | 'video') => {
    setVideoLoading((prev) => ({ ...prev, [type]: true }));
    const res = await getRequest(ROUTES.broadcasts.videos(type), {
      errorMessage: 'Unable to load videos.',
    });
    if (res?.success) {
      const payload = Array.isArray(res.data) ? res.data : res.data?.results ?? [];
      if (type === 'short') {
        setShortVideos(payload);
      } else {
        setLongVideos(payload);
      }
    }
    setVideoLoading((prev) => ({ ...prev, [type]: false }));
  }, []);

  const formatDuration = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs.toString().padStart(2, '0')}s`;
  }, []);

  const openVideoLink = useCallback((url?: string) => {
    if (!url) return;
    Linking.openURL(url).catch(() => Alert.alert('Video', 'Unable to open that link.'));
  }, []);

  const loadLessons = useCallback(async () => {
    setLessonLoading(true);
    const res = await getRequest(ROUTES.broadcasts.lessons, {
      errorMessage: 'Unable to load lessons.',
    });
    if (res?.success) {
      const payload = Array.isArray(res.data) ? res.data : res.data?.results ?? [];
      setLessons(payload);
    }
    setLessonLoading(false);
  }, []);

  const handleEnrollLesson = useCallback(
    async (lessonId: string, isEnrolled: boolean) => {
      setLessonEnrollmentLoading((prev) => ({ ...prev, [lessonId]: true }));
      const method = isEnrolled ? deleteRequest : postRequest;
      const errorMessage = isEnrolled ? 'Unable to leave the lesson.' : 'Unable to enroll in the lesson.';
      const res = await method(ROUTES.broadcasts.lessonEnroll(lessonId), {}, { errorMessage });
      if (res?.success) {
        loadLessons();
      } else {
        Alert.alert('Lesson', res?.message || errorMessage);
      }
      setLessonEnrollmentLoading((prev) => {
        const next = { ...prev };
        delete next[lessonId];
        return next;
      });
    },
    [loadLessons],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      loadChannels(channelSearch);
    }, 250);
    return () => clearTimeout(timer);
  }, [channelSearch, loadChannels]);

  useEffect(() => {
    loadMyChannels();
  }, [loadMyChannels]);

  useEffect(() => {
    if (!ownedChannels.length) {
      setSelectedChannelId(null);
      return;
    }
    if (!selectedChannelId || !ownedChannels.find((channel) => channel.id === selectedChannelId)) {
      setSelectedChannelId(ownedChannels[0].id);
    }
  }, [ownedChannels, selectedChannelId]);

  useEffect(() => {
    if (selectedChannelId) {
      loadChannelFeatures(selectedChannelId);
    } else {
      setFeatureFlags([]);
    }
  }, [selectedChannelId, loadChannelFeatures]);

  useEffect(() => {
    loadVideos('short');
    loadVideos('video');
  }, [loadVideos]);

  useEffect(() => {
    loadLessons();
  }, [loadLessons]);

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
    loadChannels(channelSearch);
  };

  const handleOpenChannel = (channel: any) => {
    const conversationId =
      channel?.conversation_id ?? channel?.conversationId ?? channel?.conversation?.id ?? null;
    if (conversationId) {
      DeviceEventEmitter.emit('chat.open', {
        conversationId: String(conversationId),
        name: channel?.name ?? 'Channel',
        kind: 'channel',
      });
    }
    navigation.navigate('Messages' as never);
  };

  return (
    <View style={[styles.wrap, { backgroundColor: palette.bg }]}>
      <Text style={{ color: palette.text, fontSize: 28, fontWeight: '900' }}>Broadcast</Text>
      <Text style={{ color: palette.subtext, marginTop: 6 }}>
        Discover channels, broadcasts, and market listings. Everything is grouped into dedicated tabs.
      </Text>

      <View
        style={[
          styles.partnerBanner,
          { borderColor: palette.divider, backgroundColor: palette.surface },
        ]}
      >
        <Text style={[styles.partnerBannerTitle, { color: palette.primaryStrong }]}>
          {isPartnerPro ? 'Partner Pro features active' : 'Upgrade to Partner Pro'}
        </Text>
        <Text style={[styles.partnerBannerSubtitle, { color: palette.subtext }]}>
          {isPartnerPro
            ? 'You already enjoy unlimited partners, audits, automation, and exports.'
            : 'Partner Pro unlocks automation, analytics, compliance, and unlimited partners.'}
        </Text>
        <View style={styles.partnerBannerList}>
          {PARTNER_PRO_BENEFITS.map((benefit) => (
            <Text key={benefit} style={[styles.partnerBannerItem, { color: palette.subtext }]}>
              • {benefit}
            </Text>
          ))}
        </View>
        {!isPartnerPro && (
          <KISButton
            title="Upgrade to Partner Pro"
            onPress={() => navigation.navigate('Profile' as never)}
            style={{ marginTop: 6 }}
          />
        )}
      </View>

      <View style={[styles.tabBar, { backgroundColor: palette.surface }]}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <Pressable
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              style={[
                styles.tabItem,
                {
                  borderColor: isActive ? palette.primary : palette.divider,
                  backgroundColor: isActive ? palette.primarySoft : 'transparent',
                },
              ]}
            >
              <Text
                style={[
                  styles.tabLabel,
                  { color: isActive ? palette.primaryStrong : palette.text },
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        {activeTab === 'studio' && (
          <>
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
                  <KISButton title="Upgrade account" onPress={() => navigation.navigate('Profile' as never)} />
                </View>
              )}
            </View>
            {canUseBroadcast && (
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
                  onSuccess={() => {
                    loadChannels(channelSearch);
                    loadMyChannels();
                  }}
                />
              </View>
            )}
            <View style={[styles.card, { backgroundColor: palette.card, marginTop: 16 }]}>
              <Text style={[styles.cardTitle, { color: palette.text }]}>Feature controls</Text>
              <Text style={[styles.cardSubtitle, { color: palette.subtext }]}>
                Flip new broadcast experiences on or off for your owned channels.
              </Text>
              {ownedChannels.length ? (
                <View style={styles.channelSelector}>
                  {ownedChannels.map((channel) => {
                    const isActive = selectedChannelId === channel.id;
                    return (
                      <Pressable
                        key={channel.id}
                        onPress={() => setSelectedChannelId(channel.id)}
                        style={[
                          styles.channelChip,
                          {
                            borderColor: isActive ? palette.primary : palette.divider,
                            backgroundColor: isActive ? palette.primarySoft : palette.surface,
                          },
                        ]}
                      >
                        <Text
                          style={{
                            color: isActive ? palette.primaryStrong : palette.text,
                            fontSize: 12,
                          }}
                        >
                          {channel.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : (
                <Text style={[styles.subtext, { color: palette.subtext, marginTop: 8 }]}>
                  Create a channel to unlock the next-level broadcast stack.
                </Text>
              )}
              {featureLoading ? (
                <View style={{ marginTop: 16, gap: 8 }}>
                  <Skeleton height={60} radius={12} />
                  <Skeleton height={60} radius={12} />
                </View>
              ) : (
                <View style={styles.featureGrid}>
                  {featureFlags.map((feature) => (
                    <View
                      key={feature.slug}
                      style={[
                        styles.featureCard,
                        { borderColor: palette.divider, backgroundColor: palette.surface },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.featureTitle, { color: palette.text }]}>
                          {feature.name}
                        </Text>
                        <Text style={[styles.featureCategory, { color: palette.subtext }]}>
                          {feature.category || 'Feature'}
                        </Text>
                        <Text style={{ color: palette.subtext, fontSize: 12, marginTop: 4 }}>
                          {feature.description}
                        </Text>
                      </View>
                      <Switch
                        value={feature.enabled}
                        onValueChange={(value) => updateFeatureFlag(feature.slug, value)}
                        disabled={featureUpdating}
                      />
                    </View>
                  ))}
                </View>
              )}
            </View>
          </>
        )}

        {activeTab === 'broadcasts' && (
          <View style={[styles.card, { backgroundColor: palette.card, marginTop: 16 }]}>
            <Text style={[styles.cardTitle, { color: palette.text }]}>Latest broadcasts</Text>
            <Text style={[styles.cardSubtitle, { color: palette.subtext }]}>
              Broadcast items are available for up to 10 days. Channel chatrooms stay permanent.
            </Text>
            <View style={[styles.searchWrap, { borderColor: palette.divider }]}>
              <TextInput
                placeholder="Search broadcasts"
                placeholderTextColor={palette.subtext}
                value={broadcastSearch}
                onChangeText={setBroadcastSearch}
                style={{ color: palette.text, flex: 1 }}
              />
            </View>
            <View style={styles.filterRow}>
              {broadcastFilterOptions.map((opt) => {
                const selected = broadcastFilter === opt.id;
                return (
                  <Pressable
                    key={opt.id}
                    onPress={() => setBroadcastFilter(opt.id)}
                    style={[
                      styles.filterChip,
                      {
                        borderColor: selected ? palette.primary : palette.divider,
                        backgroundColor: selected ? palette.primarySoft : palette.surface,
                      },
                    ]}
                  >
                    <Text style={{ color: selected ? palette.primaryStrong : palette.text, fontSize: 12 }}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <BroadcastFeedSection
              onSubscribeChannel={handleSubscribe}
              searchTerm={broadcastSearch}
              filterSource={broadcastFilter}
            />
          </View>
        )}

        {activeTab === 'lessons' && (
          <View style={[styles.card, { backgroundColor: palette.card, marginTop: 16 }]}>
            <Text style={[styles.cardTitle, { color: palette.text }]}>Broadcast lessons</Text>
            <Text style={[styles.cardSubtitle, { color: palette.subtext }]}>
              Lessons are full-length broadcasts you can enroll in. Each one creates a lesson-only membership when you enroll.
            </Text>
            <View style={[styles.searchWrap, { borderColor: palette.divider, marginTop: 12 }]}>
              <TextInput
                placeholder="Search lessons"
                placeholderTextColor={palette.subtext}
                value={lessonSearch}
                onChangeText={setLessonSearch}
                style={{ color: palette.text, flex: 1 }}
              />
            </View>
            <View style={styles.filterRow}>
              {lessonTypeOptions.map((opt) => {
                const selected = lessonFilter === opt.id;
                return (
                  <Pressable
                    key={opt.id}
                    onPress={() => setLessonFilter(opt.id)}
                    style={[
                      styles.filterChip,
                      {
                        borderColor: selected ? palette.primary : palette.divider,
                        backgroundColor: selected ? palette.primarySoft : palette.surface,
                      },
                    ]}
                  >
                    <Text style={{ color: selected ? palette.primaryStrong : palette.text, fontSize: 12 }}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {lessonLoading ? (
              <View style={{ marginTop: 16, gap: 12 }}>
                <Skeleton height={100} radius={16} />
                <Skeleton height={100} radius={16} />
              </View>
            ) : filteredLessons.length === 0 ? (
              <Text style={{ color: palette.subtext, marginTop: 12 }}>No lessons match your filters yet.</Text>
            ) : (
              <View style={{ marginTop: 12, gap: 12 }}>
                {filteredLessons.map((lesson) => {
                  const priceLabel =
                    lesson.price_cents && lesson.price_cents > 0
                      ? new Intl.NumberFormat('en-US', {
                          style: 'currency',
                          currency: lesson.currency || 'USD',
                        }).format((lesson.price_cents || 0) / 100)
                      : 'Free';
                  const startsAt = lesson.starts_at ? new Date(lesson.starts_at).toLocaleString() : 'Anytime';
                  const endsAt = lesson.ends_at ? new Date(lesson.ends_at).toLocaleString() : null;
                  const tagline =
                    lesson.public_info?.tagline ||
                    lesson.public_info?.headline ||
                    lesson.public_info?.title ||
                    '';
                  const isEnrolled = Boolean(lesson.is_enrolled);
                  const isBusy = Boolean(lessonEnrollmentLoading[lesson.id]);
                  const typeLabel =
                    lessonTypeLabels[lesson.lesson_type as LessonFilter] || 'Lesson';

                  return (
                    <View key={lesson.id} style={[styles.lessonCard, { backgroundColor: palette.surface, borderColor: palette.divider }]}>
                      <View style={styles.lessonBadgeRow}>
                        <Text style={[styles.lessonBadge, { color: palette.text, borderColor: palette.divider }]}>
                          {typeLabel}
                        </Text>
                        <Text style={[styles.lessonBadge, { borderColor: palette.divider }]}>
                          {lesson.enrollment_count ?? 0} enrolled
                        </Text>
                      </View>
                      <Text style={[styles.channelName, { color: palette.text }]} numberOfLines={2}>
                        {lesson.title}
                      </Text>
                      <Text style={[styles.lessonMetaText, { color: palette.subtext }]} numberOfLines={2}>
                        {lesson.summary}
                      </Text>
                      {tagline ? (
                        <Text style={[styles.lessonMetaText, { color: palette.primaryStrong, marginTop: 4 }]}>
                          {tagline}
                        </Text>
                      ) : null}
                      <View style={styles.lessonMetaRow}>
                        <Text style={{ color: palette.subtext, fontSize: 12 }}>Starts: {startsAt}</Text>
                        <Text style={{ color: palette.subtext, fontSize: 12 }}>Price: {priceLabel}</Text>
                      </View>
                      {endsAt ? (
                        <Text style={{ color: palette.subtext, fontSize: 12 }}>Ends: {endsAt}</Text>
                      ) : null}
                      <KISButton
                        title={isEnrolled ? 'Leave lesson' : 'Enroll'}
                        size="sm"
                        variant={isEnrolled ? 'secondary' : 'primary'}
                        onPress={() => handleEnrollLesson(lesson.id, isEnrolled)}
                        disabled={isBusy}
                      />
                      {isEnrolled && (
                        <Text style={[styles.lessonCaption, { color: palette.subtext }]}>
                          Lesson-only membership grants access to this lesson content and public info; subscribe to the partner/community for fuller access.
                        </Text>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {activeTab === 'market' && (
          <View style={[styles.card, { backgroundColor: palette.card, marginTop: 16 }]}>
            <Text style={[styles.cardTitle, { color: palette.text }]}>Market studio</Text>
            <Text style={[styles.cardSubtitle, { color: palette.subtext }]}>
              Business stores can publish listings and broadcast items to the world.
            </Text>
            <MarketStudioSection
              profile={profile}
              canUseMarket={canUseMarket}
              onUpgrade={() => navigation.navigate('Profile' as never)}
            />
          </View>
        )}

        {activeTab === 'directory' && (
          <View style={[styles.card, { backgroundColor: palette.card, marginTop: 16 }]}>
            <Text style={[styles.cardTitle, { color: palette.text }]}>Channel directory</Text>
            <Text style={[styles.cardSubtitle, { color: palette.subtext }]}>
              Search and subscribe to channels. Order refreshes each time you open.
            </Text>
            <View style={[styles.searchWrap, { borderColor: palette.divider }]}>
              <TextInput
                placeholder="Search channels"
                placeholderTextColor={palette.subtext}
                value={channelSearch}
                onChangeText={setChannelSearch}
                style={{ color: palette.text, flex: 1 }}
              />
            </View>
            <View style={styles.filterRow}>
              {channelFilterOptions.map((opt) => {
                const selected = channelFilter === opt.id;
                return (
                  <Pressable
                    key={opt.id}
                    onPress={() => setChannelFilter(opt.id)}
                    style={[
                      styles.filterChip,
                      {
                        borderColor: selected ? palette.primary : palette.divider,
                        backgroundColor: selected ? palette.primarySoft : palette.surface,
                      },
                    ]}
                  >
                    <Text style={{ color: selected ? palette.primaryStrong : palette.text, fontSize: 12 }}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {loadingChannels ? (
              <View style={{ marginTop: 12, gap: 10 }}>
                <Skeleton height={52} radius={12} />
                <Skeleton height={52} radius={12} />
              </View>
            ) : (
              <View style={{ marginTop: 12, gap: 12 }}>
                {filteredChannels.length === 0 ? (
                  <Text style={{ color: palette.subtext }}>No channels found.</Text>
                ) : (
                  filteredChannels.map((channel) => (
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
                          <KISButton title="Open" size="sm" onPress={() => handleOpenChannel(channel)} />
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
        )}
        {activeTab === 'shorts' && (
          <View style={[styles.card, { backgroundColor: palette.card, marginTop: 16 }]}>
            <Text style={[styles.cardTitle, { color: palette.text }]}>Shorts</Text>
            <Text style={[styles.cardSubtitle, { color: palette.subtext }]}>
              Bite-size broadcasts styled like short-form video feeds.
            </Text>
            {videoLoading.short ? (
              <View style={{ marginTop: 16, gap: 10 }}>
                <Skeleton height={120} radius={16} />
                <Skeleton height={120} radius={16} />
              </View>
            ) : shortVideos.length === 0 ? (
              <Text style={{ color: palette.subtext, marginTop: 12 }}>No shorts available yet.</Text>
            ) : (
              <View style={{ marginTop: 12, gap: 12 }}>
                {shortVideos.map((video) => (
                  <View key={video.id} style={[styles.videoCard, { borderColor: palette.divider }]}>
                    {video.thumbnail_url ? (
                      <Image source={{ uri: video.thumbnail_url }} style={styles.videoThumb} />
                    ) : (
                      <View
                        style={[
                          styles.videoThumb,
                          { backgroundColor: palette.surface, borderColor: palette.divider },
                        ]}
                      />
                    )}
                    <View style={styles.videoMeta}>
                      <Text style={[styles.channelName, { color: palette.text }]} numberOfLines={1}>
                        {video.title}
                      </Text>
                      <Text style={{ color: palette.subtext, fontSize: 12 }}>
                        {video.channel_name || 'KIS Broadcast'}
                      </Text>
                      <Text style={{ color: palette.subtext, fontSize: 11, marginTop: 4 }}>
                        {formatDuration(video.duration_seconds)}
                      </Text>
                      <KISButton
                        title="Watch"
                        size="sm"
                        onPress={() => openVideoLink(video.video_url)}
                        variant="secondary"
                      />
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {activeTab === 'videos' && (
          <View style={[styles.card, { backgroundColor: palette.card, marginTop: 16 }]}>
            <Text style={[styles.cardTitle, { color: palette.text }]}>Videos</Text>
            <Text style={[styles.cardSubtitle, { color: palette.subtext }]}>
              Full-length broadcasts captured for replay, training, and highlights.
            </Text>
            {videoLoading.video ? (
              <View style={{ marginTop: 16, gap: 10 }}>
                <Skeleton height={120} radius={16} />
                <Skeleton height={120} radius={16} />
              </View>
            ) : longVideos.length === 0 ? (
              <Text style={{ color: palette.subtext, marginTop: 12 }}>No videos ready yet.</Text>
            ) : (
              <View style={{ marginTop: 12, gap: 12 }}>
                {longVideos.map((video) => (
                  <View key={video.id} style={[styles.videoCard, { borderColor: palette.divider }]}>
                    {video.thumbnail_url ? (
                      <Image source={{ uri: video.thumbnail_url }} style={styles.videoThumb} />
                    ) : (
                      <View
                        style={[
                          styles.videoThumb,
                          { backgroundColor: palette.surface, borderColor: palette.divider },
                        ]}
                      />
                    )}
                    <View style={styles.videoMeta}>
                      <Text style={[styles.channelName, { color: palette.text }]} numberOfLines={1}>
                        {video.title}
                      </Text>
                      <Text style={{ color: palette.subtext, fontSize: 12 }}>
                        {video.channel_name || 'KIS Broadcast'}
                      </Text>
                      <Text style={{ color: palette.subtext, fontSize: 11, marginTop: 4 }}>
                        {formatDuration(video.duration_seconds)}
                      </Text>
                      <KISButton
                        title="Watch"
                        size="sm"
                        onPress={() => openVideoLink(video.video_url)}
                        variant="secondary"
                      />
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
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
  tabBar: { flexDirection: 'row', gap: 8, marginTop: 16, flexWrap: 'wrap' },
  tabItem: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  tabLabel: { fontSize: 12, fontWeight: '700' },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  filterChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  channelSelector: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  channelChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  featureGrid: { marginTop: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  featureCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexBasis: '48%',
  },
  featureTitle: { fontSize: 14, fontWeight: '700' },
  featureCategory: { fontSize: 11 },
  videoCard: {
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  videoThumb: {
    width: '100%',
    height: 180,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  videoMeta: {
    padding: 12,
    gap: 4,
  },
  lessonCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    gap: 8,
  },
  lessonBadgeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  lessonBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 11,
  },
  lessonMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  lessonMetaText: {
    fontSize: 13,
  },
  lessonCaption: {
    fontSize: 12,
    marginTop: 6,
    lineHeight: 18,
  },
  partnerBanner: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    marginTop: 12,
    gap: 6,
  },
  partnerBannerTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  partnerBannerSubtitle: {
    fontSize: 12,
  },
  partnerBannerList: {
    gap: 4,
    marginTop: 4,
  },
  partnerBannerItem: {
    fontSize: 12,
  },
});
