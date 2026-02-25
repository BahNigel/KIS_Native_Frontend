import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useKISTheme } from '@/theme/useTheme';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';
import KISButton from '@/constants/KISButton';
import { KISIcon } from '@/constants/kisIcons';
import { resolveBackendAssetUrl } from '@/network';
import { resolveBookingEngines } from '@/features/health-dashboard/bookingEngines';
import { startHealthServiceSession } from '@/services/healthOpsAppointmentService';

type Props = {
  searchTerm?: string;
  searchContext?: string;
};

type HealthcareBroadcastCard = {
  id: string;
  title: string;
  text?: string;
  attachments?: Array<{ url?: string }>;
  source?: {
    id?: string;
    name?: string;
  };
  health_card?: {
    institution_id?: string;
    institution_name?: string;
    card_id?: string;
    date?: string;
    time?: string;
    status?: string;
    service_name?: string;
    service_description?: string;
    institution_logo_url?: string;
    membership_open?: boolean;
    membership_discount_pct?: number;
    viewer_is_member?: boolean;
    viewer_can_manage?: boolean;
  };
};

type HealthTimeFilter = 'today' | 'upcoming' | 'past';
type RatingStats = { average: number; count: number };
type InstitutionBroadcastMeta = {
  id: string;
  name: string;
  type?: string;
  landingDraft: any;
  landingExists: boolean;
  logoUrl: string;
  membershipOpen: boolean;
  membershipDiscountPercent: number;
};
type InstitutionCardDetails = {
  cardsById: Record<string, any>;
  ratingsByService: Record<string, RatingStats>;
  membershipDiscountPercent: number;
  membershipOpen: boolean;
  viewerIsMember: boolean;
  viewerCanManage: boolean;
};

const STATUS_COLOR: Record<string, string> = {
  available: '#10B981',
  limited: '#F59E0B',
  fully_booked: '#EF4444',
  on_call: '#3B82F6',
  holiday: '#8B5CF6',
  blocked: '#6B7280',
};

const toDateLabel = (value?: string) => {
  const [y, m, d] = String(value || '').split('-').map((part) => Number(part));
  if (!y || !m || !d) return value || '';
  return new Date(y, m - 1, d).toDateString();
};

const toMoney = (cents?: number) => {
  if (!Number.isFinite(Number(cents))) return 'Not set';
  return `$${(Number(cents) / 100).toLocaleString()}`;
};

const toKisc = (micro?: number) => {
  if (!Number.isFinite(Number(micro))) return '0.000';
  return (Number(micro) / 100000).toFixed(3);
};

const clampDiscount = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 10;
  const rounded = Math.round(parsed);
  return Math.max(10, Math.min(100, rounded));
};

const resolveLandingDraft = (institution: any) => {
  const fromEditor = institution?.profile_editor ?? institution?.profileEditor;
  if (fromEditor && typeof fromEditor === 'object') return fromEditor;
  const fromPreview = institution?.landing_preview ?? institution?.landingPreview;
  if (fromPreview && typeof fromPreview === 'object') return fromPreview;
  const fromDashboard = institution?.dashboard?.profile_editor ?? institution?.dashboard?.profileEditor;
  if (fromDashboard && typeof fromDashboard === 'object') return fromDashboard;
  return {};
};

const hasLandingPage = (draft: any) => {
  if (!draft || typeof draft !== 'object') return false;
  if (Array.isArray(draft.sections) && draft.sections.length > 0) return true;
  if (typeof draft.about === 'string' && draft.about.trim().length > 0) return true;
  if (Array.isArray(draft.gallery) && draft.gallery.length > 0) return true;
  if (typeof draft?.hero?.title === 'string' && draft.hero.title.trim().length > 0) return true;
  return false;
};

