// src/screens/tabs/profile/useProfileController.ts
import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { Asset, launchImageLibrary } from 'react-native-image-picker';

import { postRequest } from '@/network/post';
import { getRequest } from '@/network/get';
import { patchRequest } from '@/network/patch';
import { deleteRequest } from '@/network/delete';
import ROUTES from '@/network';
import { CacheConfig } from '@/network/cacheKeys';

import { DraftProfile, ItemType, PickedImage, PrefsDraft, ProfilePayload, SheetType } from './profile.types';
import { makeUUID, parseCsv } from './profile.utils';
import { profileLayout } from './profile.styles';
import { tierMetaFor } from './profile/tierMeta';
import type { FeedMediaType, FeedMediaOptions } from '../profile-screen/types';

const MICROS_PER_KISC = 100000;

export const useProfileController = (opts: { setAuth: (v: boolean) => void; setPhone?: (v: any) => void }) => {
  const { setAuth, setPhone } = opts;

  const [profile, setProfile] = useState<ProfilePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [walletLedger, setWalletLedger] = useState<any[]>([]);
  const [billingHistory, setBillingHistory] = useState<any>({
    ledger: [],
    transactions: [],
    subscription: null,
    usage: null,
  });
  const [broadcastProfiles, setBroadcastProfiles] = useState<Record<string, any> | null>(null);
  const [activeSheet, setActiveSheet] = useState<SheetType | null>(null);
  const [showCreatePartner, setShowCreatePartner] = useState(false);
  const [partnerActionId, setPartnerActionId] = useState<string | null>(null);
  const [kisWallet, setKisWallet] = useState<{
    balance_micro: number;
    balance_kisc: string;
    balance_usd: string;
  }>({
    balance_micro: 0,
    balance_kisc: '0.000',
    balance_usd: '0.00',
  });
  const [lastWalletPaymentUrl, setLastWalletPaymentUrl] = useState('');

  const [draftProfile, setDraftProfile] = useState<DraftProfile>({
    display_name: '',
    headline: '',
    bio: '',
    industry: '',
    avatar_url: '',
    cover_url: '',
  });

  const [draftItem, setDraftItem] = useState<any>(null);
  const [draftPrivacy, setDraftPrivacy] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);

  const [prefsDraft, setPrefsDraft] = useState<PrefsDraft>({
    services: [],
    availability: {},
    skill_badges: [],
    languages: [],
    location: {},
    compensation: {},
    social_proof: {},
    ask_tags: [],
    highlights: [],
  });

  const [walletForm, setWalletForm] = useState({
    mode: 'add_kisc',
    provider: 'flutterwave',
    amount: '',
    recipient: '',
    reference: '',
  });

  const slideX = useRef(new Animated.Value(profileLayout.SCREEN_WIDTH)).current;
  const sheetY = useRef(new Animated.Value(profileLayout.SCREEN_HEIGHT)).current;
  const loadingRef = useRef(false);
  const lastFetchRef = useRef(0);
  const profileRateLimitedUntilRef = useRef(0);
  const profileNetworkFreshUntilRef = useRef(0);

  const applyProfilePayload = useCallback((payload: ProfilePayload) => {
    setProfile(payload);

    setDraftProfile({
      display_name: payload?.user?.display_name || '',
      headline: payload?.profile?.headline || '',
      bio: payload?.profile?.bio || '',
      industry: payload?.profile?.industry || '',
      avatar_url: payload?.profile?.avatar_url || '',
      cover_url: payload?.profile?.cover_url || '',
      avatar_file: null,
      cover_file: null,
      avatar_preview: payload?.profile?.avatar_url || '',
      cover_preview: payload?.profile?.cover_url || '',
    });

    const prefs = payload?.preferences || {};
    setPrefsDraft({
      services: prefs.services || [],
      availability: prefs.availability || {},
      skill_badges: prefs.skill_badges || [],
      languages: prefs.languages || [],
      location: prefs.location || {},
      compensation: prefs.compensation || {},
      social_proof: prefs.social_proof || {},
      ask_tags: prefs.ask_tags || [],
      highlights: prefs.highlights || [],
    });

    const rules = payload?.privacy || [];
    const mapped: Record<string, any> = {};
    rules.forEach((rule: any) => (mapped[rule.field_key] = rule));
    setDraftPrivacy(mapped);
  }, []);

  const openSheet = (type: SheetType) => {
    setActiveSheet(type);
    Animated.timing(sheetY, { toValue: 0, duration: 260, useNativeDriver: true }).start();
    if (type === 'upgrade') loadBillingHistory();
  };

  const closeSheet = () => {
    Animated.timing(sheetY, { toValue: profileLayout.SCREEN_HEIGHT, duration: 240, useNativeDriver: true }).start(() => {
      setActiveSheet(null);
      setDraftItem(null);
    });
  };

  const openCreatePartner = () => {
    setShowCreatePartner(true);
    Animated.timing(slideX, { toValue: 0, duration: 250, useNativeDriver: true }).start();
  };

  const closeCreatePartner = () => {
    Animated.timing(slideX, { toValue: profileLayout.SCREEN_WIDTH, duration: 250, useNativeDriver: true }).start(() => {
      setShowCreatePartner(false);
    });
  };

  const loadKisWallet = useCallback(async (fallbackWalletBalanceCents?: number) => {
    const res = await getRequest(ROUTES.healthOps.walletMe, {
      errorMessage: 'Unable to load KIS wallet.',
    });
    if (res?.success) {
      const wallet = res?.data?.wallet || {};
      const micro = Number(wallet?.balance_micro ?? 0);
      const safeMicro = Number.isFinite(micro) ? Math.max(0, Math.floor(micro)) : 0;
      const kisc = Number(wallet?.balance_kisc);
      const usd = Number(wallet?.balance_usd);
      setKisWallet({
        balance_micro: safeMicro,
        balance_kisc: Number.isFinite(kisc) ? kisc.toFixed(3) : (safeMicro / MICROS_PER_KISC).toFixed(3),
        balance_usd: Number.isFinite(usd) ? usd.toFixed(2) : ((safeMicro / MICROS_PER_KISC) * 100).toFixed(2),
      });
      return;
    }

    const cents = Number(fallbackWalletBalanceCents ?? profile?.account?.wallet_balance_cents ?? 0);
    const safeCents = Number.isFinite(cents) ? Math.max(0, Math.floor(cents)) : 0;
    const fallbackMicro = safeCents * 1000;
    setKisWallet({
      balance_micro: fallbackMicro,
      balance_kisc: (fallbackMicro / MICROS_PER_KISC).toFixed(3),
      balance_usd: (safeCents / 100).toFixed(2),
    });
  }, [profile?.account?.wallet_balance_cents]);

  const loadWalletLedger = useCallback(async () => {
    const res = await getRequest(ROUTES.healthOps.walletTransactions, {
      errorMessage: 'Unable to load KIS transactions.',
    });
    if (res?.success) {
      const rows = Array.isArray(res?.data?.results) ? res.data.results : [];
      const mapped = rows.map((row: any) => ({
        id: String(row?.id || ''),
        kind: String(row?.transaction_type || 'entry'),
        amount_micro: Number(row?.amount_micro || 0),
        reference: String(row?.reference || ''),
        created_at: String(row?.created_at || new Date().toISOString()),
        metadata: row?.metadata || {},
      }));
      setWalletLedger(mapped);
      return;
    }

    const legacy = await getRequest(ROUTES.wallet.ledger);
    if (legacy?.success) {
      setWalletLedger(legacy.data?.results || legacy.data?.data?.results || []);
    }
  }, []);

  const loadBillingHistory = useCallback(async () => {
    const res = await getRequest(ROUTES.wallet.billingHistory);
    if (res?.success) {
      setBillingHistory({
        ledger: res.data?.ledger || [],
        transactions: res.data?.transactions || [],
        subscription: res.data?.subscription || null,
        usage: res.data?.usage || null,
        invoice_url: res.data?.invoice_url,
        invoice_pdf_url: res.data?.invoice_pdf_url,
      });
    }
  }, []);

  const loadBroadcastProfiles = useCallback(async () => {
    const res = await getRequest(ROUTES.broadcasts.createProfile);
    if (res?.success) {
      setBroadcastProfiles(res.data?.profiles ?? {});
    }
  }, []);

  const uploadProfileAttachment = useCallback(
    async (asset: Asset, context?: string) => {
      if (!asset?.uri) throw new Error('No asset supplied.');
      const form = new FormData();
      form.append('attachment', {
        uri: asset.uri,
        name: asset.fileName || `attachment-${Date.now()}`,
        type: asset.type || 'application/octet-stream',
      } as any);
      if (context) form.append('context', context);
      const res = await postRequest(ROUTES.broadcasts.profileAttachment, form);
      if (!res?.success) throw new Error(res?.message || 'Upload failed.');
      return res.data?.attachment ?? null;
    },
    [],
  );

  type BroadcastAttachmentPayload = { uri: string; name: string; type: string };

  const appendBroadcastAttachments = useCallback((form: FormData, files?: BroadcastAttachmentPayload[]) => {
    (files ?? []).forEach((file) => {
      if (file?.uri) {
        form.append('attachments', {
          uri: file.uri,
          name: file.name,
          type: file.type,
        } as any);
      }
    });
  }, []);

  const manageProfileSection = useCallback(
    async (profileType: 'health_profile' | 'market_profile' | 'education_profile', updates: Record<string, any>) => {
      const res = await postRequest(ROUTES.broadcasts.profileManage, {
        profile_type: profileType,
        updates,
      });
      if (!res?.success) throw new Error(res?.message || 'Unable to update profile.');
      await loadBroadcastProfiles();
      return res.data?.profile ?? null;
    },
    [loadBroadcastProfiles],
  );

  const addBroadcastFeedEntry = useCallback(
    async (
      title: string,
      summary: string,
      mediaType: FeedMediaType,
      attachments?: BroadcastAttachmentPayload[],
      mediaOptions?: FeedMediaOptions[FeedMediaType],
    ) => {
      const form = new FormData();
      form.append('title', title);
      form.append('summary', summary);
      form.append('media_type', mediaType);
      appendBroadcastAttachments(form, attachments);
      form.append('media_options', JSON.stringify(mediaOptions ?? {}));
      const res = await postRequest(ROUTES.broadcasts.feedProfile, form);
      if (res?.success) {
        await loadBroadcastProfiles();
        return res.data?.feed ?? null;
      }
      throw new Error(res?.message || 'Unable to add broadcast item.');
    },
    [appendBroadcastAttachments, loadBroadcastProfiles],
  );

  const updateBroadcastFeedEntry = useCallback(
    async (
      id: string,
      title: string,
      summary: string,
      mediaType: FeedMediaType,
      attachments?: BroadcastAttachmentPayload[],
      retainAttachments?: any[],
      mediaOptions?: FeedMediaOptions[FeedMediaType],
    ) => {
      const form = new FormData();
      form.append('title', title);
      form.append('summary', summary);
      form.append('media_type', mediaType);
      appendBroadcastAttachments(form, attachments);
      if (retainAttachments?.length) {
        form.append('retain_attachments', JSON.stringify(retainAttachments));
      }
      form.append('media_options', JSON.stringify(mediaOptions ?? {}));
      const res = await patchRequest(ROUTES.broadcasts.feedEntry(id), form);
      if (res?.success) {
        await loadBroadcastProfiles();
        return res.data?.feed ?? null;
      }
      throw new Error(res?.message || 'Unable to update broadcast item.');
    },
    [appendBroadcastAttachments, loadBroadcastProfiles],
  );

  const deleteBroadcastFeedEntry = useCallback(
    async (id: string) => {
      const res = await deleteRequest(ROUTES.broadcasts.feedEntry(id));
      if (res?.success) {
        await loadBroadcastProfiles();
        return true;
      }
      throw new Error(res?.message || 'Unable to delete broadcast item.');
    },
    [loadBroadcastProfiles],
  );

  const removeBroadcastFeedAttachment = useCallback(
    async (entryId: string, key: string) => {
      const endpoint = `${ROUTES.broadcasts.feedEntryAttachment(entryId)}?key=${encodeURIComponent(key)}`;
      const res = await deleteRequest(endpoint, {
        errorMessage: 'Unable to remove attachment.',
      });
      if (res?.success) {
        await loadBroadcastProfiles();
        return res.data?.feed ?? null;
      }
      throw new Error(res?.message || 'Unable to remove attachment.');
    },
    [loadBroadcastProfiles],
  );

  const broadcastFeedEntry = useCallback(
    async (id: string) => {
      const res = await postRequest(ROUTES.broadcasts.feedEntryBroadcast(id), {});
      if (res?.success) {
        await loadBroadcastProfiles();
        return res.data?.feed ?? null;
      }
      throw new Error(res?.message || 'Unable to broadcast feed item.');
    },
    [loadBroadcastProfiles],
  );

  const loadProfile = useCallback(async () => {
    const now = Date.now();
    if (loadingRef.current) return;
    if (now < profileRateLimitedUntilRef.current) return;
    if (now - lastFetchRef.current < 1200) return;

    loadingRef.current = true;
    lastFetchRef.current = now;

    const cacheKey = 'kis_profile_cache_v1';
    if (!profile) setLoading(true);

    try {
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) {
        const cachedPayload = JSON.parse(cached) as ProfilePayload;
        applyProfilePayload(cachedPayload);
        loadKisWallet(cachedPayload?.account?.wallet_balance_cents);
        loadWalletLedger();
        loadBroadcastProfiles();
        setLoading(false);
        profileNetworkFreshUntilRef.current = Date.now() + 60 * 1000;
        return;
      }

      const res = await getRequest(ROUTES.profiles.me, {
        cacheKey: CacheConfig.userProfile.key,
        cacheType: CacheConfig.userProfile.type,
      });

      if (res.success) {
        const payload = res.data as ProfilePayload;
        applyProfilePayload(payload);
        profileNetworkFreshUntilRef.current = Date.now() + 60 * 1000;
        loadKisWallet(payload?.account?.wallet_balance_cents);
        loadWalletLedger();
        await loadBroadcastProfiles();
        await AsyncStorage.setItem(cacheKey, JSON.stringify(payload));
      } else {
        if (Number(res?.status) === 429) {
          profileRateLimitedUntilRef.current = Date.now() + 15000;
          return;
        }
        setProfile(null);
        Alert.alert('Profile', res.message || 'Could not load profile');
      }
    } catch (e: any) {
      setProfile(null);
      Alert.alert('Profile', e?.message ?? 'Could not load profile');
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [applyProfilePayload, loadKisWallet, loadWalletLedger, profile, loadBroadcastProfiles]);

  useFocusEffect(useCallback(() => { loadProfile(); }, [loadProfile]));

  const logout = async () => {
    try {
      const server = await postRequest(ROUTES.auth.logout, {}, { errorMessage: 'Server logout failed.' });
      if (!server?.success) console.log(server?.message);

      await AsyncStorage.multiRemove(['access_token', 'refresh_token', 'user_phone']);
      setPhone?.(null);
      setAuth(false);
    } catch (e: any) {
      Alert.alert('Logout error', e?.message ?? 'Could not log out.');
    }
  };

  const runPartnerAction = useCallback(
    async (partnerId: string, action: 'deactivate' | 'reactivate' | 'delete') => {
      const endpoint =
        action === 'deactivate'
          ? ROUTES.partners.deactivate(partnerId)
          : action === 'reactivate'
          ? ROUTES.partners.reactivate(partnerId)
          : ROUTES.partners.remove(partnerId);
      setPartnerActionId(partnerId);
      try {
        const response = await postRequest(endpoint, {});
        if (!response.success) {
          throw new Error(response.message || 'Unable to perform action');
        }
        await loadProfile();
      } catch (error: any) {
        Alert.alert('Partner', error?.message || 'Unable to complete the action.');
      } finally {
        setPartnerActionId(null);
      }
    },
    [loadProfile],
  );

  const openEditProfile = () => {
    setDraftProfile((prev) => ({
      ...prev,
      display_name: profile?.user?.display_name || '',
      headline: profile?.profile?.headline || '',
      bio: profile?.profile?.bio || '',
      industry: profile?.profile?.industry || '',
      avatar_url: profile?.profile?.avatar_url || '',
      cover_url: profile?.profile?.cover_url || '',
      avatar_file: null,
      cover_file: null,
      avatar_preview: profile?.profile?.avatar_url || '',
      cover_preview: profile?.profile?.cover_url || '',
    }));
    openSheet('editProfile');
  };

  const pickImage = async (kind: 'avatar' | 'cover') => {
    const result = await launchImageLibrary({ mediaType: 'photo', quality: 1, selectionLimit: 1 });
    if (result.didCancel) return;

    const asset = result.assets?.[0];
    if (!asset?.uri) return;

    const name = asset.fileName || `${kind}_${Date.now()}.${(asset.type || 'image/jpeg').split('/')[1] || 'jpg'}`;
    const file: PickedImage = { uri: asset.uri, name, type: asset.type || 'image/jpeg' };

    setDraftProfile((prev) => ({ ...prev, [`${kind}_file`]: file, [`${kind}_preview`]: asset.uri } as any));
  };

  const pickShowcaseFile = async (type: ItemType) => {
    const isVideo = type === 'intro_video';
    const result = await launchImageLibrary({ mediaType: isVideo ? 'video' : 'photo', quality: 1, selectionLimit: 1 });
    if (result.didCancel) return null;

    const asset = result.assets?.[0];
    if (!asset?.uri) return null;

    const name =
      asset.fileName ||
      `${type}_${Date.now()}.${(asset.type || (isVideo ? 'video/mp4' : 'image/jpeg')).split('/')[1] || 'bin'}`;

    return { uri: asset.uri, name, type: asset.type || (isVideo ? 'video/mp4' : 'image/jpeg') } as PickedImage;
  };

  const saveProfile = async () => {
    if (!profile) return;
    setSaving(true);

    try {
      const userId = profile.user?.id;
      const profileId = profile?.profile?.id;

      if (userId) await patchRequest(ROUTES.user.detail(userId), { display_name: draftProfile.display_name?.trim() });

      if (profileId) {
        const form = new FormData();
        form.append('headline', draftProfile.headline?.trim() || '');
        form.append('bio', draftProfile.bio?.trim() || '');
        form.append('industry', draftProfile.industry?.trim() || '');

        if (draftProfile.avatar_file?.uri) {
          form.append('avatar_file', {
            uri: draftProfile.avatar_file.uri,
            name: draftProfile.avatar_file.name,
            type: draftProfile.avatar_file.type,
          } as any);
        }
        if (draftProfile.cover_file?.uri) {
          form.append('cover_file', {
            uri: draftProfile.cover_file.uri,
            name: draftProfile.cover_file.name,
            type: draftProfile.cover_file.type,
          } as any);
        }
        await patchRequest(ROUTES.profiles.update(profileId), form);
      }
    } finally {
      setSaving(false);
      closeSheet();
      loadProfile();
    }
  };

  const savePrivacy = async () => {
    setSaving(true);
    try {
      for (const [key, rule] of Object.entries(draftPrivacy)) {
        const payload = { field_key: key, visibility: rule?.visibility || 'public', allow_user_ids: rule?.allow_user_ids || [] };
        if (rule?.id) await patchRequest(ROUTES.profilePrivacy.detail(rule.id), payload);
        else await postRequest(ROUTES.profilePrivacy.list, payload);
      }
    } finally {
      setSaving(false);
      closeSheet();
      loadProfile();
    }
  };

  const openItemEditor = (type: ItemType, item?: any) => {
    const draft = item ? { ...item } : {};
    if (type === 'skill' && !draft.skill_id) draft.skill_id = makeUUID();
    setDraftItem({ type, data: draft });
    openSheet('editItem');
  };

  const saveItem = async () => {
    if (!draftItem) return;
    setSaving(true);

    try {
      const type = draftItem.type as ItemType;
      const data = draftItem.data ?? {};
      const baseMap: Record<ItemType, string | null> = {
        experience: ROUTES.profileItems.experiences,
        education: ROUTES.profileItems.educations,
        project: ROUTES.profileItems.projects,
        skill: ROUTES.profileItems.skills,
        article: ROUTES.profileArticles.list,
        portfolio: ROUTES.profileShowcases.list,
        case_study: ROUTES.profileShowcases.list,
        testimonial: ROUTES.profileShowcases.list,
        certification: ROUTES.profileShowcases.list,
        intro_video: ROUTES.profileShowcases.list,
        highlight: ROUTES.profileShowcases.list,

        service: null,
        availability: null,
        language: null,
        location: null,
        compensation: null,
        ask_tag: null,
        social_proof: null,
        skill_badge: null,
      };

      const payload = { ...data };

      if (type === 'skill' && !payload.skill_id) payload.skill_id = makeUUID();
      if (type === 'project') payload.technologies = parseCsv(payload.technologies);
      if (type === 'article') payload.tags = parseCsv(payload.tags);

      const isPreference =
        type === 'service' ||
        type === 'availability' ||
        type === 'language' ||
        type === 'location' ||
        type === 'compensation' ||
        type === 'ask_tag' ||
        type === 'social_proof' ||
        type === 'skill_badge';

      if (isPreference) {
        const nextPrefs: PrefsDraft = { ...prefsDraft };

        if (type === 'service') nextPrefs.services = [...nextPrefs.services, payload];
        if (type === 'language') nextPrefs.languages = [...nextPrefs.languages, payload];
        if (type === 'ask_tag') nextPrefs.ask_tags = [...nextPrefs.ask_tags, payload.label].filter(Boolean);
        if (type === 'availability') nextPrefs.availability = payload;
        if (type === 'location') nextPrefs.location = payload;
        if (type === 'compensation') nextPrefs.compensation = payload;
        if (type === 'social_proof') nextPrefs.social_proof = payload;
        if (type === 'skill_badge') nextPrefs.skill_badges = [...nextPrefs.skill_badges, payload];

        setPrefsDraft(nextPrefs);

        const prefId = profile?.preferences?.id;
        if (prefId) await patchRequest(ROUTES.profilePreferences.detail(prefId), nextPrefs);
        else await postRequest(ROUTES.profilePreferences.list, nextPrefs);
      } else {
        const baseUrl = baseMap[type];
        if (!baseUrl) return;

        if (
          type === 'portfolio' ||
          type === 'case_study' ||
          type === 'testimonial' ||
          type === 'certification' ||
          type === 'intro_video' ||
          type === 'highlight'
        ) payload.type = type;

        if (payload.file?.uri) {
          const form = new FormData();
          Object.keys(payload).forEach((k) => { if (k !== 'file') form.append(k, payload[k] ?? ''); });
          form.append('file', { uri: payload.file.uri, name: payload.file.name, type: payload.file.type } as any);
          if (payload.id) await patchRequest(`${baseUrl}${payload.id}/`, form);
          else await postRequest(baseUrl, form);
        } else {
          if (payload.id) await patchRequest(`${baseUrl}${payload.id}/`, payload);
          else await postRequest(baseUrl, payload);
        }
      }
    } finally {
      setSaving(false);
      closeSheet();
      loadProfile();
    }
  };

  const deleteItem = async (type: ItemType, itemId: string) => {
    const baseMap: Record<ItemType, string | null> = {
      experience: ROUTES.profileItems.experiences,
      education: ROUTES.profileItems.educations,
      project: ROUTES.profileItems.projects,
      skill: ROUTES.profileItems.skills,
      article: ROUTES.profileArticles.list,
      portfolio: ROUTES.profileShowcases.list,
      case_study: ROUTES.profileShowcases.list,
      testimonial: ROUTES.profileShowcases.list,
      certification: ROUTES.profileShowcases.list,
      intro_video: ROUTES.profileShowcases.list,
      highlight: ROUTES.profileShowcases.list,
      service: null,
      availability: null,
      language: null,
      location: null,
      compensation: null,
      ask_tag: null,
      social_proof: null,
      skill_badge: null,
    };
    const baseUrl = baseMap[type];
    if (!baseUrl) return;
    await deleteRequest(`${baseUrl}${itemId}/`);
    loadProfile();
  };

  const upgradeTier = async (tierId: string) => {
    const tiers = profile?.tiers || [];
    const tier = tiers.find((t: any) => String(t?.id) === String(tierId));
    const tierName = String(tier?.name || tier?.code || tier?.slug || '').toLowerCase();
    const isPartnerTier = tierName.includes('partner');
    const priceCents = Number(tier?.price_cents || 0);
    const currentTier = profile?.tier || profile?.subscription?.tier;
    const currentRank = tierMetaFor(currentTier || {}).tierRank ?? 0;
    const targetRank = tierMetaFor(tier || {}).tierRank ?? 0;

    if (targetRank < currentRank) {
      await downgradeTier(tierId);
      return;
    }
    if (targetRank === currentRank) {
      Alert.alert('Upgrade', 'You already have this tier; no change necessary.');
      return;
    }

    setSaving(true);
    const res = await postRequest(ROUTES.wallet.upgrade, {
      tier: tierId,
      payment_method:
        priceCents > 0 && (profile?.account?.credits_value_cents ?? 0) >= priceCents
          ? 'credits'
          : 'card',
    });
    setSaving(false);

    if (!res?.success) {
      Alert.alert('Upgrade', res?.message || 'Could not upgrade');
      return;
    }

    const paymentUrl = res?.data?.payment_url;
    if (paymentUrl) {
      Alert.alert('Complete payment', 'Open Flutterwave to finish your upgrade.', [
        { text: 'Later', style: 'cancel' },
        { text: 'Open', onPress: () => Linking.openURL(paymentUrl) },
      ]);
      closeSheet();
      return;
    }

    closeSheet();
    loadProfile();
    if (isPartnerTier) openCreatePartner();
  };

  const cancelSubscription = async (immediate = false) => {
    setSaving(true);
    const res = await postRequest(ROUTES.wallet.subscriptionCancel, { immediate });
    setSaving(false);
    if (!res?.success) {
      Alert.alert('Subscription', res?.message || 'Unable to cancel subscription.');
      return;
    }
    loadBillingHistory();
    loadProfile();
  };

  const resumeSubscription = async () => {
    setSaving(true);
    const res = await postRequest(ROUTES.wallet.subscriptionResume, {});
    setSaving(false);
    if (!res?.success) {
      Alert.alert('Subscription', res?.message || 'Unable to resume subscription.');
      return;
    }
    loadBillingHistory();
    loadProfile();
  };

  const downgradeTier = async (tierId: string) => {
    setSaving(true);
    const res = await postRequest(ROUTES.wallet.subscriptionDowngrade, { tier: tierId });
    setSaving(false);
    if (!res?.success) {
      Alert.alert('Downgrade', res?.message || 'Unable to schedule downgrade.');
      return;
    }
    loadBillingHistory();
  };

  const retryTransaction = async (txRef: string) => {
    setSaving(true);
    const res = await postRequest(ROUTES.wallet.transactionRetry, { tx_ref: txRef });
    setSaving(false);
    if (!res?.success) {
      Alert.alert('Payment', res?.message || 'Unable to retry payment.');
      return;
    }
    const paymentUrl = res?.data?.payment_url;
    if (paymentUrl) {
      Linking.openURL(paymentUrl);
    }
  };

  const submitWalletAction = async () => {
    const amountKisc = Number(walletForm.amount || 0);
    const amountMicro = Number.isFinite(amountKisc) ? Math.round(amountKisc * MICROS_PER_KISC) : 0;
    const mode = String(walletForm.mode || '').trim().toLowerCase();

    setSaving(true);
    setLastWalletPaymentUrl('');
    let res: any = null;

    if (!amountMicro || amountMicro < 1) {
      setSaving(false);
      Alert.alert('Wallet', 'Enter a valid KIS Coin amount.');
      return;
    }

    const isCredit =
      mode === 'add_kisc' ||
      mode === 'deposit' ||
      mode === 'cash_to_credits' ||
      mode === 'points_to_credits' ||
      mode === 'promo';
    const transactionType = isCredit ? 'credit' : 'debit';
    const reference = String(walletForm.reference || `${mode || 'wallet'}:${Date.now()}`).trim();

    if (!reference) {
      setSaving(false);
      Alert.alert('Wallet', 'Reference is required.');
      return;
    }

    res = await postRequest(
      ROUTES.healthOps.walletTransactions,
      {
        transaction_type: transactionType,
        amount_micro: amountMicro,
        reference,
        metadata: {
          source: 'profile_wallet',
          mode,
          recipient_id: mode === 'transfer' ? String(walletForm.recipient || '').trim() : undefined,
        },
      },
      {
        errorMessage: 'Unable to update KIS wallet.',
      },
    );

    setSaving(false);

    if (!res?.success) {
      const msg = res?.message || 'Action failed';
      Alert.alert('Wallet', msg);
      return;
    }

    closeSheet();
    loadKisWallet();
    loadWalletLedger();
    loadProfile();
  };

  const sectionList = useMemo(() => {
    const s = profile?.sections;
    return [
      { key: 'experience', title: 'Experience', items: s?.experiences || [] },
      { key: 'education', title: 'Education', items: s?.educations || [] },
      { key: 'project', title: 'Projects', items: s?.projects || [] },
      { key: 'skill', title: 'Skills', items: s?.skills || [] },
      { key: 'portfolio', title: 'Portfolio Gallery', items: s?.showcases?.portfolio || [] },
      { key: 'case_study', title: 'Case Studies', items: s?.showcases?.case_study || [] },
      { key: 'testimonial', title: 'Testimonials', items: s?.showcases?.testimonial || [] },
      { key: 'certification', title: 'Certifications', items: s?.showcases?.certification || [] },
      { key: 'intro_video', title: 'Intro Video', items: s?.showcases?.intro_video || [] },
      { key: 'highlight', title: 'Highlights', items: s?.showcases?.highlight || [] },
    ];
  }, [profile]);

  return {
    // state
    profile,
    loading,
    walletLedger,
    kisWallet,
    billingHistory,
    activeSheet,
    showCreatePartner,
    draftProfile,
    draftItem,
    draftPrivacy,
    saving,
    prefsDraft,
    walletForm,
    lastWalletPaymentUrl,
    partnerActionId,
    broadcastProfiles,

    // setters
    setDraftProfile,
    setDraftItem,
    setDraftPrivacy,
    setWalletForm,

    // anim refs
    slideX,
    sheetY,

    // actions
    loadProfile,
    logout,
    openSheet,
    closeSheet,
    openEditProfile,
    pickImage,
    pickShowcaseFile,
    saveProfile,
    savePrivacy,
    openItemEditor,
    saveItem,
    deleteItem,
    upgradeTier,
    cancelSubscription,
    resumeSubscription,
    downgradeTier,
    retryTransaction,
    refreshBroadcastProfiles: loadBroadcastProfiles,
    submitWalletAction,
    openCreatePartner,
    closeCreatePartner,
    deactivatePartnerProfile: (id: string) => runPartnerAction(id, 'deactivate'),
    reactivatePartnerProfile: (id: string) => runPartnerAction(id, 'reactivate'),
    deletePartnerProfile: (id: string) => runPartnerAction(id, 'delete'),
    uploadProfileAttachment,
    manageProfileSection,
    addBroadcastFeedEntry,
    updateBroadcastFeedEntry,
    deleteBroadcastFeedEntry,
    removeBroadcastFeedAttachment,
    broadcastFeedEntry,

    // derived
    sectionList,
  };
};
