import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { patchRequest } from '@/network/patch';
import { postRequest } from '@/network/post';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Asset } from 'react-native-image-picker';
import type { InsightPayload, TimeRange } from '@/api/insights/types';
import {
  aggregateInstitutionAnalytics,
  fetchInstitutionAnalyticsQueryPayload,
  mapHealthDashboardAnalyticsToInsightPayload,
} from '@/features/health-dashboard/analytics';
import type {
  HealthDashboardInstitutionType,
  InstitutionDashboardSchema,
  InstitutionProfileEditorDraft,
} from '@/features/health-dashboard/models';
import {
  HEALTH_DASHBOARD_DEFAULT_OPERATIONAL_MODULES,
  HEALTH_DASHBOARD_DEFAULT_SERVICES,
} from '@/features/health-dashboard/defaults';
import {
  fetchHealthProfileState,
  updateHealthInstitutions,
} from '@/services/healthProfileService';

type CreateInstitutionDashboardPayload = {
  institutionId: string;
  type: HealthDashboardInstitutionType;
};
let healthDashboardApiUnavailable = false;
let uploadBlockedUntil = 0;
const PROFILE_EDITOR_CACHE_PREFIX = 'kis_health_dashboard_profile_editor_v1:';
const logHealthDashboard = (...args: any[]) => {
  console.log('[healthDashboardService]', ...args);
};

const createEmptyAnalyticsHeader = () => ({
  revenue: { today: 0, week: 0, month: 0 },
  bookingsCount: 0,
  completedConsultations: 0,
  pendingSchedules: 0,
  cancellationRate: 0,
  conversion: { views: 0, bookings: 0, rate: 0 },
  averageRating: 0,
  patientReturnRate: 0,
  paymentBreakdown: { cash: 0, insurance: 0, online: 0 },
});

const createEmptyAnalyticsBundle = () => ({
  bookingsOverTime: [],
  revenueBreakdown: [],
  serviceUsageDistribution: [],
  topServices: [],
  topPatients: [],
  paymentMethodBreakdown: [],
});

const parseDateOnly = (value: string): Date | null => {
  const [y, m, d] = String(value || '').split('-').map((part) => Number(part));
  if (!y || !m || !d) return null;
  const parsed = new Date(y, m - 1, d);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const readCalendarStatuses = (raw: any): Record<string, string> => {
  const source =
    raw?.calendar_statuses ??
    raw?.calendarStatuses ??
    raw?.date_statuses ??
    raw?.dateStatuses ??
    {};
  if (!source || typeof source !== 'object' || Array.isArray(source)) return {};
  return source as Record<string, string>;
};

const readCalendarTimes = (raw: any): Record<string, string> => {
  const source =
    raw?.calendar_times ??
    raw?.calendarTimes ??
    raw?.date_times ??
    raw?.dateTimes ??
    {};
  if (!source || typeof source !== 'object' || Array.isArray(source)) return {};
  return source as Record<string, string>;
};

const parseDateTime = (dateKey: string, time: string): Date | null => {
  const date = parseDateOnly(dateKey);
  if (!date) return null;
  const [hh, mm] = String(time || '').split(':').map((part) => Number(part));
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  const parsed = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hh, mm, 0, 0);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const deriveScheduleSummaryFromStatuses = (
  statuses: Record<string, string>,
  dayTimes: Record<string, string>,
) => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let today = 0;
  let upcoming = 0;
  let past = 0;

  Object.keys(statuses).forEach((dateKey) => {
    const date = parseDateOnly(dateKey);
    if (!date) return;

     const timeValue = dayTimes?.[dateKey];
     const dateTime = timeValue ? parseDateTime(dateKey, timeValue) : null;
     if (dateTime) {
      if (dateTime > now) {
        if (date.getTime() === todayStart.getTime()) {
          today += 1;
        } else {
          upcoming += 1;
        }
      } else {
        past += 1;
      }
      return;
    }

    if (date.getTime() === todayStart.getTime()) {
      today += 1;
      return;
    }
    if (date > todayStart) {
      upcoming += 1;
      return;
    }
    past += 1;
  });

  return { today, upcoming, past };
};

