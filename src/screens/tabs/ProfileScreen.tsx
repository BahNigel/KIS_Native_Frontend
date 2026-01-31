// src/screens/tabs/profile/ProfileScreen.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  DeviceEventEmitter,
  Image,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import KISButton from '@/constants/KISButton';
import KISTextInput from '@/constants/KISTextInput';
import Skeleton from '@/components/common/Skeleton';
import PartnerCreateSlide from '@/components/partners/CreatePartnerScreen';
import PartnerProfilesList from './profile/components/PartnerProfilesList';
import { KISIcon } from '@/constants/kisIcons';
import { useAuth } from '../../../App';
import { launchImageLibrary, Asset } from 'react-native-image-picker';
import { profileLayout, styles } from './profile/profile.styles';
import { useProfileController } from './profile/useProfileController';
import { formatMoney } from './profile/profile.utils';
import UpgradeSheet from './profile/profile/sheets/UpgradeSheet';
import { fieldLabels, visibilityOptions, walletModes, paymentProviders } from './profile/profile.constants';
import { getAttachmentPreviewInfo } from '@/components/broadcast/attachmentPreview';
import { getRequest } from '@/network/get';
import ROUTES from '@/network';

import HeroHeader from './profile/components/HeroHeader';
import AccountCreditsCard from './profile/components/AccountCreditsCard';
import SectionCard from './profile/components/SectionCard';
import EducationCreatorConsole from './profile/components/EducationCreatorConsole';
import { isPartnerTier } from '@/services/tierAccess';

import BottomSheet from './profile/sheets/BottomSheet';
import SheetHeader from './profile/sheets/SheetHeader';
import type {
  BroadcastTabId,
  BroadcastCreationType,
  BroadcastProfileKey,
  MainTabsParamList,
  RootStackParamList,
} from '@/navigation/types';

type HealthInstitutionType =
  | 'clinic'
  | 'hospital'
  | 'lab'
  | 'wellness_center'
  | 'pharmacy'
  | 'diagnostics';

const HEALTH_INSTITUTION_TYPES: HealthInstitutionType[] = [
  'clinic',
  'hospital',
  'lab',
  'wellness_center',
  'pharmacy',
  'diagnostics',
];

type HealthFormState = {
  id?: string;
  name: string;
  type: HealthInstitutionType;
  employees: string;
};

type MarketFormState = {
  id?: string;
  name: string;
  products: string;
};

type EducationFormState = {
  id?: string;
  title: string;
  summary: string;
};

const FEED_MEDIA_TYPES = ['video', 'audio', 'image', 'file', 'text'] as const;
type FeedMediaType = (typeof FEED_MEDIA_TYPES)[number];

const PROFILE_MANAGEMENT_TYPE: Record<
  Exclude<BroadcastProfileKey, 'broadcast_feed'>,
  'health_profile' | 'market_profile' | 'education_profile'
> = {
  health: 'health_profile',
  market: 'market_profile',
  education: 'education_profile',
};

const HEALTH_MANAGEMENT_FEATURES = [
  'Telemedicine scheduling + reminders',
  'Clinical task assignments + accountability',
  'Patient intake automation',
  'Care team command center',
  'Inventory + diagnostics tracker',
  'Clinical analytics + population insights',
  'Compliance audit log',
  'Emergency escalation workflows',
  'Telehealth triage automation + decision support',
  'Medication adherence + refill reminders',
  'Credential verification + licensing dashboards',
  'Billing & insurance reconciliation workflows',
  'Clinical event reporting + logging',
  'Patient satisfaction scoring & outreach campaigns',
  'Wellness challenge + habit tracking programs',
  'Secure e-signature & document exchange',
  'Referral network heatmaps & routing',
  'Regulatory reporting & compliance dashboards',
];

const MARKET_MANAGEMENT_FEATURES = [
  'Inventory health dashboard',
  'Shop performance heatmaps',
  'Credit usage & renewal warnings',
  'Drops/community announcements',
  'Order routing preferences',
  'Dynamic pricing alerts',
  'Fulfillment & logistics tracking',
  'Merchant compliance & document vault',
  'Promotions + coupon campaigns',
  'Customer support queue & dispute handling',
];

const EDUCATION_MANAGEMENT_FEATURES = [
  'Course lifecycle tracker',
  'Module progress analytics',
  'Learner engagement insights',
  'Assignments & resources vault',
  'Scheduling + reminders',
  'Cohort segmentation dashboards',
  'Certification & badge automation',
  'Discussion moderation queue',
  'Assessment builder + rubrics',
  'Live session capture & recording',
  'Learner support ticketing',
];

const countProducts = (shops: any[] | undefined) =>
  (shops ?? []).reduce((sum, shop) => {
    const products = Array.isArray(shop?.products) ? shop.products.length : 0;
    return sum + products;
  }, 0);

const BROADCAST_PROFILE_DEFINITIONS: {
  profileKey: BroadcastProfileKey;
  label: string;
  helper: string;
  icon: string;
  tab: BroadcastTabId;
  creationType: BroadcastCreationType;
  summary: (data: Record<string, any>) => string;
  emptySummary: string;
}[] = [
  {
    profileKey: 'broadcast_feed',
    label: 'Broadcast feed',
    helper: '10-day ephemeral queue for drops or events',
    icon: 'sparkles',
    tab: 'feeds',
    creationType: 'broadcast_feed',
    summary: (data) => {
      const feeds = Array.isArray(data?.feeds) ? data.feeds.length : 0;
      const expires = data?.expires_at
        ? new Date(data.expires_at).toLocaleDateString()
        : '10 days';
      return `${feeds} feeds · expires ${expires}`;
    },
    emptySummary: 'Create a 10-day broadcast feed to queue your posts.',
  },
  {
    profileKey: 'health',
    label: 'Health profile',
    helper: 'Clinics, hospitals & labs with care teams',
    icon: 'hospital',
    tab: 'health',
    creationType: 'health_profile',
    summary: (data) => {
      const institutions = Array.isArray(data?.institutions) ? data.institutions.length : 0;
      const employees = Number(data?.employees_total ?? 0);
      return `${institutions} institutions · ${employees} staff`;
    },
    emptySummary: 'Launch two institutions (max 5 free employees) before credits.',
  },
  {
    profileKey: 'market',
    label: 'Market profile',
    helper: 'Shops & product drops for your brand',
    icon: 'cart',
    tab: 'market',
    creationType: 'market_profile',
    summary: (data) => {
      const shops = Array.isArray(data?.shops) ? data.shops.length : 0;
      const products = countProducts(data?.shops);
      return `${shops} shops · ${products} products`;
    },
    emptySummary: 'Publish up to 5 shops (20 products each) before credits.',
  },
  {
    profileKey: 'education',
    label: 'Education profile',
    helper: 'Courses, trainings & learning broadcasts',
    icon: 'school',
    tab: 'education',
    creationType: 'education_profile',
    summary: (data) => {
      const courses = Array.isArray(data?.courses) ? data.courses.length : 0;
      return `${courses} courses`;
    },
    emptySummary: 'Create up to 10 courses before extra credits are needed.',
  },
];