const buildRatingsByService = (ratings: any[]): Record<string, RatingStats> => {
  const buckets: Record<string, { total: number; count: number }> = {};
  ratings.forEach((row) => {
    const serviceId = String(row?.serviceId ?? row?.service_id ?? '').trim();
    const rating = Number(row?.rating);
    if (!serviceId || !Number.isFinite(rating)) return;
    if (!buckets[serviceId]) buckets[serviceId] = { total: 0, count: 0 };
    buckets[serviceId].total += rating;
    buckets[serviceId].count += 1;
  });
  const out: Record<string, RatingStats> = {};
  Object.entries(buckets).forEach(([serviceId, value]) => {
    out[serviceId] = {
      average: value.count > 0 ? value.total / value.count : 0,
      count: value.count,
    };
  });
  return out;
};

const normalizeInstitutionId = (value: unknown) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.startsWith('health:')) return String(raw.slice('health:'.length)).trim();
  if (raw.startsWith('health-card:')) {
    const parts = raw.split(':');
    return String(parts[1] || '').trim();
  }
  return raw;
};

const resolveInstitutionIdFromBroadcast = (row: any) => {
  const fromCard = normalizeInstitutionId(row?.health_card?.institution_id);
  if (fromCard) return fromCard;
  return normalizeInstitutionId(row?.source?.id);
};