const editorCacheKey = (institutionId: string) =>
  `${PROFILE_EDITOR_CACHE_PREFIX}${institutionId}`;

const readProfileEditorCache = async (
  institutionId: string,
): Promise<InstitutionProfileEditorDraft | null> => {
  try {
    const raw = await AsyncStorage.getItem(editorCacheKey(institutionId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed as InstitutionProfileEditorDraft;
    }
    return null;
  } catch {
    return null;
  }
};

const writeProfileEditorCache = async (
  institutionId: string,
  draft: Partial<InstitutionProfileEditorDraft> | null | undefined,
) => {
  if (!draft || typeof draft !== 'object') return;
  try {
    await AsyncStorage.setItem(editorCacheKey(institutionId), JSON.stringify(draft));
    logHealthDashboard('profileEditorCache:write', {
      institutionId,
      keys: Object.keys(draft).slice(0, 20),
    });
  } catch {}
};

const toStringList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item ?? '').trim())
    .filter(Boolean);
};

const resolveLocalLandingPreview = (institution: any) =>
  institution?.landing_preview ??
  institution?.landingPreview ??
  institution?.dashboard?.landing_preview ??
  institution?.dashboard?.landingPreview ??
  null;

const hasInstitutionEditableData = (institution: any): boolean => {
  if (!institution || typeof institution !== 'object') return false;
  const landing = resolveLocalLandingPreview(institution);
  const editor =
    institution?.profile_editor ??
    institution?.profileEditor ??
    institution?.dashboard?.profile_editor ??
    institution?.dashboard?.profileEditor;
  return Boolean(
    (landing && typeof landing === 'object' && Object.keys(landing).length > 0) ||
      (editor && typeof editor === 'object' && Object.keys(editor).length > 0),
  );
};