export default function ProfileScreen() {
  const { palette } = useKISTheme();
  const { setAuth, setPhone } = useAuth();
  const c = useProfileController({ setAuth, setPhone });
  const tabsNavigation = useNavigation<BottomTabNavigationProp<MainTabsParamList, 'Profile'>>();
  const route = useRoute<RouteProp<MainTabsParamList, 'Profile'>>();
  const broadcastProfiles = c.broadcastProfiles;
  const requestedBroadcastProfileKey = route.params?.broadcastProfileKey ?? null;
  const [managementPanelKey, setManagementPanelKey] = useState<BroadcastProfileKey | null>(null);
  const [panelFeedItemTitle, setPanelFeedItemTitle] = useState('');
  const [panelFeedItemSummary, setPanelFeedItemSummary] = useState('');
  const [panelFeedMediaType, setPanelFeedMediaType] = useState<FeedMediaType>('video');
  const [panelFeedAssets, setPanelFeedAssets] = useState<Asset[]>([]);
  const [panelFeedExistingAttachments, setPanelFeedExistingAttachments] = useState<any[]>([]);
  const [panelFeedAdding, setPanelFeedAdding] = useState(false);
  const [panelAttachmentUploading, setPanelAttachmentUploading] = useState(false);
  const [editingFeedItemId, setEditingFeedItemId] = useState<string | null>(null);
  const [panelFeedDeletingId, setPanelFeedDeletingId] = useState<string | null>(null);
  const managementPanelOffset = useRef(new Animated.Value(profileLayout.SCREEN_WIDTH)).current;
  const [healthForm, setHealthForm] = useState<HealthFormState>({
    name: '',
    type: 'clinic',
    employees: '3',
  });
  const [healthFormMode, setHealthFormMode] = useState<'add' | 'edit'>('add');
  const [healthFormLoading, setHealthFormLoading] = useState(false);
  const [marketForm, setMarketForm] = useState<MarketFormState>({
    name: '',
    products: '3',
  });
  const [marketFormMode, setMarketFormMode] = useState<'add' | 'edit'>('add');
  const [marketFormLoading, setMarketFormLoading] = useState(false);
  const [educationForm, setEducationForm] = useState<EducationFormState>({
    title: '',
    summary: '',
  });
  const [educationFormMode, setEducationFormMode] = useState<'add' | 'edit'>('add');
  const [educationFormLoading, setEducationFormLoading] = useState(false);
  const [educationModuleForm, setEducationModuleForm] = useState({
    title: '',
    summary: '',
    resource_url: '',
  });
  const [educationModuleSubmitting, setEducationModuleSubmitting] = useState(false);
  const [educationLessonsData, setEducationLessonsData] = useState<any[]>([]);
  const [educationAnalyticsLoading, setEducationAnalyticsLoading] = useState(false);
  const [educationAnalyticsError, setEducationAnalyticsError] = useState<string | null>(null);

  const detectMediaTypeFromAsset = useCallback((asset?: Asset | null): FeedMediaType => {
    if (!asset?.type) return 'file';
    const mime = asset.type.toLowerCase();
    if (mime.startsWith('video/')) return 'video';
    if (mime.startsWith('audio/')) return 'audio';
    if (mime.startsWith('image/')) return 'image';
    return 'file';
  }, []);

  const handlePickFeedMedia = useCallback(async () => {
    const result = await launchImageLibrary({
      mediaType: 'mixed',
      selectionLimit: 5,
      quality: 0.9,
    });
    if (result.didCancel || !result.assets?.length) return;
    const assets = result.assets.filter((asset) => asset?.uri) as Asset[];
    if (!assets.length) return;
    setPanelFeedAssets((prev) => [...prev, ...assets]);
    setPanelFeedMediaType(detectMediaTypeFromAsset(assets[0]));
  }, [detectMediaTypeFromAsset]);

  const removeTemporaryFeedAsset = useCallback((index: number) => {
    setPanelFeedAssets((prev) => prev.filter((_, idx) => idx !== index));
  }, []);

  const handleAttachProfileFile = useCallback(async () => {
    if (!managementPanelKey) return;
    setPanelAttachmentUploading(true);
    try {
      const result = await launchImageLibrary({
        mediaType: 'mixed',
        selectionLimit: 1,
        quality: 0.85,
      });
      if (result.didCancel || !result.assets?.length) return;
      const asset = result.assets[0];
      if (!asset?.uri) return;
      const attachment = await c.uploadProfileAttachment(asset, managementPanelKey);
      if (!attachment) {
        throw new Error('Unable to upload attachment.');
      }
      const profileType = PROFILE_MANAGEMENT_TYPE[managementPanelKey];
      await c.manageProfileSection(profileType, { attachments: [attachment] });
      Alert.alert('Attachment uploaded', 'It has been added to the profile.');
    } catch (error: any) {
      Alert.alert('Attachment', error?.message || 'Unable to upload attachment.');
    } finally {
      setPanelAttachmentUploading(false);
    }
  }, [managementPanelKey, c]);

  const parseFormCount = useCallback((value: string, fallback: number) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(fallback, Math.floor(parsed));
  }, []);

  const buildHealthEmployees = useCallback((name: string, count: number) => {
    const safeCount = Math.max(1, count);
    return Array.from({ length: safeCount }).map((_, idx) => ({
      name: `${name} Worker ${idx + 1}`,
      role: idx === 0 ? 'Lead care worker' : 'Care worker',
    }));
  }, []);

  const buildShopProducts = useCallback((name: string, count: number) => {
    const safeCount = Math.max(1, count);
    const label = name.trim().replace(/\s+/g, ' ');
    return Array.from({ length: safeCount }).map((_, idx) => ({
      name: `${label} Product ${idx + 1}`,
      sku: `${label.substring(0, 3).toUpperCase() || 'PRD'}-${idx + 1}`,
    }));
  }, []);

  const accountTier = c.profile?.account?.tier;
  const walletBalance = c.profile?.account?.wallet_balance_cents ?? 0;
  const credits = c.profile?.account?.credits ?? 0;
  const creditsValue = c.profile?.account?.credits_value_cents ?? 0;
  const points = c.profile?.account?.points ?? 0;
  const currentTier = accountTier || c.profile?.tier || c.profile?.subscription?.tier;
  const tierLabel =
    currentTier?.name ??
    currentTier?.label ??
    currentTier?.tier_label ??
    currentTier?.tierName ??
    null;
  const partnerProfiles = c.profile?.partner_profiles || [];
  const partnerProfilesCount = c.profile?.partner_profiles_count ?? 0;
  const partnerProfilesLimitLabel = c.profile?.partner_profiles_limit_label;
  const partnerProfilesLimitValue = c.profile?.partner_profiles_limit_value ?? 0;
  const partnerProfilesIsUnlimited = !!c.profile?.partner_profiles_is_unlimited;
  const canCreatePartner = !!c.profile?.partner_profiles_can_create;
  const partnerLimitText = partnerProfilesIsUnlimited
    ? 'Unlimited'
    : partnerProfilesLimitLabel || String(partnerProfilesLimitValue);
  const showCreatePartnerButton = canCreatePartner;

  const sheetTitle = useMemo(() => {
    if (c.activeSheet === 'editProfile') return 'Edit Profile';
    if (c.activeSheet === 'privacy') return 'Privacy & Visibility';
    if (c.activeSheet === 'editItem') return 'Edit Item';
    if (c.activeSheet === 'upgrade') return 'Upgrade Account';
    return 'Wallet & Credits';
  }, [c.activeSheet]);

  const openWalletSheet = c.openSheet;
  const setWalletForm = c.setWalletForm;

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('wallet.open', (payload: any) => {
      openWalletSheet('wallet');
      setWalletForm((prev: any) => ({
        ...prev,
        mode: payload?.mode ?? prev.mode,
        amount: payload?.amount ? String(payload.amount) : prev.amount,
        credits: payload?.credits ? String(payload.credits) : prev.credits,
        points: payload?.points ? String(payload.points) : prev.points,
      }));
    });
    return () => sub.remove();
  }, [openWalletSheet, setWalletForm]);

  const openManagementPanel = useCallback((key: BroadcastProfileKey) => {
    setManagementPanelKey(key);
    Animated.timing(managementPanelOffset, {
      toValue: 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [managementPanelOffset]);

  const closeManagementPanel = useCallback(() => {
    Animated.timing(managementPanelOffset, {
      toValue: profileLayout.SCREEN_WIDTH,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      setManagementPanelKey(null);
    });
  }, [managementPanelOffset]);

  const resetFeedForm = useCallback(() => {
    setPanelFeedItemTitle('');
    setPanelFeedItemSummary('');
    setPanelFeedMediaType('video');
    setEditingFeedItemId(null);
    setPanelFeedAssets([]);
    setPanelFeedExistingAttachments([]);
  }, []);

  const handleSubmitFeedItem = useCallback(async () => {
    if (!managementPanelKey) return;
    const title = panelFeedItemTitle.trim();
    if (!title) {
      Alert.alert('Title required', 'Give the broadcast item a short title.');
      return;
    }

    setPanelFeedAdding(true);
    const attachmentsPayload = panelFeedAssets
      .filter((asset) => asset?.uri)
      .map((asset) => ({
        uri: asset.uri!,
        name: asset.fileName || `feed-${Date.now()}`,
        type: asset.type || 'application/octet-stream',
      }));

    try {
      if (editingFeedItemId) {
        await c.updateBroadcastFeedEntry(
          editingFeedItemId,
          title,
          panelFeedItemSummary.trim(),
          panelFeedMediaType,
          attachmentsPayload,
          panelFeedExistingAttachments,
        );
      } else {
        await c.addBroadcastFeedEntry(
          title,
          panelFeedItemSummary.trim(),
          panelFeedMediaType,
          attachmentsPayload,
        );
      }
      resetFeedForm();
    } catch (error: any) {
      Alert.alert('Broadcast item', error?.message || 'Unable to save this item.');
    } finally {
      setPanelFeedAdding(false);
    }
  }, [
    c,
    editingFeedItemId,
    managementPanelKey,
    panelFeedAssets,
    panelFeedExistingAttachments,
    panelFeedItemSummary,
    panelFeedItemTitle,
    panelFeedMediaType,
    resetFeedForm,
  ]);

  const handleEditFeedItem = useCallback((item: any) => {
    setEditingFeedItemId(item.id);
    setPanelFeedItemTitle(item.title || '');
    setPanelFeedItemSummary(item.summary || '');
    if (item.media_type) {
      setPanelFeedMediaType(item.media_type as FeedMediaType);
    }
    const attachments =
      (Array.isArray(item.attachments) ? item.attachments : []).filter(Boolean);
    const baseAttachments =
      attachments.length > 0
        ? attachments
        : item.attachment
        ? [item.attachment]
        : [];
    setPanelFeedExistingAttachments(baseAttachments);
    setPanelFeedAssets([]);
  }, []);

  const handleCancelFeedEdit = useCallback(() => {
    resetFeedForm();
  }, [resetFeedForm]);

  const handleDeleteFeedItem = useCallback(
    async (id: string) => {
      setPanelFeedDeletingId(id);
      try {
        await c.deleteBroadcastFeedEntry(id);
        if (editingFeedItemId === id) {
          resetFeedForm();
        }
      } catch (error: any) {
        Alert.alert('Delete item', error?.message || 'Unable to delete the item.');
      } finally {
        setPanelFeedDeletingId(null);
      }
    },
    [c, editingFeedItemId, resetFeedForm],
  );

  const handleBroadcastCTA = (def: (typeof BROADCAST_PROFILE_DEFINITIONS)[number]) => {
    openManagementPanel(def.profileKey);
  };

  const rootNavigation =
    tabsNavigation.getParent<NativeStackNavigationProp<RootStackParamList>>();

  useEffect(() => {
    const requestedKey = requestedBroadcastProfileKey;
    if (!requestedKey) return;
    if (requestedKey !== managementPanelKey) {
      openManagementPanel(requestedKey);
    }
    tabsNavigation.setParams({ broadcastProfileKey: undefined });
  }, [tabsNavigation, managementPanelKey, openManagementPanel, requestedBroadcastProfileKey]);

  const openProfileInsights = useCallback(() => {
    rootNavigation?.navigate('ProfileInsights');
  }, [rootNavigation]);

  const openAdminTools = useCallback(() => {
    rootNavigation?.navigate('AdminTools');
  }, [rootNavigation]);

  const managementPanelData = managementPanelKey ? broadcastProfiles?.[managementPanelKey] : null;
  const managementPanelDefinition =
    managementPanelKey &&
    BROADCAST_PROFILE_DEFINITIONS.find((def) => def.profileKey === managementPanelKey);

  const cycleHealthFormType = useCallback(() => {
    setHealthForm((prev) => {
      const index = HEALTH_INSTITUTION_TYPES.findIndex((type) => type === prev.type);
      const nextType = HEALTH_INSTITUTION_TYPES[(index + 1) % HEALTH_INSTITUTION_TYPES.length];
      return { ...prev, type: nextType };
    });
  }, []);

  const resetHealthForm = useCallback(() => {
    setHealthForm({
      name: '',
      type: 'clinic',
      employees: '3',
    });
    setHealthFormMode('add');
  }, []);

  const resetMarketForm = useCallback(() => {
    setMarketForm({
      name: '',
      products: '3',
    });
    setMarketFormMode('add');
  }, []);

  const resetEducationForm = useCallback(() => {
    setEducationForm({
      title: '',
      summary: '',
    });
    setEducationFormMode('add');
  }, []);

  const resetEducationModuleForm = useCallback(() => {
    setEducationModuleForm({
      title: '',
      summary: '',
      resource_url: '',
    });
  }, []);

  const openModuleResource = useCallback(async (url?: string | null) => {
    if (!url) {
      Alert.alert('Module', 'No resource link provided.');
      return;
    }
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      Alert.alert('Module', 'Unable to open the resource URL.');
      return;
    }
    Linking.openURL(url);
  }, []);

  const beginHealthEdit = useCallback((inst: any) => {
    setHealthForm({
      id: inst.id,
      name: inst.name,
      type: (inst.type as HealthInstitutionType) ?? 'clinic',
      employees: String(Math.max(1, inst.employees?.length ?? 1)),
    });
    setHealthFormMode('edit');
  }, []);

  const beginMarketEdit = useCallback((shop: any) => {
    setMarketForm({
      id: shop.id,
      name: shop.name,
      products: String(Math.max(1, Array.isArray(shop.products) ? shop.products.length : 1)),
    });
    setMarketFormMode('edit');
  }, []);

  const beginEducationEdit = useCallback((course: any) => {
    setEducationForm({
      id: course.id,
      title: course.title,
      summary: course.summary || '',
    });
    setEducationFormMode('edit');
  }, []);

  const unwrapList = useCallback((payload: any) => {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.results)) return payload.results;
    return [];
  }, []);

  const formatLessonTime = useCallback((value?: string | null) => {
    if (!value) return 'Starts soon';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'TBD';
    return date.toLocaleString();
  }, []);

  const loadEducationAnalytics = useCallback(async () => {
    setEducationAnalyticsLoading(true);
    try {
      const lessonRes = await getRequest(ROUTES.broadcasts.lessons, {
        errorMessage: 'Unable to load lessons.',
      });
      if (lessonRes.success) {
        const lessons = unwrapList(lessonRes.data);
        setEducationLessonsData(lessons);
        setEducationAnalyticsError(null);
      } else {
        setEducationAnalyticsError(lessonRes.message);
      }
    } catch (error: any) {
      setEducationAnalyticsError(error?.message || 'Unable to load lesson insights.');
    } finally {
      setEducationAnalyticsLoading(false);
    }
  }, [unwrapList]);

  useEffect(() => {
    if (managementPanelKey === 'education') {
      void loadEducationAnalytics();
    }
  }, [managementPanelKey, loadEducationAnalytics]);

  const upcomingLessons = useMemo(() => {
    const now = Date.now();
    return educationLessonsData
      .filter((lesson) => {
        if (!lesson?.starts_at) return false;
        const startsAt = new Date(lesson.starts_at).getTime();
        return !Number.isNaN(startsAt) && startsAt >= now;
      })
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  }, [educationLessonsData]);

  const totalEnrollments = useMemo(
    () =>
      educationLessonsData.reduce<number>((sum, lesson) => {
        const count = Number(lesson?.enrollment_count ?? 0);
        return sum + (Number.isFinite(count) ? count : 0);
      }, 0),
    [educationLessonsData],
  );

  const nextLesson = upcomingLessons[0] ?? null;

  const handlePlanLesson = useCallback(() => {
    Alert.alert('Lesson', 'Lesson scheduling tools coming soon (Phase 2).');
  }, []);

  const handleRecordSession = useCallback(() => {
    Alert.alert('Recording', 'Live session capture will appear here once enabled.');
  }, []);

  const handleEducationModuleSave = useCallback(async () => {
    const title = educationModuleForm.title.trim();
    if (!title) {
      Alert.alert('Module', 'Please provide a title for the module.');
      return;
    }
    setEducationModuleSubmitting(true);
    try {
      await c.manageProfileSection('education_profile', {
        modules: [
          {
            title,
            summary: educationModuleForm.summary.trim(),
            resource_url: educationModuleForm.resource_url.trim(),
          },
        ],
      });
      Alert.alert('Module', 'Module joined your education profile.');
      resetEducationModuleForm();
    } catch (error: any) {
      Alert.alert('Module', error?.message || 'Unable to add module.');
    } finally {
      setEducationModuleSubmitting(false);
    }
  }, [educationModuleForm, c, resetEducationModuleForm]);

  const handleHealthFormSave = useCallback(async () => {
    const name = healthForm.name.trim();
    if (!name) {
      Alert.alert('Health profile', 'Provide a name for the institution.');
      return;
    }
    const count = parseFormCount(healthForm.employees, 1);
    const employees = buildHealthEmployees(name, count);
    const institutions = managementPanelData?.institutions ?? [];
    const nextInstitutions =
      healthFormMode === 'edit' && healthForm.id
        ? institutions.map((inst) =>
            inst.id === healthForm.id ? { ...inst, name, type: healthForm.type, employees } : inst,
          )
        : [...institutions, { name, type: healthForm.type, employees }];

    setHealthFormLoading(true);
    try {
      await c.manageProfileSection('health_profile', { institutions: nextInstitutions });
      resetHealthForm();
    } catch (error: any) {
      Alert.alert('Health profile', error?.message || 'Unable to update institutions.');
    } finally {
      setHealthFormLoading(false);
    }
  }, [
    buildHealthEmployees,
    c,
    healthForm,
    healthFormMode,
    managementPanelData,
    parseFormCount,
    resetHealthForm,
  ]);

  const handleHealthFormDelete = useCallback(async () => {
    if (!healthForm.id) return;
    const institutions = managementPanelData?.institutions ?? [];
    const nextInstitutions = institutions.filter((inst) => inst.id !== healthForm.id);
    setHealthFormLoading(true);
    try {
      await c.manageProfileSection('health_profile', { institutions: nextInstitutions });
      resetHealthForm();
    } catch (error: any) {
      Alert.alert('Health profile', error?.message || 'Unable to delete institution.');
    } finally {
      setHealthFormLoading(false);
    }
  }, [c, healthForm.id, managementPanelData, resetHealthForm]);

  const handleMarketFormSave = useCallback(async () => {
    const name = marketForm.name.trim();
    if (!name) {
      Alert.alert('Market profile', 'Provide a shop name.');
      return;
    }
    const count = parseFormCount(marketForm.products, 1);
    const products = buildShopProducts(name, count);
    const shops = managementPanelData?.shops ?? [];
    const nextShops =
      marketFormMode === 'edit' && marketForm.id
        ? shops.map((shop) => (shop.id === marketForm.id ? { ...shop, name, products } : shop))
        : [...shops, { name, products }];

    setMarketFormLoading(true);
    try {
      await c.manageProfileSection('market_profile', { shops: nextShops });
      resetMarketForm();
    } catch (error: any) {
      Alert.alert('Market profile', error?.message || 'Unable to update shops.');
    } finally {
      setMarketFormLoading(false);
    }
  }, [
    buildShopProducts,
    c,
    managementPanelData,
    marketForm,
    marketFormMode,
    parseFormCount,
    resetMarketForm,
  ]);

  const handleMarketFormDelete = useCallback(async () => {
    if (!marketForm.id) return;
    const shops = managementPanelData?.shops ?? [];
    const nextShops = shops.filter((shop) => shop.id !== marketForm.id);
    setMarketFormLoading(true);
    try {
      await c.manageProfileSection('market_profile', { shops: nextShops });
      resetMarketForm();
    } catch (error: any) {
      Alert.alert('Market profile', error?.message || 'Unable to delete shop.');
    } finally {
      setMarketFormLoading(false);
    }
  }, [c, managementPanelData, marketForm.id, resetMarketForm]);

  const handleEducationFormSave = useCallback(async () => {
    const title = educationForm.title.trim();
    if (!title) {
      Alert.alert('Education profile', 'Provide a course title.');
      return;
    }
    const courses = managementPanelData?.courses ?? [];
    const nextCourses =
      educationFormMode === 'edit' && educationForm.id
        ? courses.map((course) =>
            course.id === educationForm.id ? { ...course, title, summary: educationForm.summary.trim() } : course,
          )
        : [...courses, { title, summary: educationForm.summary.trim() }];

    setEducationFormLoading(true);
    try {
      await c.manageProfileSection('education_profile', { courses: nextCourses });
      resetEducationForm();
    } catch (error: any) {
      Alert.alert('Education profile', error?.message || 'Unable to update courses.');
    } finally {
      setEducationFormLoading(false);
    }
  }, [
    c,
    educationForm,
    educationFormMode,
    managementPanelData,
    resetEducationForm,
  ]);

  const handleEducationFormDelete = useCallback(async () => {
    if (!educationForm.id) return;
    const courses = managementPanelData?.courses ?? [];
    const nextCourses = courses.filter((course) => course.id !== educationForm.id);
    setEducationFormLoading(true);
    try {
      await c.manageProfileSection('education_profile', { courses: nextCourses });
      resetEducationForm();
    } catch (error: any) {
      Alert.alert('Education profile', error?.message || 'Unable to delete course.');
    } finally {
      setEducationFormLoading(false);
    }
  }, [c, educationForm.id, managementPanelData, resetEducationForm]);

  const renderManagementPanelContent = () => {
    if (!managementPanelKey) return null;
    const isEmpty = !managementPanelData;

    const panelTitle = managementPanelDefinition?.label ?? 'Profile manager';
    const panelHint = isEmpty
      ? 'Use the create modal to start this profile, then return here to manage it.'
      : managementPanelDefinition?.helper;

    const baseHeader = (
      <View>
        <Text style={[styles.managementPanelTitle, { color: palette.text }]}>{panelTitle}</Text>
        <Text style={[styles.managementPanelSubtitle, { color: palette.subtext }]}>
          {panelHint}
        </Text>
      </View>
    );

    const attachments = Array.isArray(managementPanelData?.attachments)
      ? managementPanelData.attachments
      : [];
    const renderAttachmentsSection = () => (
      <View
        style={[
          styles.managementAttachments,
          { borderColor: palette.divider, backgroundColor: palette.card },
        ]}
      >
        <View style={styles.managementAssetRow}>
          <Text style={{ color: palette.text, fontWeight: '900' }}>Attachments</Text>
          <KISButton
            title={panelAttachmentUploading ? 'Uploading…' : 'Add attachment'}
            size="sm"
            variant="secondary"
            onPress={handleAttachProfileFile}
            disabled={panelAttachmentUploading}
          />
        </View>
        {attachments.length === 0 ? (
          <Text style={{ color: palette.subtext }}>No attachments yet.</Text>
        ) : (
          attachments.map((att, index) => {
            const preview = getAttachmentPreviewInfo(att);
            const key = `${preview.label}-${index}`;
            return (
              <View
                key={key}
                style={[
                  styles.managementAssetItem,
                  { borderColor: palette.divider, backgroundColor: palette.surface },
                ]}
              >
                {preview.previewUri ? (
                  <Image
                    source={{ uri: preview.previewUri }}
                    style={styles.managementAssetImage}
                  />
                ) : (
                  <View
                    style={[
                      styles.managementAssetPlaceholder,
                      { borderColor: palette.divider, backgroundColor: palette.surface },
                    ]}
                  >
                    <Text style={{ color: palette.subtext, fontSize: 12 }}>{preview.typeLabel}</Text>
                  </View>
                )}
                <Text style={{ color: palette.text, fontWeight: '700' }}>{preview.label}</Text>
                <Text style={{ color: palette.subtext, fontSize: 12 }}>{preview.typeLabel}</Text>
              </View>
            );
          })
        )}
      </View>
    );

    if (managementPanelKey === 'broadcast_feed') {
      const feeds: any[] = Array.isArray(managementPanelData?.feeds) ? managementPanelData.feeds : [];
      const expiresAt = managementPanelData?.expires_at
        ? new Date(managementPanelData.expires_at).toLocaleString()
        : 'N/A';
      return (
        <ScrollView contentContainerStyle={styles.managementPanelBody}>
          {baseHeader}
          <View style={styles.managementStatsRow}>
            <View style={styles.managementStat}>
              <Text style={[styles.managementStatValue, { color: palette.text }]}>{feeds.length}</Text>
              <Text style={[styles.managementStatLabel, { color: palette.subtext }]}>Queued items</Text>
            </View>
            <View style={styles.managementStat}>
              <Text style={[styles.managementStatValue, { color: palette.text }]}>{expiresAt}</Text>
              <Text style={[styles.managementStatLabel, { color: palette.subtext }]}>Expires</Text>
            </View>
          </View>
          <View style={{ gap: 8 }}>
            {feeds.length === 0 ? (
              <Text style={{ color: palette.subtext }}>No items yet. Add one below.</Text>
            ) : (
              feeds.map((feed) => (
                <View
                  key={feed.id}
                  style={[styles.managementItemCard, { borderColor: palette.divider, backgroundColor: palette.surface }]}
                >
                  <Text style={[styles.managementItemTitle, { color: palette.text }]}>{feed.title}</Text>
                  <Text style={[styles.managementItemMeta, { color: palette.subtext }]}>
                    {(feed.summary && feed.summary.length > 80 ? `${feed.summary.slice(0, 80)}…` : feed.summary) ||
                      'No summary'}
                  </Text>
                  {(() => {
                    const attachments = [
                      feed.attachment,
                      ...(Array.isArray(feed.attachments) ? feed.attachments : []),
                    ].filter(Boolean);
                    if (attachments.length === 0) return null;
                    const labels = attachments
                      .slice(0, 3)
                      .map((att: any) => att?.name ?? att?.url ?? 'Attachment');
                    return (
                      <Text style={[styles.managementItemMeta, { color: palette.subtext }]}>
                        Attachments: {labels.join(', ')}
                        {attachments.length > 3 ? ` +${attachments.length - 3} more` : ''}
                      </Text>
                    );
                  })()}
                  <Text style={[styles.managementItemMeta, { color: palette.subtext }]}>
                    {feed.media_type ? feed.media_type.toUpperCase() : 'Text'} · {feed.created_at
                      ? new Date(feed.created_at).toLocaleDateString()
                      : 'Just now'}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <KISButton
                      title="Edit"
                      size="xs"
                      variant="outline"
                      onPress={() => handleEditFeedItem(feed)}
                    />
                    <KISButton
                      title={panelFeedDeletingId === feed.id ? 'Deleting…' : 'Delete'}
                      size="xs"
                      variant="secondary"
                      onPress={() => handleDeleteFeedItem(feed.id)}
                      disabled={panelFeedDeletingId === feed.id}
                    />
                  </View>
                </View>
              ))
            )}
          </View>
          <View
            style={[
              styles.managementForm,
              { borderColor: palette.divider, backgroundColor: palette.card },
            ]}
          >
            <Text style={[styles.managementFormLabel, { color: palette.text }]}>New broadcast item</Text>
            <View style={styles.managementAssetRow}>
              <Text style={{ color: palette.text, fontWeight: '900' }}>Attachments</Text>
              <KISButton
                title={`Attach media${panelFeedAssets.length ? ` (${panelFeedAssets.length})` : ''}`}
                variant="outline"
                onPress={handlePickFeedMedia}
                size="sm"
              />
            </View>
            {panelFeedExistingAttachments.length > 0 && (
              <View style={{ gap: 6 }}>
                <Text style={{ color: palette.subtext, fontSize: 12 }}>Existing attachments</Text>
                {panelFeedExistingAttachments.map((att, index) => (
                  <View
                    key={`${att?.url ?? att?.name ?? 'attachment'}-${index}`}
                    style={[
                      styles.managementAssetItem,
                      { borderColor: palette.divider, backgroundColor: palette.surface },
                    ]}
                  >
                    <Text style={{ color: palette.text, fontWeight: '700' }}>
                      {att?.name ?? att?.url ?? `Attachment ${index + 1}`}
                    </Text>
                    <Text style={{ color: palette.subtext, fontSize: 12 }}>
                      {(att?.media_type ?? att?.mime_type ?? 'file').toUpperCase()}
                    </Text>
                    <Pressable onPress={() => setPanelFeedExistingAttachments((prev) => prev.filter((_, idx) => idx !== index))}>
                      <Text style={{ color: palette.danger, fontSize: 12 }}>Remove</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
            {panelFeedAssets.length > 0 && (
              <View style={{ gap: 6 }}>
                <Text style={{ color: palette.subtext, fontSize: 12 }}>New attachments</Text>
                {panelFeedAssets.map((asset, index) => (
                  <View
                    key={`${asset.uri}-${index}`}
                    style={[
                      styles.managementAssetItem,
                      { borderColor: palette.divider, backgroundColor: palette.surface, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
                    ]}
                  >
                    <View>
                      <Text style={{ color: palette.text, fontWeight: '700' }}>
                        {asset.fileName || `Attachment ${index + 1}`}
                      </Text>
                      <Text style={{ color: palette.subtext, fontSize: 12 }}>{asset.type ?? 'file'}</Text>
                    </View>
                    <Pressable onPress={() => removeTemporaryFeedAsset(index)}>
                      <Text style={{ color: palette.danger, fontSize: 12 }}>Remove</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ gap: 8 }}>
              {FEED_MEDIA_TYPES.map((type) => {
                const selected = panelFeedMediaType === type;
                return (
                  <Pressable
                    key={type}
                    onPress={() => setPanelFeedMediaType(type)}
                    style={[
                      styles.managementTypePill,
                      {
                        backgroundColor: selected ? palette.primarySoft : palette.surface,
                        borderColor: selected ? palette.primary : palette.divider,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: selected ? palette.primaryStrong : palette.subtext,
                        fontWeight: '900',
                      }}
                    >
                      {type}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <KISTextInput
              label="Title"
              value={panelFeedItemTitle}
              onChangeText={setPanelFeedItemTitle}
            />
            <KISTextInput
              label="Summary / notes"
              value={panelFeedItemSummary}
              onChangeText={setPanelFeedItemSummary}
              multiline
              style={{ minHeight: 80 }}
            />
            <KISButton
              title={
                panelFeedAdding
                  ? 'Saving…'
                  : editingFeedItemId
                  ? 'Update broadcast item'
                  : 'Add broadcast item'
              }
              onPress={handleSubmitFeedItem}
              disabled={panelFeedAdding}
            />
            {editingFeedItemId && (
              <KISButton
                title="Cancel edit"
                variant="secondary"
                onPress={handleCancelFeedEdit}
                disabled={panelFeedAdding}
              />
            )}
            {editingFeedItemId ? (
              <Text style={[styles.managementFormHint, { color: palette.primaryStrong }]}>
                Editing an existing broadcast item.
              </Text>
            ) : null}
            <Text style={[styles.managementFormHint, { color: palette.subtext }]}>
              Items can be videos, audio, images, files, or text and will appear under the Broadcasts tab.
            </Text>
          </View>
        </ScrollView>
      );
    }

    if (managementPanelKey === 'health') {
      const institutions: any[] = Array.isArray(managementPanelData?.institutions)
        ? managementPanelData.institutions
        : [];
      const employees = managementPanelData?.employees_total ?? 0;
      return (
        <ScrollView contentContainerStyle={styles.managementPanelBody}>
          {baseHeader}
          <View style={styles.managementStatsRow}>
            <View style={styles.managementStat}>
              <Text style={[styles.managementStatValue, { color: palette.text }]}>{institutions.length}</Text>
              <Text style={[styles.managementStatLabel, { color: palette.subtext }]}>Institutions</Text>
            </View>
            <View style={styles.managementStat}>
              <Text style={[styles.managementStatValue, { color: palette.text }]}>{employees}</Text>
              <Text style={[styles.managementStatLabel, { color: palette.subtext }]}>Active staff</Text>
            </View>
          </View>
          <View
            style={{
              borderWidth: 2,
              borderColor: palette.divider,
              backgroundColor: palette.surface,
              borderRadius: 22,
              padding: 12,
              gap: 10,
            }}
          >
            <View
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <Text style={[styles.managementFormLabel, { color: palette.text }]}>Learner insights</Text>
              <KISButton
                title="Refresh"
                size="xs"
                variant="outline"
                onPress={() => void loadEducationAnalytics()}
                disabled={educationAnalyticsLoading}
              />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <View>
                <Text style={{ color: palette.text, fontWeight: '900' }}>{upcomingLessons.length}</Text>
                <Text style={{ color: palette.subtext, fontSize: 12 }}>upcoming lessons</Text>
              </View>
              <View>
                <Text style={{ color: palette.text, fontWeight: '900' }}>{totalEnrollments}</Text>
                <Text style={{ color: palette.subtext, fontSize: 12 }}>total enrollments</Text>
              </View>
            </View>
            {educationAnalyticsLoading ? (
              <Text style={{ color: palette.subtext }}>Loading lesson data…</Text>
            ) : educationAnalyticsError ? (
              <Text style={{ color: dangerColor }}>{educationAnalyticsError}</Text>
            ) : nextLesson ? (
              <View>
                <Text style={{ color: palette.primaryStrong, fontWeight: '900' }}>
                  Next lesson: {nextLesson.title}
                </Text>
                <Text style={{ color: palette.subtext, fontSize: 12 }}>
                  {formatLessonTime(nextLesson.starts_at)} · {nextLesson.enrollment_count ?? 0} enrollments
                </Text>
              </View>
            ) : (
              <Text style={{ color: palette.subtext }}>No upcoming lessons yet.</Text>
            )}
            {upcomingLessons.slice(0, 2).map((lesson: any, idx: number) => (
              <View
                key={`overview-lesson-${lesson.id ?? idx}`}
                style={{
                  borderWidth: 1,
                  borderColor: palette.divider,
                  borderRadius: 16,
                  padding: 10,
                  backgroundColor: palette.card,
                }}
              >
                <Text style={{ color: palette.text, fontWeight: '700' }}>{lesson.title ?? 'Lesson'}</Text>
                <Text style={{ color: palette.subtext, fontSize: 12 }}>
                  Starts {formatLessonTime(lesson.starts_at)} · {lesson.enrollment_count ?? 0} enrolled
                </Text>
              </View>
            ))}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <KISButton title="Plan lesson" onPress={handlePlanLesson} size="xs" />
              <KISButton
                title="Log recording"
                variant="outline"
                size="xs"
                onPress={handleRecordSession}
              />
            </View>
          </View>
          <View style={{ gap: 10 }}>
            {institutions.map((inst, index) => (
              <View
                key={`${inst.name}-${index}`}
                style={[styles.managementItemCard, { borderColor: palette.divider, backgroundColor: palette.surface }]}
              >
                <Text style={[styles.managementItemTitle, { color: palette.text }]}>
                  {inst.name} · {inst.type.replace('_', ' ')}
                </Text>
                <Text style={[styles.managementItemMeta, { color: palette.subtext }]}>
                  {inst.employees?.length ? `${inst.employees.length} members` : 'Staff not configured'}
                </Text>
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  <Pressable onPress={() => Alert.alert('Care workflow', 'Opening care workflow editor…')}>
                    <Text style={{ color: palette.primaryStrong }}>Open workflow</Text>
                  </Pressable>
                  <Pressable onPress={() => Alert.alert('Appointment scheduling', 'Automated scheduling is ready.')}>
                    <Text style={{ color: palette.primaryStrong }}>Launch scheduler</Text>
                  </Pressable>
                </View>
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
                  <KISButton
                    size="xs"
                    variant="outline"
                    title="Edit"
                    onPress={() => beginHealthEdit(inst)}
                  />
                </View>
              </View>
            ))}
          <View style={[styles.managementFeatureList, { borderColor: palette.divider }]}>
            {HEALTH_MANAGEMENT_FEATURES.map((feature) => (
              <Text key={feature} style={[styles.managementFeatureItem, { color: palette.text }]}>
                • {feature}
              </Text>
            ))}
          </View>
        </View>
          <View
            style={[
              styles.managementForm,
              { borderColor: palette.divider, backgroundColor: palette.card },
            ]}
          >
            <Text style={[styles.managementFormLabel, { color: palette.text }]}>
              {healthFormMode === 'edit' ? 'Update institution' : 'Add institution'}
            </Text>
            <KISTextInput
              label="Name"
              value={healthForm.name}
              onChangeText={(value) => setHealthForm((prev) => ({ ...prev, name: value }))}
            />
            <Pressable
              onPress={cycleHealthFormType}
              style={{
                borderWidth: 2,
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderColor: palette.divider,
                marginVertical: 6,
              }}
            >
              <Text style={{ color: palette.primaryStrong, fontWeight: '900' }}>
                Type: {healthForm.type.replace('_', ' ')}
              </Text>
            </Pressable>
            <KISTextInput
              label="Employees"
              value={healthForm.employees}
              onChangeText={(value) => setHealthForm((prev) => ({ ...prev, employees: value }))}
              keyboardType="numeric"
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <KISButton
                title={healthFormMode === 'edit' ? 'Update institution' : 'Add institution'}
                onPress={handleHealthFormSave}
                disabled={healthFormLoading}
              />
              {healthFormMode === 'edit' && (
                <KISButton
                  title="Delete institution"
                  variant="outline"
                  onPress={handleHealthFormDelete}
                  disabled={healthFormLoading}
                />
              )}
            </View>
            <KISButton
              title="Reset form"
              variant="secondary"
              onPress={resetHealthForm}
              disabled={healthFormLoading}
            />
          </View>
        {renderAttachmentsSection()}
        <View style={styles.managementActionRow}>
          <KISButton
            title="Notify care team"
            variant="secondary"
              onPress={() => Alert.alert('Health', 'Care team notified.')}
            />
            <KISButton
              title="Run compliance review"
              variant="outline"
              onPress={() => Alert.alert('Compliance', 'Audit complete.')}
            />
          </View>
        </ScrollView>
      );
    }

    if (managementPanelKey === 'market') {
      const shops: any[] = Array.isArray(managementPanelData?.shops) ? managementPanelData.shops : [];
      const shopCount = shops.length;
      const productCount = countProducts(shops);
      const extraShops = Math.max(0, shopCount - 5);
      const extraProducts = shops.reduce((sum, shop) => {
        const qty = Array.isArray(shop?.products) ? shop.products.length : 0;
        return sum + Math.max(0, qty - 20);
      }, 0);
      const creditUsage = extraShops * 5 + extraProducts * 2;
      return (
        <ScrollView contentContainerStyle={styles.managementPanelBody}>
          {baseHeader}
          <View style={styles.managementStatsRow}>
            <View style={styles.managementStat}>
              <Text style={[styles.managementStatValue, { color: palette.text }]}>{shopCount}</Text>
              <Text style={[styles.managementStatLabel, { color: palette.subtext }]}>Shops</Text>
            </View>
            <View style={styles.managementStat}>
              <Text style={[styles.managementStatValue, { color: palette.text }]}>{productCount}</Text>
              <Text style={[styles.managementStatLabel, { color: palette.subtext }]}>Products</Text>
            </View>
            <View style={styles.managementStat}>
              <Text style={[styles.managementStatValue, { color: palette.text }]}>{creditUsage} credits</Text>
              <Text style={[styles.managementStatLabel, { color: palette.subtext }]}>Extra capacity</Text>
            </View>
          </View>
          <View style={{ gap: 10 }}>
            {shops.map((shop, index) => (
              <View
                key={`${shop.name}-${index}`}
                style={[styles.managementItemCard, { borderColor: palette.divider, backgroundColor: palette.surface }]}
              >
                <Text style={[styles.managementItemTitle, { color: palette.text }]}>{shop.name}</Text>
                <Text style={[styles.managementItemMeta, { color: palette.subtext }]}>
                  {Array.isArray(shop?.products)
                    ? `${shop.products.length} products`
                    : 'Product slots not defined'}
                </Text>
                <Text style={[styles.managementItemMeta, { color: palette.subtext }]}>
                  {`${extraProducts} extras used`}
                </Text>
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
                  <KISButton
                    size="xs"
                    variant="outline"
                    title="Edit"
                    onPress={() => beginMarketEdit(shop)}
                  />
                </View>
              </View>
            ))}
            <View style={[styles.managementFeatureList, { borderColor: palette.divider }]}>
              {MARKET_MANAGEMENT_FEATURES.map((feature) => (
                <Text key={feature} style={[styles.managementFeatureItem, { color: palette.text }]}>
                  • {feature}
                </Text>
              ))}
            </View>
          </View>
          <View
            style={[
              styles.managementForm,
              { borderColor: palette.divider, backgroundColor: palette.card },
            ]}
          >
            <Text style={[styles.managementFormLabel, { color: palette.text }]}>
              {marketFormMode === 'edit' ? 'Update shop' : 'Add shop'}
            </Text>
            <KISTextInput
              label="Shop name"
              value={marketForm.name}
              onChangeText={(value) => setMarketForm((prev) => ({ ...prev, name: value }))}
            />
            <KISTextInput
              label="Product slots"
              value={marketForm.products}
              onChangeText={(value) => setMarketForm((prev) => ({ ...prev, products: value }))}
              keyboardType="numeric"
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <KISButton
                title={marketFormMode === 'edit' ? 'Update shop' : 'Add shop'}
                onPress={handleMarketFormSave}
                disabled={marketFormLoading}
              />
              {marketFormMode === 'edit' && (
                <KISButton
                  title="Delete shop"
                  variant="outline"
                  onPress={handleMarketFormDelete}
                  disabled={marketFormLoading}
                />
              )}
            </View>
            <KISButton
              title="Reset form"
              variant="secondary"
              onPress={resetMarketForm}
              disabled={marketFormLoading}
            />
          </View>
          {renderAttachmentsSection()}
          <View style={styles.managementActionRow}>
            <KISButton title="Publish drop" onPress={() => Alert.alert('Market', 'Drop scheduled.')} />
            <KISButton
              title="Review credits"
              variant="outline"
              onPress={() => Alert.alert('Credits', 'Credit dashboard updated.')}
            />
          </View>
        </ScrollView>
      );
    }

    if (managementPanelKey === 'education') {
      const courses: any[] = Array.isArray(managementPanelData?.courses) ? managementPanelData.courses : [];
      const modules: any[] = Array.isArray(managementPanelData?.modules) ? managementPanelData.modules : [];
      const extraCourses = Math.max(0, courses.length - 10);
      const creditUsage = extraCourses * 2;
      return (
        <ScrollView contentContainerStyle={styles.managementPanelBody}>
          {baseHeader}
          <EducationCreatorConsole managementData={managementPanelData} tierLabel={tierLabel} />
          <View style={styles.managementStatsRow}>
            <View style={styles.managementStat}>
              <Text style={[styles.managementStatValue, { color: palette.text }]}>{courses.length}</Text>
              <Text style={[styles.managementStatLabel, { color: palette.subtext }]}>Courses</Text>
            </View>
            <View style={styles.managementStat}>
              <Text style={[styles.managementStatValue, { color: palette.text }]}>{creditUsage} credits</Text>
              <Text style={[styles.managementStatLabel, { color: palette.subtext }]}>Extra slots</Text>
            </View>
          </View>
          <View style={{ gap: 10 }}>
            {courses.map((course, index) => (
              <View
                key={`${course.title}-${index}`}
                style={[styles.managementItemCard, { borderColor: palette.divider, backgroundColor: palette.surface }]}
              >
                <Text style={[styles.managementItemTitle, { color: palette.text }]}>{course.title}</Text>
                <Text style={[styles.managementItemMeta, { color: palette.subtext }]}>
                  {course.summary || 'No summary provided'}
                </Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable onPress={() => Alert.alert('Course', 'Course analytics opening…')}>
                    <Text style={{ color: palette.primaryStrong }}>View analytics</Text>
                  </Pressable>
                  <Pressable onPress={() => Alert.alert('Learning', 'Learner roster updated.')}>
                    <Text style={{ color: palette.primaryStrong }}>Manage learners</Text>
                  </Pressable>
                </View>
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
                  <KISButton
                    size="xs"
                    variant="outline"
                    title="Edit"
                    onPress={() => beginEducationEdit(course)}
                  />
                </View>
              </View>
            ))}
            <View style={[styles.managementFeatureList, { borderColor: palette.divider }]}>
              {EDUCATION_MANAGEMENT_FEATURES.map((feature) => (
                <Text key={feature} style={[styles.managementFeatureItem, { color: palette.text }]}>
                  • {feature}
                </Text>
              ))}
            </View>
            <View
              style={{
                borderWidth: 2,
                borderColor: palette.divider,
                borderRadius: 22,
                padding: 12,
                backgroundColor: palette.surface,
                gap: 10,
              }}
            >
              <Text style={{ color: palette.text, fontWeight: '900', fontSize: 16 }}>Modules & workshops</Text>
              {modules.length === 0 ? (
                <Text style={{ color: palette.subtext }}>
                  Add modules to keep learners on track and share resources with your broadcast.
                </Text>
              ) : (
                modules.map((module, index) => (
                  <View
                    key={`module-${module.id ?? index}`}
                    style={{
                      borderWidth: 2,
                      borderColor: palette.divider,
                      borderRadius: 16,
                      padding: 10,
                      backgroundColor: palette.card,
                      gap: 6,
                    }}
                  >
                    <Text style={{ color: palette.text, fontWeight: '900' }}>{module.title || 'Module'}</Text>
                    {module.summary ? (
                      <Text style={{ color: palette.subtext, fontSize: 12 }} numberOfLines={2}>
                        {module.summary}
                      </Text>
                    ) : null}
                    {module.resource_url ? (
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <KISButton
                          title="Open resource"
                          variant="outline"
                          size="xs"
                          onPress={() => openModuleResource(module.resource_url)}
                        />
                        <Text style={{ color: palette.subtext, fontSize: 12 }}>
                          {module.resource_url}
                        </Text>
                      </View>
                    ) : (
                      <Text style={{ color: palette.subtext, fontSize: 12 }}>Resource link pending.</Text>
                    )}
                  </View>
                ))
              )}
            </View>
          </View>
          <View
            style={[
              styles.managementForm,
              { borderColor: palette.divider, backgroundColor: palette.card },
            ]}
          >
            <Text style={[styles.managementFormLabel, { color: palette.text }]}>
              {educationFormMode === 'edit' ? 'Update course' : 'Add course'}
            </Text>
            <KISTextInput
              label="Course title"
              value={educationForm.title}
              onChangeText={(value) => setEducationForm((prev) => ({ ...prev, title: value }))}
            />
            <KISTextInput
              label="Summary"
              value={educationForm.summary}
              onChangeText={(value) => setEducationForm((prev) => ({ ...prev, summary: value }))}
              multiline
              style={{ minHeight: 80 }}
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <KISButton
                title={educationFormMode === 'edit' ? 'Update course' : 'Add course'}
                onPress={handleEducationFormSave}
                disabled={educationFormLoading}
              />
              {educationFormMode === 'edit' && (
                <KISButton
                  title="Delete course"
                  variant="outline"
                  onPress={handleEducationFormDelete}
                  disabled={educationFormLoading}
                />
              )}
            </View>
            <KISButton
              title="Reset form"
              variant="secondary"
              onPress={resetEducationForm}
              disabled={educationFormLoading}
            />
          </View>
        {renderAttachmentsSection()}
          <View
            style={[
              styles.managementForm,
              { borderColor: palette.divider, backgroundColor: palette.surface },
            ]}
          >
            <Text style={[styles.managementFormLabel, { color: palette.text }]}>Add module</Text>
            <KISTextInput
              label="Module title"
              value={educationModuleForm.title}
              onChangeText={(value) => setEducationModuleForm((prev) => ({ ...prev, title: value }))}
            />
            <KISTextInput
              label="Summary"
              value={educationModuleForm.summary}
              onChangeText={(value) => setEducationModuleForm((prev) => ({ ...prev, summary: value }))}
              multiline
              style={{ minHeight: 70 }}
            />
            <KISTextInput
              label="Resource URL"
              value={educationModuleForm.resource_url}
              onChangeText={(value) => setEducationModuleForm((prev) => ({ ...prev, resource_url: value }))}
              autoCapitalize="none"
              keyboardType="url"
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <KISButton
                title="Add module"
                onPress={handleEducationModuleSave}
                disabled={educationModuleSubmitting}
              />
              <KISButton
                title="Reset form"
                variant="secondary"
                onPress={resetEducationModuleForm}
                disabled={educationModuleSubmitting}
              />
            </View>
          </View>
          <View style={styles.managementActionRow}>
            <KISButton title="Send learning reminder" onPress={() => Alert.alert('Education', 'Reminder sent.')} />
            <KISButton
              title="Plan live session"
              variant="outline"
              onPress={() => Alert.alert('Education', 'Live session planning coming soon.')}
            />
          </View>
        </ScrollView>
      );
    }

    return (
      <View style={styles.managementPanelBody}>
        {baseHeader}
        <Text style={{ color: palette.subtext }}>Profile not created yet.</Text>
      </View>
    );
  };

  const dangerColor = palette.danger ?? palette.primaryStrong;

  return (
    <View style={[styles.wrap, { backgroundColor: palette.bg }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {c.loading ? (
          <View style={{ gap: 16 }}>
            <View style={[styles.card, { backgroundColor: palette.card }]}>
              <Skeleton height={160} radius={18} />
              <View style={{ marginTop: 16, gap: 10 }}>
                <Skeleton height={18} width={200} />
                <Skeleton height={12} width={160} />
                <Skeleton height={12} width={220} />
              </View>
            </View>
            <View style={[styles.card, { backgroundColor: palette.card }]}>
              <Skeleton height={18} width={180} />
              <View style={{ marginTop: 14, gap: 10 }}>
                <Skeleton height={46} radius={12} />
                <Skeleton height={46} radius={12} />
                <Skeleton height={46} radius={12} />
              </View>
            </View>
          </View>
        ) : !c.profile ? (
          <View style={[styles.card, { backgroundColor: palette.card }]}>
            <Text style={[styles.title, { color: palette.text }]}>Profile not available</Text>
            <Text style={[styles.subtext, { color: palette.subtext, marginTop: 6 }]}>
              Pull to refresh or try again.
            </Text>
            <View style={{ marginTop: 12 }}>
              <KISButton title="Retry" onPress={c.loadProfile} />
            </View>
          </View>
        ) : (
          <>
            {/* HERO (matches mock) */}
            <HeroHeader
              coverUrl={c.profile.profile?.cover_url}
              avatarUrl={c.profile.profile?.avatar_url}
              displayName={c.profile.user?.display_name || 'Your name'}
              handle={`@${(c.profile.user?.display_name || 'user')
                .toLowerCase()
                .replace(/\s+/g, '')}`}
              headline={c.profile.profile?.headline || 'Add a headline that sells you'}
              tierName={accountTier?.name || 'Free'}
              completion={c.profile.profile?.completion_score ?? 0}
              onEdit={c.openEditProfile}
            />

            {/* OVERVIEW */}
            <View style={[styles.card, { backgroundColor: palette.card }]}>
              <View style={styles.headerRow}>
                <Text style={[styles.title, { color: palette.text }]}>Profile Overview</Text>
                <Text style={[styles.subtext, { color: palette.subtext }]}>
                  {c.profile.profile?.industry || 'Industry not set'}
                </Text>
              </View>

              <Text style={{ fontSize: 14, lineHeight: 20, color: palette.text }}>
                {c.profile.profile?.bio || 'Add a short bio that explains your work.'}
              </Text>

              <View style={styles.actionRow}>
                <KISButton title="Edit Profile" onPress={c.openEditProfile} />
                <KISButton
                  title="Privacy"
                  variant="outline"
                  onPress={() => c.openSheet('privacy')}
                />
              </View>
            </View>

            {/* ACCOUNT / WALLET / UPGRADE */}
            <AccountCreditsCard
              tierName={accountTier?.name || 'Free'}
              tierPriceCents={accountTier?.price_cents || 0}
              walletBalanceCents={walletBalance}
              credits={credits}
              creditsValueCents={creditsValue}
              points={points}
              onWallet={() => c.openSheet('wallet')}
              onUpgrade={() => c.openSheet('upgrade')}
              showCreatePartnerButton={showCreatePartnerButton}
              onCreatePartner={c.openCreatePartner}
              walletLedger={c.walletLedger}
              partnerProfilesCount={partnerProfilesCount}
              partnerProfilesLimitLabel={partnerProfilesLimitLabel}
              partnerProfilesLimitValue={partnerProfilesLimitValue}
              partnerProfilesIsUnlimited={partnerProfilesIsUnlimited}
            />

            <View
              style={[
                styles.card,
                {
                  borderColor: palette.divider,
                  backgroundColor: palette.surface,
                  borderWidth: 1,
                  marginTop: 12,
                },
              ]}
            >
              <Text style={[styles.title, { color: palette.text }]}>Profile analytics</Text>
              <Text style={[styles.subtext, { color: palette.subtext, marginTop: 4 }]}>
                Surface-level KPIs directly from the analytics backend.
              </Text>
            <View style={{ marginTop: 10 }}>
              <KISButton title="View insights" onPress={openProfileInsights} />
              <KISButton
                title="Developer tools"
                variant="outline"
                onPress={openAdminTools}
                style={{ marginTop: 8 }}
              />
            </View>
          </View>

            <View
              style={[
                styles.sectionCard,
                { backgroundColor: palette.card, borderColor: palette.divider, borderWidth: 1 },
              ]}
            >
              <View style={styles.headerRow}>
                <Text style={[styles.title, { color: palette.text }]}>Broadcast profiles</Text>
                <Text style={[styles.subtext, { color: palette.subtext }]}>
                  Tap any profile type to open its broadcast workspace.
                </Text>
              </View>
              <View style={{ gap: 10 }}>
                {BROADCAST_PROFILE_DEFINITIONS.map((def) => {
                  const profileData = broadcastProfiles?.[def.profileKey];
                  const isLoading = broadcastProfiles === null;
                  const nameLabel = isLoading
                    ? 'Loading…'
                    : profileData?.profile_name || 'Not created yet';
                  const summaryText = isLoading
                    ? 'Refreshing your broadcast profiles…'
                    : profileData
                    ? def.summary(profileData)
                    : def.emptySummary;

                  return (
                    <View
                      key={def.profileKey}
                      style={[
                        styles.broadcastProfileCard,
                        { borderColor: palette.divider, backgroundColor: palette.surface },
                      ]}
                    >
                      <View style={styles.broadcastProfileRow}>
                        <View style={[styles.broadcastProfileIcon, { backgroundColor: palette.primarySoft }]}>
                          <KISIcon name={def.icon as any} size={20} color={palette.primaryStrong} />
                        </View>
                        <View style={styles.broadcastProfileInfo}>
                          <Text style={[styles.broadcastProfileTitle, { color: palette.text }]}>
                            {def.label}
                          </Text>
                          <Text style={[styles.broadcastProfileSubtitle, { color: palette.subtext }]}>
                            {def.helper}
                          </Text>
                          <Text style={[styles.broadcastProfileSubtitle, { color: palette.subtext }]}>
                            {nameLabel}
                          </Text>
                          <Text style={[styles.broadcastProfileMeta, { color: palette.subtext }]}>
                            {summaryText}
                          </Text>
                        </View>
                        <KISButton
                          title={profileData ? 'Manage' : 'Create'}
                          size="xs"
                          variant={profileData ? 'primary' : 'secondary'}
                          onPress={() => handleBroadcastCTA(def)}
                        />
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            <View
              style={[
                styles.sectionCard,
                { backgroundColor: palette.card, borderColor: palette.divider, borderWidth: 1 },
              ]}
            >
              <PartnerProfilesList
                partners={partnerProfiles}
                limitLabel={partnerProfilesLimitLabel}
                limitValue={partnerProfilesLimitValue}
                isUnlimited={partnerProfilesIsUnlimited}
                canCreate={canCreatePartner}
                actionLoadingId={c.partnerActionId}
                onDeactivate={c.deactivatePartnerProfile}
                onReactivate={c.reactivatePartnerProfile}
                onDelete={c.deletePartnerProfile}
              />
            </View>

            {/* IMPACT */}
            <View
              style={[
                styles.sectionCard,
                { backgroundColor: palette.card, borderColor: palette.divider },
              ]}
            >
              <View style={styles.headerRow}>
                <Text style={[styles.title, { color: palette.text }]}>Impact Snapshot</Text>
                <Text style={[styles.subtext, { color: palette.subtext }]}>Quick analytics</Text>
              </View>

              <View style={styles.statRow}>
                {[
                  { label: 'Articles', value: c.profile.sections?.articles?.length || 0 },
                  { label: 'Projects', value: c.profile.sections?.projects?.length || 0 },
                  {
                    label: 'Testimonials',
                    value: c.profile.sections?.showcases?.testimonial?.length || 0,
                  },
                  { label: 'Activity', value: c.profile.sections?.activity?.length || 0 },
                ].map((it) => (
                  <View
                    key={it.label}
                    style={[styles.statChip, { backgroundColor: palette.surfaceElevated }]}
                  >
                    <Text style={[styles.statValue, { color: palette.text }]}>{it.value}</Text>
                    <Text style={[styles.statLabel, { color: palette.subtext }]}>{it.label}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* ALL SECTIONS */}
            {c.sectionList.map((section) => (
              <SectionCard
                key={section.key}
                title={section.title}
                type={section.key as any}
                items={section.items}
                onAdd={() => c.openItemEditor(section.key as any)}
                onEdit={(item) => c.openItemEditor(section.key as any, item)}
                onDelete={(id) => c.deleteItem(section.key as any, id)}
              />
            ))}

            {/* LOGOUT */}
            <View style={{ gap: 12 }}>
              <KISButton title="Log Out" onPress={c.logout} variant="outline" />
            </View>
          </>
        )}
      </ScrollView>

      {/* Partner slide */}
      {c.showCreatePartner && (
        <Animated.View
          style={[
            styles.slideContainer,
            { backgroundColor: palette.bg, transform: [{ translateX: c.slideX }] },
          ]}
        >
          <PartnerCreateSlide onClose={c.closeCreatePartner} />
        </Animated.View>
      )}

      {managementPanelKey && (
        <Animated.View
          style={[
            styles.managementPanel,
            {
              transform: [{ translateX: managementPanelOffset }],
              backgroundColor: palette.surface,
            },
          ]}
        >
        <View style={styles.managementPanelHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.managementPanelTitle, { color: palette.text }]}>
              {managementPanelDefinition?.label ?? 'Profile console'}
            </Text>
            <Text style={[styles.managementPanelSubtitle, { color: palette.subtext }]}>
              {managementPanelDefinition?.helper}
            </Text>
          </View>
          <Pressable onPress={closeManagementPanel} style={styles.managementClose}>
            <KISIcon name="x" size={18} color={palette.subtext} />
            <Text style={[styles.managementCloseText, { color: palette.subtext }]}>Close</Text>
          </Pressable>
        </View>
          {renderManagementPanelContent()}
        </Animated.View>
      )}

      {/* Bottom Sheet host */}
      {c.activeSheet && (
        <BottomSheet sheetY={c.sheetY} onBackdropPress={c.closeSheet}>
          <SheetHeader title={sheetTitle} onClose={c.closeSheet} />

          <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
            {/* =========================
                EDIT PROFILE
               ========================= */}
            {c.activeSheet === 'editProfile' && (
              <View style={{ gap: 12 }}>
                <View style={styles.editMediaRow}>
                  <Pressable
                    onPress={() => c.pickImage('avatar')}
                    style={[styles.mediaPickCard, { backgroundColor: palette.surface }]}
                  >
                    {c.draftProfile?.avatar_preview ? (
                      <Image
                        source={{ uri: c.draftProfile.avatar_preview }}
                        style={styles.mediaPickImage}
                      />
                    ) : (
                      <View
                        style={[
                          styles.mediaPickImage,
                          {
                            backgroundColor: palette.card,
                            alignItems: 'center',
                            justifyContent: 'center',
                          },
                        ]}
                      >
                        <KISIcon name="user" size={18} color={palette.subtext} />
                      </View>
                    )}
                    <Text style={[styles.mediaPickLabel, { color: palette.text }]}>
                      Change avatar
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => c.pickImage('cover')}
                    style={[styles.mediaPickCard, { backgroundColor: palette.surface, flex: 1 }]}
                  >
                    {c.draftProfile?.cover_preview ? (
                      <Image
                        source={{ uri: c.draftProfile.cover_preview }}
                        style={styles.mediaPickImageWide}
                      />
                    ) : (
                      <View
                        style={[
                          styles.mediaPickImageWide,
                          {
                            backgroundColor: palette.card,
                            alignItems: 'center',
                            justifyContent: 'center',
                          },
                        ]}
                      >
                        <KISIcon name="image" size={18} color={palette.subtext} />
                      </View>
                    )}
                    <Text style={[styles.mediaPickLabel, { color: palette.text }]}>
                      Change cover
                    </Text>
                  </Pressable>
                </View>

                <KISTextInput
                  label="Display name"
                  value={c.draftProfile.display_name}
                  onChangeText={(t) => c.setDraftProfile((s: any) => ({ ...s, display_name: t }))}
                />
                <KISTextInput
                  label="Headline"
                  value={c.draftProfile.headline}
                  onChangeText={(t) => c.setDraftProfile((s: any) => ({ ...s, headline: t }))}
                />
                <KISTextInput
                  label="Industry"
                  value={c.draftProfile.industry}
                  onChangeText={(t) => c.setDraftProfile((s: any) => ({ ...s, industry: t }))}
                />
                <KISTextInput
                  label="Bio"
                  value={c.draftProfile.bio}
                  onChangeText={(t) => c.setDraftProfile((s: any) => ({ ...s, bio: t }))}
                  multiline
                  style={{ minHeight: 110 }}
                />

                <KISButton
                  title={c.saving ? 'Saving...' : 'Save'}
                  onPress={c.saveProfile}
                  disabled={c.saving}
                />
              </View>
            )}

            {/* =========================
                PRIVACY
               ========================= */}
            {c.activeSheet === 'privacy' && (
              <View style={{ gap: 16 }}>
                {Object.keys(fieldLabels).map((key) => {
                  const rule = c.draftPrivacy?.[key] || { visibility: 'public', allow_user_ids: [] };
                  const allowValue = Array.isArray(rule.allow_user_ids) ? rule.allow_user_ids.join(',') : '';
                  return (
                    <View key={key} style={[styles.privacyRow, { borderColor: palette.divider }]}>
                      <Text style={[styles.privacyLabel, { color: palette.text }]}>{fieldLabels[key]}</Text>

                      <View style={styles.privacyOptions}>
                        {visibilityOptions.map((opt) => (
                          <Pressable
                            key={opt.value}
                            onPress={() =>
                              c.setDraftPrivacy((s: any) => ({
                                ...s,
                                [key]: { ...rule, field_key: key, visibility: opt.value },
                              }))
                            }
                            style={[
                              styles.privacyChip,
                              {
                                backgroundColor:
                                  rule.visibility === opt.value ? palette.primarySoft : palette.surface,
                                borderColor: palette.divider,
                              },
                            ]}
                          >
                            <Text style={{ color: palette.text, fontSize: 12 }}>{opt.label}</Text>
                          </Pressable>
                        ))}
                      </View>

                      {(rule.visibility === 'custom' || rule.visibility === 'contacts') && (
                        <KISTextInput
                          label="Allowed user IDs (comma separated)"
                          value={allowValue}
                          onChangeText={(text) =>
                            c.setDraftPrivacy((s: any) => ({
                              ...s,
                              [key]: {
                                ...rule,
                                field_key: key,
                                allow_user_ids: text
                                  .split(',')
                                  .map((t) => t.trim())
                                  .filter(Boolean),
                              },
                            }))
                          }
                        />
                      )}
                    </View>
                  );
                })}

                <KISButton title={c.saving ? 'Saving...' : 'Save'} onPress={c.savePrivacy} disabled={c.saving} />
              </View>
            )}

            {/* =========================
                EDIT ITEM
               ========================= */}
            {c.activeSheet === 'editItem' && c.draftItem && (
              <View style={{ gap: 12 }}>
                <KISTextInput
                  label="Title / Name"
                  value={c.draftItem.data.title || c.draftItem.data.name || ''}
                  onChangeText={(t) =>
                    c.setDraftItem((s: any) => ({
                      ...s,
                      data: {
                        ...s.data,
                        title: s.data.title != null ? t : s.data.title,
                        name: s.data.name != null ? t : s.data.name,
                      },
                    }))
                  }
                />

                <KISTextInput
                  label="Description / Summary"
                  value={c.draftItem.data.description || c.draftItem.data.summary || ''}
                  onChangeText={(t) =>
                    c.setDraftItem((s: any) => ({
                      ...s,
                      data: { ...s.data, description: t, summary: t },
                    }))
                  }
                  multiline
                  style={{ minHeight: 100 }}
                />

                {typeof c.pickShowcaseFile === 'function' && (
                  <Pressable
                    onPress={async () => {
                      const file = await c.pickShowcaseFile(c.draftItem.type);
                      if (file) c.setDraftItem((s: any) => ({ ...s, data: { ...s.data, file } }));
                    }}
                    style={[styles.mediaPickCard, { backgroundColor: palette.surface }]}
                  >
                    <Text style={[styles.mediaPickLabel, { color: palette.text }]}>
                      Attach media (optional)
                    </Text>
                    {c.draftItem.data.file?.name ? (
                      <Text style={[styles.subtext, { color: palette.subtext }]} numberOfLines={1}>
                        {c.draftItem.data.file.name}
                      </Text>
                    ) : null}
                  </Pressable>
                )}

                <KISButton title={c.saving ? 'Saving...' : 'Save'} onPress={c.saveItem} disabled={c.saving} />
              </View>
            )}

            {/* =========================
                WALLET
               ========================= */}
            {c.activeSheet === 'wallet' && (
              <View style={{ gap: 12 }}>
                <Text style={[styles.subtext, { color: palette.subtext }]}>
                  Add money, convert to credits, or send gifts. $1 = 20 credits (USD only).
                </Text>

                <View style={styles.walletModeRow}>
                  {walletModes.map((mode) => (
                    <Pressable
                      key={mode.value}
                      onPress={() => c.setWalletForm((s: any) => ({ ...s, mode: mode.value }))}
                      style={[
                        styles.walletModeChip,
                        {
                          backgroundColor: c.walletForm.mode === mode.value ? palette.primarySoft : palette.surface,
                          borderColor: palette.divider,
                        },
                      ]}
                    >
                      <Text style={{ color: palette.text, fontSize: 12 }}>{mode.label}</Text>
                    </Pressable>
                  ))}
                </View>

                {c.walletForm.mode === 'deposit' && (
                  <>
                    <View style={styles.walletModeRow}>
                      {paymentProviders.map((provider) => (
                        <Pressable
                          key={provider.value}
                          onPress={() => c.setWalletForm((s: any) => ({ ...s, provider: provider.value }))}
                          style={[
                            styles.walletModeChip,
                            {
                              backgroundColor: c.walletForm.provider === provider.value ? palette.primarySoft : palette.surface,
                              borderColor: palette.divider,
                            },
                          ]}
                        >
                          <Text style={{ color: palette.text, fontSize: 12 }}>{provider.label}</Text>
                        </Pressable>
                      ))}
                    </View>

                    <KISTextInput
                      label="Amount (USD)"
                      value={c.walletForm.amount}
                      onChangeText={(t) => c.setWalletForm((s: any) => ({ ...s, amount: t }))}
                      keyboardType="decimal-pad"
                    />
                  </>
                )}

                {c.walletForm.mode === 'cash_to_credits' && (
                  <KISTextInput
                    label="Amount to convert (USD)"
                    value={c.walletForm.amount}
                    onChangeText={(t) => c.setWalletForm((s: any) => ({ ...s, amount: t }))}
                    keyboardType="decimal-pad"
                  />
                )}

                {c.walletForm.mode === 'credits_to_cash' && (
                  <KISTextInput
                    label="Credits to convert"
                    value={c.walletForm.credits}
                    onChangeText={(t) => c.setWalletForm((s: any) => ({ ...s, credits: t }))}
                    keyboardType="number-pad"
                  />
                )}

                {c.walletForm.mode === 'points_to_credits' && (
                  <KISTextInput
                    label="Points to convert"
                    value={c.walletForm.points}
                    onChangeText={(t) => c.setWalletForm((s: any) => ({ ...s, points: t }))}
                    keyboardType="number-pad"
                  />
                )}

                {c.walletForm.mode === 'transfer' && (
                  <>
                    <KISTextInput
                      label="Recipient phone number with country code"
                      value={c.walletForm.recipient}
                      onChangeText={(t) => c.setWalletForm((s: any) => ({ ...s, recipient: t }))}
                    />
                    <KISTextInput
                      label="Amount (USD)"
                      value={c.walletForm.amount}
                      onChangeText={(t) => c.setWalletForm((s: any) => ({ ...s, amount: t }))}
                      keyboardType="decimal-pad"
                    />
                    <KISTextInput
                      label="Or credits (optional)"
                      value={c.walletForm.credits}
                      onChangeText={(t) => c.setWalletForm((s: any) => ({ ...s, credits: t }))}
                      keyboardType="number-pad"
                    />
                  </>
                )}

                {c.walletForm.mode === 'promo' && (
                  <KISTextInput
                    label="Promo code"
                    value={c.walletForm.promo}
                    onChangeText={(t) => c.setWalletForm((s: any) => ({ ...s, promo: t.toUpperCase() }))}
                    autoCapitalize="characters"
                  />
                )}

                <KISButton
                  title={c.saving ? 'Working...' : 'Submit'}
                  onPress={async () => {
                    await c.submitWalletAction?.();
                    const paymentUrl = c.lastWalletPaymentUrl;
                    if (paymentUrl) Linking.openURL(paymentUrl);
                  }}
                  disabled={c.saving}
                />
              </View>
            )}

            {/* =========================
                UPGRADE (UPDATED)
               ========================= */}
            {c.activeSheet === 'upgrade' && (
              <UpgradeSheet
                tiers={c.profile?.tiers || []}
                accountTier={accountTier}
                saving={c.saving}
                onUpgrade={c.upgradeTier}
                subscription={c.billingHistory?.subscription ?? c.profile?.subscription}
                billingHistory={c.billingHistory}
                usage={c.billingHistory?.usage || c.profile?.stats}
                onCancel={c.cancelSubscription}
                onResume={c.resumeSubscription}
                onDowngrade={c.downgradeTier}
                onRetry={c.retryTransaction}
              />
            )}
          </ScrollView>
        </BottomSheet>
      )}
    </View>
  );
}