export default function BroadcastHealthcarePage({ searchTerm, searchContext }: Props) {
  const { palette } = useKISTheme();
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<HealthcareBroadcastCard[]>([]);
  const [timeFilter, setTimeFilter] = useState<HealthTimeFilter>('upcoming');
  const [institutionMeta, setInstitutionMeta] = useState<Record<string, InstitutionBroadcastMeta>>({});
  const [institutionDetails, setInstitutionDetails] = useState<Record<string, InstitutionCardDetails>>({});
  const [joiningInstitutionId, setJoiningInstitutionId] = useState('');

  const loadHealthcareBroadcasts = useCallback(async () => {
    setLoading(true);
    try {
      const [res, profileResResult] = await Promise.allSettled([
        getRequest(ROUTES.broadcasts.list, { errorMessage: 'Unable to load healthcare broadcasts.' }),
        getRequest(ROUTES.broadcasts.createProfile, { errorMessage: 'Unable to load institution profiles.' }),
      ]);
      if (res.status !== 'fulfilled' || !res.value?.success) {
        throw new Error(
          res.status === 'fulfilled'
            ? res.value?.message || 'Unable to load healthcare broadcasts.'
            : 'Unable to load healthcare broadcasts.',
        );
      }
      const rows = Array.isArray(res.value?.data?.results)
        ? res.value.data.results
        : Array.isArray(res.value?.data)
          ? res.value.data
          : [];
      const healthcareRows = rows.filter((row: any) => {
        const type = String(row?.source_type || row?.source?.type || '').toLowerCase();
        return type === 'healthcare';
      });
      setItems(healthcareRows);

      const profileRes = profileResResult.status === 'fulfilled' ? profileResResult.value : null;
      const healthProfile = profileRes?.data?.profiles?.health ?? {};
      const institutions = Array.isArray(healthProfile?.institutions) ? healthProfile.institutions : [];
      const nextMeta: Record<string, InstitutionBroadcastMeta> = {};
      institutions.forEach((institution: any) => {
        const id = String(institution?.id || '').trim();
        if (!id) return;
        const draft = resolveLandingDraft(institution);
        const membershipOpen =
          institution?.membership_settings?.open ??
          institution?.membershipSettings?.open ??
          institution?.membership_open ??
          institution?.membershipOpen ??
          false;
        const membershipDiscountPercent = clampDiscount(
          institution?.membership_settings?.discountPercent ??
            institution?.membershipSettings?.discountPercent ??
            institution?.membership_discount_pct ??
            institution?.membershipDiscountPct ??
            10,
        );
        const rawLogo =
          institution?.landingLogoUrl ??
          institution?.profile_editor?.landingLogoUrl ??
          institution?.profileEditor?.landingLogoUrl ??
          draft?.landingLogoUrl ??
          '';
        const resolvedLogo = resolveBackendAssetUrl(rawLogo) || String(rawLogo || '');
        nextMeta[id] = {
          id,
          name: String(institution?.name || ''),
          type: String(institution?.type || '').trim().toLowerCase(),
          landingDraft: draft,
          landingExists: hasLandingPage(draft),
          logoUrl: resolvedLogo,
          membershipOpen: !!membershipOpen,
          membershipDiscountPercent,
        };
      });
      setInstitutionMeta(nextMeta);

      const institutionIds = Array.from(
        new Set(
          healthcareRows
            .map((row: any) => resolveInstitutionIdFromBroadcast(row))
            .filter(Boolean),
        ),
      );
      const detailResponses = await Promise.allSettled(
        institutionIds.map((institutionId) =>
          getRequest(ROUTES.broadcasts.healthCards(institutionId), { errorMessage: 'Unable to load health card details.' }),
        ),
      );
      const nextDetails: Record<string, InstitutionCardDetails> = {};
      detailResponses.forEach((result, index) => {
        if (result.status !== 'fulfilled' || !result.value?.success) return;
        const institutionId = institutionIds[index];
        const payload = result.value?.data ?? {};
        const cards = Array.isArray(payload?.cards) ? payload.cards : [];
        const ratings = Array.isArray(payload?.ratings) ? payload.ratings : [];
        const membership = payload?.membership ?? {};
        const viewer = payload?.viewer ?? {};
        const discountPercent = clampDiscount(
          membership?.discountPercent ?? membership?.discount_percent ?? 10,
        );
        const cardsById = cards.reduce((acc: Record<string, any>, card: any) => {
          const cardId = String(card?.id || '').trim();
          if (cardId) acc[cardId] = card;
          return acc;
        }, {});
        nextDetails[institutionId] = {
          cardsById,
          ratingsByService: buildRatingsByService(ratings),
          membershipDiscountPercent: discountPercent,
          membershipOpen: !!membership?.open,
          viewerIsMember: !!(viewer?.is_member || viewer?.isMember),
          viewerCanManage: !!(viewer?.can_manage || viewer?.canManage),
        };
      });
      setInstitutionDetails(nextDetails);
    } catch (error: any) {
      Alert.alert('Healthcare broadcasts', error?.message || 'Unable to load healthcare broadcasts.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHealthcareBroadcasts().catch(() => undefined);
  }, [loadHealthcareBroadcasts]);

  const handleJoinInstitution = useCallback(
    async (institutionId: string) => {
      if (!institutionId) return;
      setJoiningInstitutionId(institutionId);
      try {
        const response = await postRequest(ROUTES.broadcasts.healthCards(institutionId), {
          action: 'join',
        });
        if (!response?.success) {
          throw new Error(response?.message || 'Unable to join this institution.');
        }
        await loadHealthcareBroadcasts();
        Alert.alert('Membership', 'You are now a member of this institution.');
      } catch (error: any) {
        Alert.alert('Membership', error?.message || 'Unable to join this institution.');
      } finally {
        setJoiningInstitutionId('');
      }
    },
    [loadHealthcareBroadcasts],
  );

  const handleBookNow = useCallback(
    async (args: {
      institutionId: string;
      institutionName: string;
      cardId: string;
      serviceId: string;
      serviceName: string;
      serviceDescription?: string;
      date?: string;
      time?: string;
      status?: string;
      basePriceCents?: number;
      memberPriceCents?: number;
      institutionType?: string;
    }) => {
      const institutionId = String(args.institutionId || '').trim();
      if (!institutionId) {
        Alert.alert('Book now', 'Institution information is unavailable.');
        return;
      }
      const cardId = String(args.cardId || '').trim();
      if (!cardId) {
        Alert.alert('Book now', 'Card information is unavailable.');
        return;
      }

      const start = await startHealthServiceSession({
        institutionId,
        cardId,
        serviceId: args.serviceId,
        date: args.date,
        time: args.time,
      });
      if (!start?.success) {
        if (Number(start?.status) === 402) {
          const requiredMicro = Number(start?.data?.required_micro || 0);
          const availableMicro = Number(start?.data?.available_micro || 0);
          if (requiredMicro > 0 || availableMicro > 0) {
            Alert.alert(
              'Insufficient KIS balance',
              `You need ${toKisc(requiredMicro)} KISC but you only have ${toKisc(availableMicro)} KISC.`,
            );
          } else {
            Alert.alert('Insufficient KIS balance', 'Your KIS Coin balance is too low for this service.');
          }
          return;
        }
        throw new Error(start?.message || 'Unable to start this session.');
      }

      const sessions = Array.isArray(start?.data?.service_sessions) ? start.data.service_sessions : [];
      const startedSession = sessions.find(
        (item: any) =>
          String(item?.card_id || item?.cardId || '') === cardId &&
          String(item?.status || '') === 'started',
      );
      const legacySessionId = String(startedSession?.id || '');
      const workflowSessionId = String(start?.data?.session?.id || '').trim();
      const appointmentBookingId = String(start?.data?.booking?.id || '').trim();
      const sessionSource = String(start?.source || '').trim().toLowerCase() === 'health_ops' ? 'health_ops' : 'broadcasts';
      const sessionId = workflowSessionId || legacySessionId;
      console.log('sessionSource 1', sessionSource, 'sessionId', sessionId, 'workflowSessionId', workflowSessionId, 'appointmentBookingId', appointmentBookingId);

      navigation.navigate('HealthServiceSession', {
        institutionId,
        institutionType: (args.institutionType as any) || undefined,
        institutionName: args.institutionName,
        cardId,
        sessionId: sessionId || undefined,
        workflowSessionId: workflowSessionId || undefined,
        appointmentBookingId: appointmentBookingId || undefined,
        sessionSource,
        serviceId: args.serviceId,
        serviceName: args.serviceName,
        serviceDescription: args.serviceDescription,
        dateKey: args.date,
        timeValue: args.time,
        statusLabel: args.status,
        basePriceCents: args.basePriceCents,
        memberPriceCents: args.memberPriceCents,
      });
    },
    [navigation],
  );

  const filtered = useMemo(() => {
    const q = String(searchTerm || '').trim().toLowerCase();
    let base = [...items];

    if (q) {
      base = base.filter((item) => {
        const hay = `${item.title || ''} ${item.text || ''} ${item.health_card?.institution_name || ''}`.toLowerCase();
        return hay.includes(q);
      });
    }

    const context = String(searchContext || '').trim().toLowerCase();
    if (context === 'providers') {
      return base.sort((a, b) => String(a.health_card?.institution_name || '').localeCompare(String(b.health_card?.institution_name || '')));
    }
    if (context === 'services') {
      return base;
    }
    if (context === 'wellness') {
      return base.filter((item) => String(item.health_card?.status || '').toLowerCase() !== 'blocked');
    }

    return base;
  }, [items, searchContext, searchTerm]);

  const withTimeFilter = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    return filtered.filter((item) => {
      const [y, m, d] = String(item.health_card?.date || '')
        .split('-')
        .map((part) => Number(part));
      if (!y || !m || !d) return timeFilter !== 'today';
      const target = new Date(y, m - 1, d);
      if (timeFilter === 'today') return target >= todayStart && target < tomorrowStart;
      if (timeFilter === 'upcoming') return target >= tomorrowStart;
      return target < todayStart;
    });
  }, [filtered, timeFilter]);

  if (loading) {
    return (
      <View style={{ marginTop: 10, paddingHorizontal: 12, alignItems: 'center' }}>
        <ActivityIndicator color={palette.primary} />
        <Text style={{ color: palette.subtext, marginTop: 8 }}>Loading healthcare broadcasts...</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ marginTop: 10, paddingHorizontal: 12, paddingBottom: 120, gap: 12 }}>
      <View style={{ borderWidth: 2, borderColor: palette.divider, borderRadius: 18, padding: 10, backgroundColor: palette.surface }}>
        <Text style={{ color: palette.text, fontWeight: '800' }}>Health cards</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
          {(['today', 'upcoming', 'past'] as HealthTimeFilter[]).map((key) => (
            <KISButton
              key={key}
              size="xs"
              title={key[0].toUpperCase() + key.slice(1)}
              variant={timeFilter === key ? 'primary' : 'outline'}
              onPress={() => setTimeFilter(key)}
            />
          ))}
        </View>
      </View>

      {withTimeFilter.map((item) => {
        const card = item.health_card || {};
        const statusKey = String(card.status || 'available').toLowerCase();
        const statusColor = STATUS_COLOR[statusKey] || '#10B981';
        const institutionId = resolveInstitutionIdFromBroadcast(item);
        const institution = institutionMeta[institutionId];
        const institutionCardData = institutionDetails[institutionId];
        const cardId = String(card.card_id || '');
        const matchedCard = institutionCardData?.cardsById?.[cardId] || null;
        const service = matchedCard?.service || {};
        const serviceId = String(service?.id || card?.service_id || '');
        const bookingEngines = resolveBookingEngines(service, String(institution?.type || ''));
        const rating = institutionCardData?.ratingsByService?.[serviceId];
        const memberDiscount =
          institutionCardData?.membershipDiscountPercent ??
          clampDiscount(card?.membership_discount_pct) ??
          institution?.membershipDiscountPercent ??
          10;
        const membershipOpen =
          institutionCardData?.membershipOpen ??
          card?.membership_open ??
          institution?.membershipOpen ??
          false;
        const viewerIsMember = !!(institutionCardData?.viewerIsMember ?? card?.viewer_is_member ?? false);
        const viewerCanManage = !!(institutionCardData?.viewerCanManage ?? card?.viewer_can_manage ?? false);
        const logoUrl = resolveBackendAssetUrl(
          String(
            institution?.logoUrl || card.institution_logo_url || item.attachments?.[0]?.url || '',
          ).trim(),
        ) || String(institution?.logoUrl || card.institution_logo_url || item.attachments?.[0]?.url || '').trim();

        return (
          <View
            key={item.id}
            style={{
              borderWidth: 1,
              borderColor: palette.divider,
              borderRadius: 18,
              backgroundColor: palette.card,
              overflow: 'hidden',
            }}
          >
            <View style={{ height: 170, backgroundColor: palette.surface, alignItems: 'center', justifyContent: 'center' }}>
              {logoUrl ? (
                <Image source={{ uri: logoUrl }} resizeMode="cover" style={{ width: '100%', height: '100%' }} />
              ) : (
                <KISIcon name="heart" size={28} color={palette.primary} />
              )}
              {membershipOpen && !viewerIsMember && !viewerCanManage ? (
                <View style={{ position: 'absolute', left: 8, top: 8 }}>
                  <KISButton
                    title={joiningInstitutionId === institutionId ? 'Joining...' : 'Join Institution'}
                    size="xs"
                    onPress={() => {
                      handleJoinInstitution(institutionId).catch(() => undefined);
                    }}
                    disabled={joiningInstitutionId === institutionId}
                  />
                </View>
              ) : null}
              {institution?.landingExists ? (
                <View style={{ position: 'absolute', right: 8, bottom: 8 }}>
                  <KISButton
                    title="View"
                    size="xs"
                    variant="outline"
                    onPress={() => {
                      navigation.navigate('InstitutionLandingPreview', {
                        institutionId,
                        institutionType: institution?.type || undefined,
                        institutionName: institution?.name || card.institution_name || item.source?.name || 'Healthcare Institution',
                        draft: institution?.landingDraft || {},
                      });
                    }}
                  />
                </View>
              ) : null}
            </View>
            <View style={{ padding: 14 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: palette.text, fontWeight: '900', fontSize: 17, flex: 1, paddingRight: 8 }}>
                  {card.service_name || item.title || 'Health Service'}
                </Text>
                <View style={{ borderRadius: 999, backgroundColor: `${statusColor}22`, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Text style={{ color: statusColor, fontWeight: '800', fontSize: 12 }}>
                    {statusKey.replace('_', ' ')}
                  </Text>
                </View>
                <View style={{ borderRadius: 999, backgroundColor: `${palette.primary}22`, paddingHorizontal: 10, paddingVertical: 4, marginLeft: 6 }}>
                  <Text style={{ color: palette.primary, fontWeight: '800', fontSize: 12 }}>
                    {memberDiscount}% off members
                  </Text>
                </View>
              </View>

              <Text style={{ color: palette.subtext, marginTop: 4 }}>
                {card.service_description || item.text || 'No description provided.'}
              </Text>

              <Text style={{ color: palette.subtext, marginTop: 6, fontSize: 12 }}>
                {toDateLabel(card.date)}{card.time ? ` · ${card.time}` : ''}
              </Text>

              <Text style={{ color: palette.text, marginTop: 6, fontWeight: '700' }}>
                {institution?.name || card.institution_name || item.source?.name || 'Healthcare Institution'}
              </Text>

              <Text style={{ color: palette.text, marginTop: 6, fontWeight: '700' }}>
                Service price: {toMoney(service?.basePriceCents ?? service?.base_price_cents)}
              </Text>
              <Text style={{ color: palette.subtext, marginTop: 2 }}>
                Average rating: {rating ? rating.average.toFixed(1) : '0.0'} ({rating?.count ?? 0})
              </Text>

              <View
                style={{
                  marginTop: 10,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: `${palette.primary}55`,
                  backgroundColor: `${palette.primary}12`,
                  padding: 10,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: palette.text, fontWeight: '800' }}>Booking Engines</Text>
                  <Text style={{ color: palette.subtext, fontSize: 12 }}>{bookingEngines.length} ready</Text>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                  {bookingEngines.map((engine) => (
                    <View
                      key={`${item.id}-${engine.key}`}
                      style={{
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: `${engine.color}55`,
                        backgroundColor: engine.bgTint,
                        paddingHorizontal: 8,
                        paddingVertical: 6,
                        flexDirection: 'row',
                        alignItems: 'center',
                        minWidth: '47%',
                        flexGrow: 1,
                      }}
                    >
                      <View
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 11,
                          backgroundColor: '#FFFFFFAA',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <KISIcon name={engine.icon} size={12} color={engine.color} />
                      </View>
                      <View style={{ marginLeft: 8, flex: 1 }}>
                        <Text style={{ color: palette.text, fontSize: 12, fontWeight: '800' }}>
                          {engine.label}
                        </Text>
                        <Text style={{ color: palette.subtext, fontSize: 10 }}>
                          {engine.subtitle}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
                <Text style={{ color: palette.subtext, marginTop: 6, fontSize: 12 }}>
                  These engines activate contextually after Book Now.
                </Text>
              </View>

              <View style={{ marginTop: 10 }}>
                <KISButton
                  title="Book Now"
                  onPress={() => {
                    handleBookNow({
                      institutionId,
                      institutionName:
                        card.institution_name || item.source?.name || 'Healthcare Institution',
                      cardId,
                      serviceId,
                      serviceName: card.service_name || item.title || 'Health Service',
                      serviceDescription: card.service_description || item.text || '',
                      date: card.date,
                      time: card.time,
                      status: statusKey.replace('_', ' '),
                      basePriceCents: Number(service?.basePriceCents ?? service?.base_price_cents),
                      memberPriceCents: Number.isFinite(Number(service?.basePriceCents ?? service?.base_price_cents))
                        ? Math.round(
                            Number(service?.basePriceCents ?? service?.base_price_cents) *
                              (100 - memberDiscount) /
                              100,
                          )
                        : undefined,
                      institutionType: institution?.type,
                    }).catch((error: any) => {
                      Alert.alert('Book now', error?.message || 'Unable to start this session.');
                    });
                  }}
                />
              </View>
            </View>
          </View>
        );
      })}

      {withTimeFilter.length === 0 ? (
        <View style={{ borderWidth: 2, borderColor: palette.divider, borderRadius: 18, padding: 14, backgroundColor: palette.surface }}>
          <Text style={{ color: palette.text, fontWeight: '800' }}>No healthcare broadcasts yet</Text>
          <Text style={{ color: palette.subtext, marginTop: 4 }}>
            Broadcasted health cards will appear here under the Healthcare tab.
          </Text>
        </View>
      ) : null}

      <TouchableOpacity onPress={() => loadHealthcareBroadcasts().catch(() => undefined)}>
        <Text style={{ color: palette.primary, fontWeight: '800', textAlign: 'center' }}>Refresh healthcare broadcasts</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