const buildDraftFromInstitution = (
  institution: any,
  fallback: Partial<InstitutionProfileEditorDraft> = {},
): InstitutionProfileEditorDraft => {
  const institutionType = (institution?.type || 'clinic') as HealthDashboardInstitutionType;
  const defaultServices = HEALTH_DASHBOARD_DEFAULT_SERVICES[institutionType] || [];
  const base: InstitutionProfileEditorDraft = {
    hero: {
      imageUrl: '',
      title: institution?.name || '',
      slogan: '',
      ctaLabel: 'Book Now',
      ctaUrl: '',
    },
    about: '',
    gallery: [],
    servicesVisibility: Object.fromEntries(defaultServices.map((service) => [service.id, true])),
    staffDisplayEnabled: true,
    certifications: [],
    faqs: [],
    seo: {
      title: '',
      description: '',
      keywords: [],
    },
    contact: {
      phone: '',
      email: '',
      address: '',
    },
    socialLinks: [],
    emergencyBanner: {
      enabled: false,
      message: '',
    },
    operatingHours: [],
    pricingVisibilityEnabled: true,
    landingBackgroundImageUrl: '',
    landingBackgroundColorKey: '',
    landingLogoUrl: '',
  };

  const profileEditor =
    institution?.profile_editor ??
    institution?.profileEditor ??
    institution?.dashboard?.profile_editor ??
    institution?.dashboard?.profileEditor ??
    {};
  const landing = resolveLocalLandingPreview(institution) || {};

  const servicesOverview = toStringList(landing?.servicesOverview);
  const servicesVisibilityFromLanding = servicesOverview.length
    ? Object.fromEntries(
        defaultServices.map((service) => [
          service.id,
          servicesOverview.includes(service.name),
        ]),
      )
    : {};

  return {
    ...base,
    ...fallback,
    ...(profileEditor || {}),
    hero: {
      ...base.hero,
      ...(fallback?.hero || {}),
      ...(profileEditor?.hero || {}),
      ...(landing?.hero || {}),
      title:
        landing?.hero?.title ||
        profileEditor?.hero?.title ||
        institution?.name ||
        fallback?.hero?.title ||
        base.hero.title,
    },
    about:
      landing?.about ??
      profileEditor?.about ??
      fallback?.about ??
      base.about,
    gallery:
      (Array.isArray(landing?.gallery) && landing.gallery) ||
      (Array.isArray(profileEditor?.gallery) && profileEditor.gallery) ||
      (Array.isArray(fallback?.gallery) && fallback.gallery) ||
      base.gallery,
    servicesVisibility: {
      ...base.servicesVisibility,
      ...(fallback?.servicesVisibility || {}),
      ...(profileEditor?.servicesVisibility || {}),
      ...(servicesVisibilityFromLanding || {}),
    },
    certifications:
      toStringList(landing?.certifications).length > 0
        ? toStringList(landing?.certifications)
        : toStringList(profileEditor?.certifications),
    contact: {
      ...base.contact,
      ...(fallback?.contact || {}),
      ...(profileEditor?.contact || {}),
    },
    emergencyBanner: {
      ...base.emergencyBanner,
      ...(fallback?.emergencyBanner || {}),
      ...(profileEditor?.emergencyBanner || {}),
      message:
        landing?.emergencyNotice ||
        profileEditor?.emergencyBanner?.message ||
        fallback?.emergencyBanner?.message ||
        base.emergencyBanner.message,
    },
    operatingHours:
      toStringList(landing?.operatingHours).length > 0
        ? toStringList(landing?.operatingHours)
        : toStringList(profileEditor?.operatingHours),
    seo: {
      ...base.seo,
      ...(fallback?.seo || {}),
      ...(profileEditor?.seo || {}),
    },
    socialLinks:
      toStringList(profileEditor?.socialLinks).length > 0
        ? toStringList(profileEditor?.socialLinks)
        : toStringList(fallback?.socialLinks),
    faqs: Array.isArray(profileEditor?.faqs) ? profileEditor.faqs : (fallback?.faqs || []),
    staffDisplayEnabled:
      profileEditor?.staffDisplayEnabled ?? fallback?.staffDisplayEnabled ?? base.staffDisplayEnabled,
    pricingVisibilityEnabled:
      profileEditor?.pricingVisibilityEnabled ??
      fallback?.pricingVisibilityEnabled ??
      base.pricingVisibilityEnabled,
    landingBackgroundImageUrl:
      profileEditor?.landingBackgroundImageUrl ??
      fallback?.landingBackgroundImageUrl ??
      base.landingBackgroundImageUrl,
    landingBackgroundColorKey:
      profileEditor?.landingBackgroundColorKey ??
      fallback?.landingBackgroundColorKey ??
      base.landingBackgroundColorKey,
    landingLogoUrl:
      profileEditor?.landingLogoUrl ??
      fallback?.landingLogoUrl ??
      base.landingLogoUrl,
  };
};

const getHealthInstitutionContext = async (institutionId: string) => {
  const state = await fetchHealthProfileState();
  const institutions = Array.isArray(state.profile?.institutions) ? state.profile!.institutions : [];
  const index = institutions.findIndex((item: any) => String(item?.id) === String(institutionId));
  const institution = index >= 0 ? institutions[index] : null;
  logHealthDashboard('getHealthInstitutionContext', {
    institutionId,
    exists: !!institution,
    index,
    institutionsCount: institutions.length,
    institutionKeys: institution && typeof institution === 'object' ? Object.keys(institution).slice(0, 20) : [],
  });
  return { institutions, institution, index };
};

const readLocalProfileEditorDraft = async (institutionId: string): Promise<InstitutionProfileEditorDraft | null> => {
  const { institution } = await getHealthInstitutionContext(institutionId);
  const cached = await readProfileEditorCache(institutionId);
  if (!institution) {
    return cached;
  }
  const hasEditableData = hasInstitutionEditableData(institution);
  const draft = buildDraftFromInstitution(institution);
  if (!hasEditableData && cached) {
    logHealthDashboard('readLocalProfileEditorDraft:using-cached-over-minimal-institution', {
      institutionId,
      institutionKeys: Object.keys(institution).slice(0, 20),
    });
    return cached;
  }
  await writeProfileEditorCache(institutionId, draft);
  return draft;
};

const writeLocalProfileEditorDraft = async (
  institutionId: string,
  updates: Partial<InstitutionProfileEditorDraft>,
) => {
  const { institutions, institution, index } = await getHealthInstitutionContext(institutionId);
  if (!institution || index < 0) {
    return { success: false, status: 404, message: 'Institution not found in health profile.' };
  }
  const existingDraft =
    institution?.profile_editor ??
    institution?.profileEditor ??
    institution?.dashboard?.profile_editor ??
    institution?.dashboard?.profileEditor ??
    {};
  const nextDraft = {
    ...(existingDraft || {}),
    ...(updates || {}),
    hero: {
      ...(existingDraft?.hero || {}),
      ...(updates?.hero || {}),
    },
    seo: {
      ...(existingDraft?.seo || {}),
      ...(updates?.seo || {}),
    },
    contact: {
      ...(existingDraft?.contact || {}),
      ...(updates?.contact || {}),
    },
    emergencyBanner: {
      ...(existingDraft?.emergencyBanner || {}),
      ...(updates?.emergencyBanner || {}),
    },
    servicesVisibility: {
      ...(existingDraft?.servicesVisibility || {}),
      ...(updates?.servicesVisibility || {}),
    },
  };
  const nextInstitution = {
    ...institution,
    landing_preview: {
      ...(resolveLocalLandingPreview(institution) || {}),
      hero: {
        ...(resolveLocalLandingPreview(institution)?.hero || {}),
        imageUrl: nextDraft?.hero?.imageUrl || '',
        title: nextDraft?.hero?.title || institution?.name || '',
        slogan: nextDraft?.hero?.slogan || '',
        ctaLabel: nextDraft?.hero?.ctaLabel || 'Book Now',
        ctaUrl: nextDraft?.hero?.ctaUrl || '',
      },
      about: nextDraft?.about || '',
      servicesOverview: Object.entries(nextDraft?.servicesVisibility || {})
        .filter(([, enabled]) => !!enabled)
        .map(([serviceId]) =>
          (HEALTH_DASHBOARD_DEFAULT_SERVICES[(institution?.type || 'clinic') as HealthDashboardInstitutionType] || [])
            .find((service) => service.id === serviceId)?.name || serviceId,
        ),
      gallery: Array.isArray(nextDraft?.gallery) ? nextDraft.gallery : [],
      certifications: Array.isArray(nextDraft?.certifications) ? nextDraft.certifications : [],
      operatingHours: Array.isArray(nextDraft?.operatingHours) ? nextDraft.operatingHours : [],
      emergencyNotice: nextDraft?.emergencyBanner?.enabled ? nextDraft?.emergencyBanner?.message || '' : '',
    },
    landingPreview: {
      ...(resolveLocalLandingPreview(institution) || {}),
      hero: {
        ...(resolveLocalLandingPreview(institution)?.hero || {}),
        imageUrl: nextDraft?.hero?.imageUrl || '',
        title: nextDraft?.hero?.title || institution?.name || '',
        slogan: nextDraft?.hero?.slogan || '',
        ctaLabel: nextDraft?.hero?.ctaLabel || 'Book Now',
        ctaUrl: nextDraft?.hero?.ctaUrl || '',
      },
      about: nextDraft?.about || '',
      servicesOverview: Object.entries(nextDraft?.servicesVisibility || {})
        .filter(([, enabled]) => !!enabled)
        .map(([serviceId]) =>
          (HEALTH_DASHBOARD_DEFAULT_SERVICES[(institution?.type || 'clinic') as HealthDashboardInstitutionType] || [])
            .find((service) => service.id === serviceId)?.name || serviceId,
        ),
      gallery: Array.isArray(nextDraft?.gallery) ? nextDraft.gallery : [],
      certifications: Array.isArray(nextDraft?.certifications) ? nextDraft.certifications : [],
      operatingHours: Array.isArray(nextDraft?.operatingHours) ? nextDraft.operatingHours : [],
      emergencyNotice: nextDraft?.emergencyBanner?.enabled ? nextDraft?.emergencyBanner?.message || '' : '',
    },
    profile_editor: nextDraft,
    profileEditor: nextDraft,
    dashboard: {
      ...(institution?.dashboard || {}),
      landing_preview: {
        ...(resolveLocalLandingPreview(institution) || {}),
        hero: {
          ...(resolveLocalLandingPreview(institution)?.hero || {}),
          imageUrl: nextDraft?.hero?.imageUrl || '',
          title: nextDraft?.hero?.title || institution?.name || '',
          slogan: nextDraft?.hero?.slogan || '',
          ctaLabel: nextDraft?.hero?.ctaLabel || 'Book Now',
          ctaUrl: nextDraft?.hero?.ctaUrl || '',
        },
        about: nextDraft?.about || '',
        servicesOverview: Object.entries(nextDraft?.servicesVisibility || {})
          .filter(([, enabled]) => !!enabled)
          .map(([serviceId]) =>
            (HEALTH_DASHBOARD_DEFAULT_SERVICES[(institution?.type || 'clinic') as HealthDashboardInstitutionType] || [])
              .find((service) => service.id === serviceId)?.name || serviceId,
          ),
        gallery: Array.isArray(nextDraft?.gallery) ? nextDraft.gallery : [],
        certifications: Array.isArray(nextDraft?.certifications) ? nextDraft.certifications : [],
        operatingHours: Array.isArray(nextDraft?.operatingHours) ? nextDraft.operatingHours : [],
        emergencyNotice: nextDraft?.emergencyBanner?.enabled ? nextDraft?.emergencyBanner?.message || '' : '',
      },
      landingPreview: {
        ...(resolveLocalLandingPreview(institution) || {}),
        hero: {
          ...(resolveLocalLandingPreview(institution)?.hero || {}),
          imageUrl: nextDraft?.hero?.imageUrl || '',
          title: nextDraft?.hero?.title || institution?.name || '',
          slogan: nextDraft?.hero?.slogan || '',
          ctaLabel: nextDraft?.hero?.ctaLabel || 'Book Now',
          ctaUrl: nextDraft?.hero?.ctaUrl || '',
        },
        about: nextDraft?.about || '',
        servicesOverview: Object.entries(nextDraft?.servicesVisibility || {})
          .filter(([, enabled]) => !!enabled)
          .map(([serviceId]) =>
            (HEALTH_DASHBOARD_DEFAULT_SERVICES[(institution?.type || 'clinic') as HealthDashboardInstitutionType] || [])
              .find((service) => service.id === serviceId)?.name || serviceId,
          ),
        gallery: Array.isArray(nextDraft?.gallery) ? nextDraft.gallery : [],
        certifications: Array.isArray(nextDraft?.certifications) ? nextDraft.certifications : [],
        operatingHours: Array.isArray(nextDraft?.operatingHours) ? nextDraft.operatingHours : [],
        emergencyNotice: nextDraft?.emergencyBanner?.enabled ? nextDraft?.emergencyBanner?.message || '' : '',
      },
      profile_editor: nextDraft,
      profileEditor: nextDraft,
    },
  };
  const nextInstitutions = [...institutions];
  nextInstitutions[index] = nextInstitution;
  const res = await updateHealthInstitutions(nextInstitutions);
  if (!res?.success) {
    await writeProfileEditorCache(institutionId, nextDraft);
    return res;
  }
  await writeProfileEditorCache(institutionId, nextDraft);
  return { success: true, status: 200, data: { profile_editor: nextDraft } };
};

const readLocalAvailabilityDraft = async (institutionId: string) => {
  const { institution } = await getHealthInstitutionContext(institutionId);
  const draft =
    institution?.availability ??
    institution?.dashboard?.availability ??
    null;
  return draft && typeof draft === 'object' ? draft : {};
};

const writeLocalAvailabilityDraft = async (
  institutionId: string,
  payload: Record<string, unknown>,
) => {
  const { institutions, institution, index } = await getHealthInstitutionContext(institutionId);
  if (!institution || index < 0) {
    return { success: false, status: 404, message: 'Institution not found in health profile.' };
  }
  const existing = institution?.availability ?? institution?.dashboard?.availability ?? {};
  const nextAvailability = {
    ...(existing || {}),
    ...(payload || {}),
  };
  const nextInstitution = {
    ...institution,
    availability: nextAvailability,
    dashboard: {
      ...(institution?.dashboard || {}),
      availability: nextAvailability,
    },
  };
  const nextInstitutions = [...institutions];
  nextInstitutions[index] = nextInstitution;
  const res = await updateHealthInstitutions(nextInstitutions);
  if (!res?.success) return res;
  return { success: true, status: 200, data: nextAvailability };
};

export const buildInitialDashboardSchema = (
  payload: CreateInstitutionDashboardPayload,
): InstitutionDashboardSchema => {
  const now = new Date().toISOString();
  const defaults = HEALTH_DASHBOARD_DEFAULT_SERVICES[payload.type];
  const modules = HEALTH_DASHBOARD_DEFAULT_OPERATIONAL_MODULES[payload.type];

  return {
    institutionId: payload.institutionId,
    type: payload.type,
    analyticsHeader: createEmptyAnalyticsHeader(),
    analytics: createEmptyAnalyticsBundle(),
    landingPreview: {
      hero: {
        imageUrl: '',
        title: '',
        slogan: '',
        ctaLabel: '',
        ctaUrl: '',
      },
      about: '',
      servicesOverview: defaults.map((item) => item.name),
      careTeamPreviewEnabled: true,
      gallery: [],
      testimonials: [],
      certifications: [],
      operatingHours: [],
    },
    services: defaults,
    operationalModules: modules,
    schedule: { today: 0, upcoming: 0, past: 0 },
    financial: {
      totalRevenueCents: 0,
      insuranceRevenueCents: 0,
      directRevenueCents: 0,
      pendingPaymentsCents: 0,
      refundsCents: 0,
      disputesCount: 0,
    },
    compliance: {
      auditLogCount: 0,
      pendingCredentialReviews: 0,
      licenseExpiringSoonCount: 0,
      activeConsents: 0,
      pendingDocuments: 0,
    },
    createdAt: now,
    updatedAt: now,
  };
};

export const fetchInstitutionDashboard = async (institutionId: string) => {
  if (healthDashboardApiUnavailable) {
    return { success: false, status: 404, message: 'Health dashboard API is unavailable.' };
  }
  return getRequest(ROUTES.healthDashboard.institution(institutionId));
};

export const createInstitutionDashboard = async (payload: CreateInstitutionDashboardPayload) => {
  if (healthDashboardApiUnavailable) {
    return { success: false, status: 404, message: 'Health dashboard API is unavailable.' };
  }
  const schema = buildInitialDashboardSchema(payload);
  const response = await postRequest(ROUTES.healthDashboard.institutions, schema);
  if (Number(response?.status) === 404) {
    healthDashboardApiUnavailable = true;
  }
  return response;
};

export const updateInstitutionDashboard = async (
  institutionId: string,
  updates: Partial<InstitutionDashboardSchema>,
) => {
  return patchRequest(ROUTES.healthDashboard.institution(institutionId), updates);
};

export const ensureInstitutionDashboardExists = async (
  institutionId: string,
  type: HealthDashboardInstitutionType,
) => {
  if (healthDashboardApiUnavailable) {
    return {
      success: true,
      status: 200,
      data: buildInitialDashboardSchema({ institutionId, type }),
      message: 'Using local fallback dashboard schema.',
    };
  }
  const existing = await fetchInstitutionDashboard(institutionId);
  if (existing?.success) return existing;
  if (Number(existing?.status) === 404) {
    const created = await createInstitutionDashboard({ institutionId, type });
    if (Number(created?.status) === 404) {
      healthDashboardApiUnavailable = true;
      return {
        success: true,
        status: 200,
        data: buildInitialDashboardSchema({ institutionId, type }),
        message: 'Using local fallback dashboard schema.',
      };
    }
    return created;
  }
  return createInstitutionDashboard({ institutionId, type });
};

export const fetchInstitutionProfileEditor = async (institutionId: string) => {
  logHealthDashboard('fetchInstitutionProfileEditor:start', {
    institutionId,
    healthDashboardApiUnavailable,
  });
  if (healthDashboardApiUnavailable) {
    const draft = await readLocalProfileEditorDraft(institutionId);
    logHealthDashboard('fetchInstitutionProfileEditor:fallback-local', {
      institutionId,
      hasDraft: !!draft,
      draftKeys: draft ? Object.keys(draft).slice(0, 20) : [],
    });
    return { success: true, status: 200, data: { profile_editor: draft ?? {} } };
  }
  const response = await getRequest(ROUTES.healthDashboard.profileEditor(institutionId));
  logHealthDashboard('fetchInstitutionProfileEditor:api-response', {
    status: response?.status,
    success: response?.success,
    message: response?.message,
    dataKeys: response?.data && typeof response.data === 'object' ? Object.keys(response.data).slice(0, 20) : [],
  });
  if (Number(response?.status) === 404) {
    healthDashboardApiUnavailable = true;
    const draft = await readLocalProfileEditorDraft(institutionId);
    logHealthDashboard('fetchInstitutionProfileEditor:api-404-fallback-local', {
      institutionId,
      hasDraft: !!draft,
    });
    return { success: true, status: 200, data: { profile_editor: draft ?? {} } };
  }
  if (response?.success) {
    const { institution } = await getHealthInstitutionContext(institutionId);
    if (institution) {
      const localDraft = buildDraftFromInstitution(
        institution,
        (response?.data?.profile_editor ??
          response?.data?.draft ??
          response?.data ??
          {}) as Partial<InstitutionProfileEditorDraft>,
      );
      await writeProfileEditorCache(institutionId, localDraft);
      logHealthDashboard('fetchInstitutionProfileEditor:merged-with-institution', {
        institutionId,
        hasInstitution: true,
        draftHeroTitle: localDraft?.hero?.title,
      });
      return { success: true, status: 200, data: { profile_editor: localDraft } };
    }
    const apiDraft =
      (response?.data?.profile_editor ??
        response?.data?.draft ??
        response?.data ??
        null) as Partial<InstitutionProfileEditorDraft> | null;
    if (apiDraft) {
      await writeProfileEditorCache(institutionId, apiDraft);
      logHealthDashboard('fetchInstitutionProfileEditor:using-api-draft-directly', {
        institutionId,
        draftKeys: Object.keys(apiDraft).slice(0, 20),
      });
      return { success: true, status: Number(response?.status ?? 200), data: { profile_editor: apiDraft } };
    }
  }
  const cached = await readProfileEditorCache(institutionId);
  if (cached) {
    logHealthDashboard('fetchInstitutionProfileEditor:using-cached-draft', {
      institutionId,
      draftKeys: Object.keys(cached).slice(0, 20),
    });
    return { success: true, status: 200, data: { profile_editor: cached } };
  }
  logHealthDashboard('fetchInstitutionProfileEditor:returning-raw-response');
  return response;
};

export const updateInstitutionProfileEditor = async (
  institutionId: string,
  updates: Partial<InstitutionProfileEditorDraft>,
) => {
  logHealthDashboard('updateInstitutionProfileEditor:start', {
    institutionId,
    updateKeys: updates && typeof updates === 'object' ? Object.keys(updates).slice(0, 20) : [],
    healthDashboardApiUnavailable,
  });
  const existingCache = await readProfileEditorCache(institutionId);
  const nextCache = {
    ...(existingCache || {}),
    ...(updates || {}),
    hero: {
      ...(existingCache?.hero || {}),
      ...(updates?.hero || {}),
    },
    seo: {
      ...(existingCache?.seo || {}),
      ...(updates?.seo || {}),
    },
    contact: {
      ...(existingCache?.contact || {}),
      ...(updates?.contact || {}),
    },
    emergencyBanner: {
      ...(existingCache?.emergencyBanner || {}),
      ...(updates?.emergencyBanner || {}),
    },
    servicesVisibility: {
      ...(existingCache?.servicesVisibility || {}),
      ...(updates?.servicesVisibility || {}),
    },
  };
  await writeProfileEditorCache(institutionId, nextCache as Partial<InstitutionProfileEditorDraft>);

  if (healthDashboardApiUnavailable) {
    logHealthDashboard('updateInstitutionProfileEditor:fallback-local-write');
    return writeLocalProfileEditorDraft(institutionId, updates);
  }
  const response = await patchRequest(ROUTES.healthDashboard.profileEditor(institutionId), updates);
  logHealthDashboard('updateInstitutionProfileEditor:api-response', {
    status: response?.status,
    success: response?.success,
    message: response?.message,
  });
  if (Number(response?.status) === 404) {
    healthDashboardApiUnavailable = true;
    logHealthDashboard('updateInstitutionProfileEditor:api-404-fallback-local-write');
    return writeLocalProfileEditorDraft(institutionId, updates);
  }
  if (response?.success) {
    await writeProfileEditorCache(institutionId, nextCache as Partial<InstitutionProfileEditorDraft>);
  }
  return response;
};

export const fetchInstitutionAvailability = async (institutionId: string) => {
  if (healthDashboardApiUnavailable) {
    const draft = await readLocalAvailabilityDraft(institutionId);
    return { success: true, status: 200, data: draft };
  }
  const response = await getRequest(ROUTES.healthDashboard.availability(institutionId));
  if (Number(response?.status) === 404) {
    healthDashboardApiUnavailable = true;
    const draft = await readLocalAvailabilityDraft(institutionId);
    return { success: true, status: 200, data: draft };
  }
  return response;
};

export const updateInstitutionAvailability = async (institutionId: string, payload: Record<string, unknown>) => {
  if (healthDashboardApiUnavailable) {
    return writeLocalAvailabilityDraft(institutionId, payload);
  }
  const response = await patchRequest(ROUTES.healthDashboard.availability(institutionId), payload);
  if (Number(response?.status) === 404) {
    healthDashboardApiUnavailable = true;
    return writeLocalAvailabilityDraft(institutionId, payload);
  }
  return response;
};

export const uploadHealthDashboardImage = async (
  asset: Asset,
  context = 'health_dashboard',
) => {
  if (!asset?.uri) throw new Error('Image asset is missing URI.');
  if (Date.now() < uploadBlockedUntil) {
    throw new Error('Image uploads are temporarily rate-limited. Please wait and try again.');
  }
  const form = new FormData();
  form.append('attachment', {
    uri: asset.uri,
    name: asset.fileName || `image-${Date.now()}.jpg`,
    type: asset.type || 'image/jpeg',
  } as any);
  form.append('context', context);
  const res = await postRequest(ROUTES.broadcasts.profileAttachment, form);
  if (Number(res?.status) === 429) {
    uploadBlockedUntil = Date.now() + 60 * 1000;
  }
  if (!res?.success) throw new Error(res?.message || 'Unable to upload image.');
  return res.data?.attachment ?? null;
};

export type InstitutionDashboardAnalyticsResult = {
  analyticsHeader: InstitutionDashboardSchema['analyticsHeader'];
  analytics: InstitutionDashboardSchema['analytics'];
  insightPayload: InsightPayload;
};

export const fetchInstitutionDashboardAnalytics = async (
  institutionId: string,
  timeRange: TimeRange = '30d',
): Promise<InstitutionDashboardAnalyticsResult> => {
  const queryPayload = healthDashboardApiUnavailable
    ? {
        bookings: [],
        consultations: [],
        schedules: [],
        payments: [],
        ratings: [],
        traffic: { views: 0 },
      }
    : await fetchInstitutionAnalyticsQueryPayload(institutionId, timeRange);
  const aggregated = aggregateInstitutionAnalytics(queryPayload, timeRange);
  let analyticsHeader = aggregated.analyticsHeader;

  try {
    const availabilityRes = await fetchInstitutionAvailability(institutionId);
    const availabilityPayload = availabilityRes?.data?.availability ?? availabilityRes?.data ?? {};
    const calendarStatuses = readCalendarStatuses(availabilityPayload);
    if (Object.keys(calendarStatuses).length > 0) {
      const calendarTimes = readCalendarTimes(availabilityPayload);
      const scheduleSummary = deriveScheduleSummaryFromStatuses(calendarStatuses, calendarTimes);
      analyticsHeader = {
        ...aggregated.analyticsHeader,
        pendingSchedules: scheduleSummary.today,
        bookingsCount: scheduleSummary.upcoming,
        completedConsultations: scheduleSummary.past,
      };
    }
  } catch {
    analyticsHeader = aggregated.analyticsHeader;
  }

  return {
    analyticsHeader,
    analytics: aggregated.analytics,
    insightPayload: mapHealthDashboardAnalyticsToInsightPayload(
      analyticsHeader,
      aggregated.analytics,
    ),
  };
};
