import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  PanResponder,
  SafeAreaView,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import KISButton from '@/constants/KISButton';
import { KISIcon } from '@/constants/kisIcons';
import {
  getHealthThemeBorders,
  getHealthThemeColors,
  HEALTH_THEME_SPACING,
  HEALTH_THEME_TYPOGRAPHY,
} from '@/theme/health';
import {
  ensureInstitutionDashboardExists,
  fetchInstitutionAvailability,
  updateInstitutionAvailability,
} from '@/services/healthDashboardService';
import {
  runInAppNotificationTick,
  upsertAvailabilityReminders,
} from '@/services/inAppNotificationService';
import { getRequest } from '@/network/get';
import ROUTES from '@/network';
import { HEALTH_DASHBOARD_DEFAULT_SERVICES } from '@/features/health-dashboard/defaults';
import {
  HEALTH_DASHBOARD_INSTITUTION_TYPES,
  type ServiceDefinition,
  type HealthDashboardInstitutionType,
} from '@/features/health-dashboard/models';

const isSupportedType = (value: string): value is HealthDashboardInstitutionType =>
  HEALTH_DASHBOARD_INSTITUTION_TYPES.includes(value as HealthDashboardInstitutionType);

type CalendarViewMode = 'year' | 'month' | 'week';

type ServiceAvailability = {
  enabled: boolean;
  durationMin: number;
  slotGapMin: number;
};

type AvailabilityDraft = {
  timezone: string;
  serviceAvailability: Record<string, ServiceAvailability>;
  dayStatuses: Record<string, AvailabilityStatusKey>;
  dayTimes: Record<string, string>;
  dayServiceIds: Record<string, string[]>;
};

type AvailabilityStatusKey =
  | 'available'
  | 'limited'
  | 'fully_booked'
  | 'on_call'
  | 'holiday'
  | 'blocked';

const STATUS_OPTIONS: Array<{ key: AvailabilityStatusKey; label: string; description: string; color: string }> = [
  { key: 'available', label: 'Available', description: 'Open for booking', color: '#10B981' },
  { key: 'limited', label: 'Limited', description: 'Few slots available', color: '#F59E0B' },
  { key: 'fully_booked', label: 'Booked', description: 'No free slots', color: '#EF4444' },
  { key: 'on_call', label: 'On call', description: 'Available on request', color: '#3B82F6' },
  { key: 'holiday', label: 'Holiday', description: 'Closed for holiday', color: '#8B5CF6' },
  { key: 'blocked', label: 'Blocked', description: 'Unavailable / blocked', color: '#6B7280' },
];

const CLEAR_STATUS_KEY = 'clear';
const WEEKDAY_ORDER = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const TIME_STEP_MINUTES = 30;

const toDateOnlyIso = (date: Date) => {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const fromIso = (value: string) => {
  const [y, m, d] = String(value || '').split('-').map((part) => Number(part));
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
};

const isTimeValue = (value: unknown): value is string => /^\d{2}:\d{2}$/.test(String(value || ''));

const parseDateTime = (dateKey: string, time: string) => {
  const date = fromIso(dateKey);
  if (!date || !isTimeValue(time)) return null;
  const [hh, mm] = time.split(':').map((part) => Number(part));
  const parsed = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hh, mm, 0, 0);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const buildCountdownLabel = (dateKey: string, time: string, nowMs: number): string | null => {
  const target = parseDateTime(dateKey, time);
  if (!target) return null;
  const diff = target.getTime() - nowMs;
  if (diff <= 0) return null;
  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / (24 * 60 * 60));
  const hours = Math.floor((totalSeconds % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((totalSeconds % (60 * 60)) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) {
    return `${days}d ${hours}h ${seconds}s`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  return `${minutes}m ${seconds}s`;
};

const buildDateTimesFromPayload = (raw: any, year: number): Record<string, string> => {
  const source =
    raw?.calendar_times ??
    raw?.calendarTimes ??
    raw?.date_times ??
    raw?.dateTimes ??
    {};
  if (!source || typeof source !== 'object') return {};

  const map: Record<string, string> = {};
  Object.entries(source).forEach(([dateKey, value]) => {
    const date = fromIso(dateKey);
    if (!date || date.getFullYear() !== year) return;
    if (!isTimeValue(value)) return;
    map[toDateOnlyIso(date)] = value;
  });
  return map;
};

const normalizeServiceRow = (raw: any, index: number): ServiceDefinition | null => {
  if (!raw || typeof raw !== 'object') return null;
  const id = String(raw.id ?? raw.service_id ?? raw.key ?? `service_${index + 1}`).trim();
  const name = String(raw.name ?? raw.title ?? raw.label ?? '').trim();
  if (!name) return null;
  const description = String(raw.description ?? raw.summary ?? '').trim();
  return {
    id,
    name,
    description,
    active: raw.active !== false,
    basePriceCents: Number.isFinite(Number(raw.basePriceCents))
      ? Number(raw.basePriceCents)
      : Number.isFinite(Number(raw.base_price_cents))
      ? Number(raw.base_price_cents)
      : undefined,
  };
};

const prettifyServiceId = (value: string) =>
  String(value || '')
    .trim()
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
    .trim();

const buildDateServiceIdsFromPayload = (raw: any, year: number): Record<string, string[]> => {
  const source =
    raw?.calendar_service_ids ??
    raw?.calendarServiceIds ??
    raw?.date_service_ids ??
    raw?.dateServiceIds ??
    {};
  if (!source || typeof source !== 'object') return {};
  const map: Record<string, string[]> = {};
  Object.entries(source).forEach(([dateKey, value]) => {
    const date = fromIso(dateKey);
    if (!date || date.getFullYear() !== year) return;
    if (!Array.isArray(value)) return;
    const ids = value.map((item) => String(item || '').trim()).filter(Boolean);
    if (!ids.length) return;
    map[toDateOnlyIso(date)] = Array.from(new Set(ids));
  });
  return map;
};

const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
const endOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0);
const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
const addMonths = (date: Date, months: number) => new Date(date.getFullYear(), date.getMonth() + months, 1);

const getMonthGrid = (date: Date) => {
  const first = startOfMonth(date);
  const firstWeekday = first.getDay();
  const cursor = addDays(first, -firstWeekday);
  const weeks: Date[][] = [];
  for (let row = 0; row < 6; row += 1) {
    const week: Date[] = [];
    for (let col = 0; col < 7; col += 1) {
      week.push(addDays(cursor, row * 7 + col));
    }
    weeks.push(week);
  }
  return weeks;
};

const getWeekGrid = (date: Date) => {
  const start = addDays(date, -date.getDay());
  return [Array.from({ length: 7 }, (_, idx) => addDays(start, idx))];
};

const buildDateStatusesFromLegacy = (raw: any, year: number): Record<string, AvailabilityStatusKey> => {
  const statuses: Record<string, AvailabilityStatusKey> = {};

  const explicit = raw?.calendar_statuses || raw?.calendarStatuses || raw?.date_statuses || raw?.dateStatuses;
  if (explicit && typeof explicit === 'object') {
    Object.entries(explicit).forEach(([date, status]) => {
      const d = fromIso(date);
      if (!d || d.getFullYear() !== year) return;
      const found = STATUS_OPTIONS.find((option) => option.key === String(status));
      if (found) statuses[toDateOnlyIso(d)] = found.key;
    });
    if (Object.keys(statuses).length > 0) return statuses;
  }

  const slots = Array.isArray(raw?.slots) ? raw.slots : [];
  const recurringRules = Array.isArray(raw?.recurringRules)
    ? raw.recurringRules
    : Array.isArray(raw?.recurring_rules)
    ? raw.recurring_rules
    : [];
  const blockedTimes = Array.isArray(raw?.blockedTimes)
    ? raw.blockedTimes
    : Array.isArray(raw?.blocked_times)
    ? raw.blocked_times
    : [];

  for (let month = 0; month < 12; month += 1) {
    const monthDate = new Date(year, month, 1);
    const last = endOfMonth(monthDate).getDate();
    for (let day = 1; day <= last; day += 1) {
      const date = new Date(year, month, day);
      const dateIso = toDateOnlyIso(date);
      const weekday = WEEKDAY_ORDER[date.getDay()];

      const hasRecurring = recurringRules.some((rule: any) => {
        const dayKey = String(rule?.day || '').toLowerCase();
        const frequency = String(rule?.frequency || '').toLowerCase();
        if (frequency === 'daily') return true;
        if (frequency === 'weekly' || !frequency) return dayKey === weekday;
        if (frequency === 'monthly') return dayKey === weekday;
        return false;
      });

      const hasSlot = slots.some((slot: any) => String(slot?.day || '').toLowerCase() === weekday);
      if (hasRecurring || hasSlot) {
        statuses[dateIso] = 'available';
      }
    }
  }

  blockedTimes.forEach((block: any) => {
    const date = fromIso(String(block?.date || ''));
    if (!date || date.getFullYear() !== year) return;
    statuses[toDateOnlyIso(date)] = 'blocked';
  });

  return statuses;
};

const defaultServiceAvailability = (institutionType: HealthDashboardInstitutionType) =>
  Object.fromEntries(
    HEALTH_DASHBOARD_DEFAULT_SERVICES[institutionType].map((service) => [
      service.id,
      {
        enabled: true,
        durationMin: 30,
        slotGapMin: 10,
      },
    ]),
  );

const createDefaultDraft = (institutionType: HealthDashboardInstitutionType): AvailabilityDraft => ({
  timezone: 'UTC',
  serviceAvailability: defaultServiceAvailability(institutionType),
  dayStatuses: {},
  dayTimes: {},
  dayServiceIds: {},
});

export default function AvailabilityManagementScreen({ navigation, route }: any) {
  const institutionId = route?.params?.institutionId as string | undefined;
  const institutionType = route?.params?.institutionType as string | undefined;

  const scheme = useColorScheme();
  const palette = getHealthThemeColors(scheme === 'light' ? 'light' : 'dark');
  const borders = getHealthThemeBorders(palette);
  const spacing = HEALTH_THEME_SPACING;
  const typography = HEALTH_THEME_TYPOGRAPHY;

  const dashboardType = useMemo(() => {
    if (!isSupportedType(String(institutionType ?? ''))) return null;
    return institutionType as HealthDashboardInstitutionType;
  }, [institutionType]);

  const calendarYear = useMemo(() => new Date().getFullYear(), []);
  const todayStart = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<AvailabilityDraft | null>(null);
  const [calendarMode, setCalendarMode] = useState<CalendarViewMode>('month');
  const [anchorDate, setAnchorDate] = useState(new Date(calendarYear, new Date().getMonth(), new Date().getDate()));
  const [selectedStatus, setSelectedStatus] = useState<AvailabilityStatusKey | typeof CLEAR_STATUS_KEY>('available');
  const [activeDateKey, setActiveDateKey] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [servicesCatalog, setServicesCatalog] = useState<ServiceDefinition[]>([]);
  const dayCellLayoutsRef = useRef<Record<string, { x: number; y: number; width: number; height: number }>>({});
  const dayRowLayoutsRef = useRef<Record<string, { x: number; y: number }>>({});
  const paintedDateKeysRef = useRef<Set<string>>(new Set());

  const loadAvailability = useCallback(async () => {
    if (!institutionId || !dashboardType) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const fallback = createDefaultDraft(dashboardType);
      const bootstrap = await ensureInstitutionDashboardExists(institutionId, dashboardType);
      if (!bootstrap?.success) {
        throw new Error(bootstrap?.message || 'Unable to initialize institution dashboard.');
      }

      const res = await fetchInstitutionAvailability(institutionId);
      if (!res?.success && Number(res?.status) !== 404) {
        throw new Error(res?.message || 'Unable to load availability data.');
      }

      const payload = res?.data ?? res ?? {};
      const data = payload?.availability ?? payload?.draft ?? payload;
      const cardsResponse = await getRequest(ROUTES.broadcasts.healthCards(institutionId), {
        errorMessage: 'Unable to load backend health cards.',
      });
      const backendCards = cardsResponse?.success && Array.isArray(cardsResponse?.data?.cards)
        ? cardsResponse.data.cards
        : [];
      const backendServices = backendCards
        .map((card: any, index: number) => normalizeServiceRow(card?.service, index))
        .filter(Boolean) as ServiceDefinition[];
      const fallbackServices = HEALTH_DASHBOARD_DEFAULT_SERVICES[dashboardType];
      const scheduledServiceIdsByDate = buildDateServiceIdsFromPayload(data || {}, calendarYear);
      const scheduleLinkedServiceIds = new Set(
        Object.values(scheduledServiceIdsByDate).flatMap((ids) => ids.map((item) => String(item || '').trim()).filter(Boolean)),
      );
      const serviceAvailability = data?.serviceAvailability || data?.service_availability || {};
      if (serviceAvailability && typeof serviceAvailability === 'object' && !Array.isArray(serviceAvailability)) {
        Object.keys(serviceAvailability).forEach((serviceId) => {
          const normalized = String(serviceId || '').trim();
          if (normalized) scheduleLinkedServiceIds.add(normalized);
        });
      }

      const catalogSeed = backendServices.length > 0 ? backendServices : fallbackServices;
      const catalogMap = new Map<string, ServiceDefinition>();
      catalogSeed.forEach((service) => {
        const serviceId = String(service?.id || '').trim();
        if (!serviceId) return;
        catalogMap.set(serviceId, service);
      });
      scheduleLinkedServiceIds.forEach((serviceId) => {
        if (catalogMap.has(serviceId)) return;
        catalogMap.set(serviceId, {
          id: serviceId,
          name: prettifyServiceId(serviceId) || 'Health Service',
          description: '',
          active: true,
        });
      });

      const catalog = Array.from(catalogMap.values());
      const activeServiceIdSet = new Set(
        catalog
          .filter((service) => service.active !== false)
          .map((service) => String(service.id)),
      );

      const merged: AvailabilityDraft = {
        ...fallback,
        ...(data || {}),
        serviceAvailability: {
          ...fallback.serviceAvailability,
          ...(data?.serviceAvailability || data?.service_availability || {}),
        },
        dayStatuses: buildDateStatusesFromLegacy(data || {}, calendarYear),
        dayTimes: buildDateTimesFromPayload(data || {}, calendarYear),
        dayServiceIds: Object.fromEntries(
          Object.entries(scheduledServiceIdsByDate).map(([dateKey, ids]) => {
            const filtered = ids.filter((id) => activeServiceIdSet.has(id));
            return [dateKey, filtered.length > 0 ? filtered : ids];
          }),
        ),
      };

      setServicesCatalog(catalog);
      setDraft(merged);
    } catch (error: any) {
      Alert.alert('Availability', error?.message || 'Unable to load availability data.');
      setServicesCatalog(HEALTH_DASHBOARD_DEFAULT_SERVICES[dashboardType]);
      setDraft(createDefaultDraft(dashboardType));
    } finally {
      setLoading(false);
    }
  }, [calendarYear, dashboardType, institutionId]);

  useEffect(() => {
    void loadAvailability();
  }, [loadAvailability]);

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const updateDraft = useCallback((updater: (prev: AvailabilityDraft) => AvailabilityDraft) => {
    setDraft((prev) => {
      if (!prev) return prev;
      return updater(prev);
    });
  }, []);

  const applyStatusToDateKey = useCallback(
    (dateKey: string, toggleIfSame = false) => {
      if (!draft) return;
      const date = fromIso(dateKey);
      if (!date || date.getFullYear() !== calendarYear) return;
      if (date < todayStart) return;
      updateDraft((prev) => {
        const nextMap = { ...(prev.dayStatuses || {}) };
        const nextTimes = { ...(prev.dayTimes || {}) };
        const nextServiceIds = { ...(prev.dayServiceIds || {}) };
        const currentStatus = nextMap[dateKey];
        if (selectedStatus === CLEAR_STATUS_KEY) {
          delete nextMap[dateKey];
          delete nextTimes[dateKey];
          delete nextServiceIds[dateKey];
        } else if (toggleIfSame && currentStatus === selectedStatus) {
          delete nextMap[dateKey];
          delete nextTimes[dateKey];
          delete nextServiceIds[dateKey];
        } else {
          nextMap[dateKey] = selectedStatus;
        }
        return { ...prev, dayStatuses: nextMap, dayTimes: nextTimes, dayServiceIds: nextServiceIds };
      });
    },
    [calendarYear, draft, selectedStatus, todayStart, updateDraft],
  );

  const handleDayPress = useCallback(
    (date: Date) => {
      const dateKey = toDateOnlyIso(date);
      setActiveDateKey(dateKey);
      if (date.getFullYear() !== calendarYear || date < todayStart) return;
      const existingStatus = draft?.dayStatuses?.[dateKey];
      if (selectedStatus === CLEAR_STATUS_KEY) {
        if (existingStatus) {
          applyStatusToDateKey(dateKey);
        }
        return;
      }
      if (existingStatus) {
        return;
      }
      applyStatusToDateKey(dateKey);
    },
    [applyStatusToDateKey, calendarYear, draft?.dayStatuses, selectedStatus, todayStart],
  );

  const hitTestDateKey = useCallback((x: number, y: number) => {
    const entries = Object.entries(dayCellLayoutsRef.current);
    for (let i = 0; i < entries.length; i += 1) {
      const [dateKey, layout] = entries[i];
      if (x >= layout.x && x <= layout.x + layout.width && y >= layout.y && y <= layout.y + layout.height) {
        return dateKey;
      }
    }
    return null;
  }, []);

  const paintAtPoint = useCallback(
    (x: number, y: number) => {
      const dateKey = hitTestDateKey(x, y);
      if (!dateKey || paintedDateKeysRef.current.has(dateKey)) return;
      paintedDateKeysRef.current.add(dateKey);
      applyStatusToDateKey(dateKey);
    },
    [applyStatusToDateKey, hitTestDateKey],
  );

  const calendarPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => {
          paintedDateKeysRef.current.clear();
          paintAtPoint(event.nativeEvent.locationX, event.nativeEvent.locationY);
        },
        onPanResponderMove: (event) => {
          paintAtPoint(event.nativeEvent.locationX, event.nativeEvent.locationY);
        },
        onPanResponderRelease: () => {
          paintedDateKeysRef.current.clear();
        },
        onPanResponderTerminate: () => {
          paintedDateKeysRef.current.clear();
        },
      }),
    [paintAtPoint],
  );

  useEffect(() => {
    dayCellLayoutsRef.current = {};
    dayRowLayoutsRef.current = {};
    paintedDateKeysRef.current.clear();
  }, [anchorDate, calendarMode, calendarYear]);

  const goPrevious = useCallback(() => {
    if (calendarMode === 'month') {
      setAnchorDate((prev) => {
        const next = addMonths(prev, -1);
        return next.getFullYear() < calendarYear ? new Date(calendarYear, 0, 1) : next;
      });
      return;
    }
    if (calendarMode === 'week') {
      setAnchorDate((prev) => {
        const next = addDays(prev, -7);
        return next.getFullYear() < calendarYear ? new Date(calendarYear, 0, 1) : next;
      });
    }
  }, [calendarMode, calendarYear]);

  const goNext = useCallback(() => {
    if (calendarMode === 'month') {
      setAnchorDate((prev) => {
        const next = addMonths(prev, 1);
        return next.getFullYear() > calendarYear ? new Date(calendarYear, 11, 31) : next;
      });
      return;
    }
    if (calendarMode === 'week') {
      setAnchorDate((prev) => {
        const next = addDays(prev, 7);
        return next.getFullYear() > calendarYear ? new Date(calendarYear, 11, 31) : next;
      });
    }
  }, [calendarMode, calendarYear]);

  const saveAvailability = useCallback(async () => {
    if (!institutionId || !draft) return;

    setSaving(true);
    try {
      const serviceRequiredStatuses = new Set<AvailabilityStatusKey>(['available', 'limited', 'on_call']);
      const scheduledDates = Object.keys(draft.dayStatuses || {});
      const selectedServiceIds = new Set<string>();
      scheduledDates.forEach((dateKey) => {
        const ids = Array.isArray(draft.dayServiceIds?.[dateKey]) ? draft.dayServiceIds[dateKey] : [];
        ids
          .map((item) => String(item || '').trim())
          .filter(Boolean)
          .forEach((serviceId) => selectedServiceIds.add(serviceId));
      });
      if (scheduledDates.length > 0 && selectedServiceIds.size === 0) {
        throw new Error('Add at least one service before saving schedule.');
      }
      const datesWithoutServices = scheduledDates.filter((dateKey) => {
        const status = draft.dayStatuses?.[dateKey];
        if (!status || !serviceRequiredStatuses.has(status)) return false;
        return !Array.isArray(draft.dayServiceIds?.[dateKey]) || draft.dayServiceIds[dateKey].length === 0;
      });
      if (datesWithoutServices.length > 0) {
        const sample = datesWithoutServices.slice(0, 3).join(', ');
        const suffix = datesWithoutServices.length > 3 ? '...' : '';
        throw new Error(`Add at least one service for: ${sample}${suffix}`);
      }

      const blockedStatuses = new Set<AvailabilityStatusKey>(['blocked', 'holiday', 'fully_booked']);

      const blockedTimes = Object.entries(draft.dayStatuses)
        .filter(([, status]) => blockedStatuses.has(status))
        .map(([date, status]) => ({
          id: `blocked-${date}`,
          date,
          start: '00:00',
          end: '23:59',
          reason: STATUS_OPTIONS.find((option) => option.key === status)?.label || 'Blocked',
        }));

      const payload = {
        timezone: draft.timezone,
        calendar_statuses: draft.dayStatuses,
        calendar_times: draft.dayTimes,
        calendar_service_ids: draft.dayServiceIds,
        blocked_times: blockedTimes,
        slots: [],
        recurring_rules: [],
        service_availability: draft.serviceAvailability,
      };

      const res = await updateInstitutionAvailability(institutionId, payload);
      if (!res?.success) throw new Error(res?.message || 'Unable to save availability settings.');
      await upsertAvailabilityReminders(institutionId, draft.dayTimes);
      await runInAppNotificationTick();
      Alert.alert('Availability', 'Calendar availability saved.');
    } catch (error: any) {
      Alert.alert('Availability', error?.message || 'Unable to save availability settings.');
    } finally {
      setSaving(false);
    }
  }, [draft, institutionId]);

  const renderDayCell = useCallback(
    (date: Date, compact = false, rowLayoutKey?: string) => {
      const dateKey = toDateOnlyIso(date);
      const statusKey = draft?.dayStatuses?.[dateKey];
      const statusMeta = STATUS_OPTIONS.find((option) => option.key === statusKey);
      const selectedTime = draft?.dayTimes?.[dateKey];
      const selectedServicesCount = draft?.dayServiceIds?.[dateKey]?.length ?? 0;
      const countdownLabel = selectedTime ? buildCountdownLabel(dateKey, selectedTime, nowMs) : null;
      const inYear = date.getFullYear() === calendarYear;
      const isPastDate = date < todayStart;
      const isSelectable = inYear && !isPastDate;
      const inMonth = date.getMonth() === anchorDate.getMonth();
      const isActive = activeDateKey === dateKey;

      const baseBg = statusMeta ? `${statusMeta.color}33` : palette.surface;
      const border = statusMeta ? statusMeta.color : palette.divider;
      const textColor = !isSelectable ? palette.subtext : inMonth ? palette.text : palette.subtext;

      return (
        <TouchableOpacity
          key={dateKey}
          onPress={() => handleDayPress(date)}
          disabled={!isSelectable}
          onLayout={
            compact
              ? undefined
              : (event) => {
                  const rowLayout = rowLayoutKey ? dayRowLayoutsRef.current[rowLayoutKey] : undefined;
                  const layout = event.nativeEvent.layout;
                  dayCellLayoutsRef.current[dateKey] = {
                    x: (rowLayout?.x || 0) + layout.x,
                    y: (rowLayout?.y || 0) + layout.y,
                    width: layout.width,
                    height: layout.height,
                  };
                }
          }
          style={{
            width: compact ? 20 : 42,
            height: compact ? 20 : 42,
            borderRadius: compact ? 6 : 10,
            borderWidth: 1,
            borderColor: isActive ? palette.accentPrimary : border,
            backgroundColor: inYear ? baseBg : palette.background,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: isSelectable ? 1 : 0.3,
          }}
        >
          <View style={{ alignItems: 'center', justifyContent: 'center', width: '100%' }}>
            <Text style={{ ...typography.caption, color: textColor }}>{date.getDate()}</Text>
            {countdownLabel && !compact ? (
              <View
                style={{
                  marginTop: 1,
                  minWidth: 22,
                  maxWidth: 40,
                  paddingHorizontal: 3,
                  paddingVertical: 1,
                  borderRadius: 6,
                  backgroundColor: palette.accentPrimary,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.6}
                  style={{
                    fontSize: 9,
                    lineHeight: 9,
                    color: '#FFFFFF',
                    textAlign: 'center',
                    marginTop: -1,
                    includeFontPadding: false,
                    fontWeight: '700',
                  }}
                >
                  {countdownLabel}
                </Text>
              </View>
            ) : null}
            {selectedServicesCount > 0 && !compact ? (
              <Text style={{ fontSize: 8, color: palette.text }}>{selectedServicesCount} svc</Text>
            ) : null}
          </View>
        </TouchableOpacity>
      );
    },
    [activeDateKey, anchorDate, calendarYear, draft?.dayServiceIds, draft?.dayStatuses, draft?.dayTimes, handleDayPress, nowMs, palette.accentPrimary, palette.background, palette.divider, palette.subtext, palette.surface, palette.text, todayStart, typography.caption],
  );

  const weekGrid = useMemo(() => getWeekGrid(anchorDate), [anchorDate]);

  const renderMonthCalendar = useCallback(
    (date: Date, compact = false) => {
      const grid = getMonthGrid(date);
      return (
        <View style={{ gap: compact ? 4 : spacing.xs }}>
          {!compact ? (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 2 }}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, idx) => (
                <Text key={`${date.getMonth()}-${idx}-${d}`} style={{ ...typography.caption, color: palette.subtext, width: 42, textAlign: 'center' }}>
                  {d}
                </Text>
              ))}
            </View>
          ) : null}
          {grid.map((week, rowIndex) => {
            const rowLayoutKey = `month-${date.getFullYear()}-${date.getMonth()}-${rowIndex}`;
            return (
              <View
                key={`week-${date.getMonth()}-${rowIndex}`}
                style={{ flexDirection: 'row', gap: compact ? 2 : spacing.xs }}
                onLayout={
                  compact
                    ? undefined
                    : (event) => {
                        dayRowLayoutsRef.current[rowLayoutKey] = event.nativeEvent.layout;
                      }
                }
              >
                {week.map((day) => renderDayCell(day, compact, rowLayoutKey))}
              </View>
            );
          })}
        </View>
      );
    },
    [palette.subtext, renderDayCell, spacing.xs, typography.caption],
  );

  const activeDate = activeDateKey ? fromIso(activeDateKey) : null;
  const activeDateStatus = activeDateKey ? draft?.dayStatuses?.[activeDateKey] : undefined;
  const activeDateTime = activeDateKey ? draft?.dayTimes?.[activeDateKey] : undefined;
  const activeDateServiceIds = activeDateKey ? draft?.dayServiceIds?.[activeDateKey] || [] : [];
  const activeServices = useMemo(
    () => servicesCatalog.filter((service) => service.active !== false),
    [servicesCatalog],
  );

  const timeOptions = useMemo(() => {
    if (!activeDate || !activeDateKey) return [];
    const now = new Date(nowMs);
    const options: string[] = [];
    for (let hour = 0; hour < 24; hour += 1) {
      for (let minute = 0; minute < 60; minute += TIME_STEP_MINUTES) {
        const hh = `${hour}`.padStart(2, '0');
        const mm = `${minute}`.padStart(2, '0');
        const timeValue = `${hh}:${mm}`;
        const candidate = parseDateTime(activeDateKey, timeValue);
        if (!candidate) continue;
        if (candidate <= now) continue;
        options.push(timeValue);
      }
    }
    return options;
  }, [activeDate, activeDateKey, nowMs]);

  const setActiveDayTime = useCallback(
    (time: string | null) => {
      if (!activeDateKey) return;
      updateDraft((prev) => {
        const nextTimes = { ...(prev.dayTimes || {}) };
        if (!time) {
          delete nextTimes[activeDateKey];
        } else {
          nextTimes[activeDateKey] = time;
        }
        return { ...prev, dayTimes: nextTimes };
      });
    },
    [activeDateKey, updateDraft],
  );

  const toggleActiveDayServiceId = useCallback(
    (serviceId: string) => {
      if (!activeDateKey) return;
      updateDraft((prev) => {
        const current = Array.isArray(prev.dayServiceIds?.[activeDateKey])
          ? prev.dayServiceIds[activeDateKey]
          : [];
        const exists = current.includes(serviceId);
        const next = exists ? current.filter((id) => id !== serviceId) : [...current, serviceId];
        return {
          ...prev,
          dayServiceIds: {
            ...(prev.dayServiceIds || {}),
            [activeDateKey]: next,
          },
        };
      });
    },
    [activeDateKey, updateDraft],
  );

  if (!dashboardType) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }}>
        <LinearGradient colors={[palette.gradientStart, palette.gradientEnd]} style={{ flex: 1, padding: spacing.lg }}>
          <View style={{ alignItems: 'flex-end' }}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={{ borderWidth: 1, borderColor: palette.divider, borderRadius: 12, padding: spacing.xs, backgroundColor: palette.card }}
              accessibilityLabel="Close availability"
            >
              <KISIcon name="close" size={18} color={palette.text} />
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <Text style={{ ...typography.h2, color: palette.text }}>Unsupported Institution Type</Text>
            <Text style={{ ...typography.body, color: palette.subtext, marginTop: spacing.sm }}>
              Availability management supports only clinic, hospital, lab, diagnostics, pharmacy, and wellness center.
            </Text>
            <View style={{ marginTop: spacing.lg }}>
              <KISButton title="Back to dashboard" onPress={() => navigation.goBack()} />
            </View>
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  if (loading || !draft) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }}>
        <LinearGradient colors={[palette.gradientStart, palette.gradientEnd]} style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={palette.accentPrimary} />
          <Text style={{ ...typography.body, color: palette.subtext, marginTop: spacing.sm }}>Loading availability...</Text>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }}>
      <LinearGradient colors={[palette.gradientStart, palette.gradientEnd]} style={{ flex: 1 }}>
        <View style={{ alignItems: 'flex-end', paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{ borderWidth: 1, borderColor: palette.divider, borderRadius: 12, padding: spacing.xs, backgroundColor: palette.card }}
            accessibilityLabel="Close availability"
          >
            <KISIcon name="close" size={18} color={palette.text} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl }}>
          <View style={{ borderRadius: spacing.lg, padding: spacing.md, backgroundColor: palette.card, ...borders.card }}>
            <Text style={{ ...typography.h2, color: palette.text }}>Scheduling & Availability</Text>
            <Text style={{ ...typography.body, color: palette.subtext, marginTop: spacing.xs }}>
              Tap a color, then tap dates on the calendar. Switch between year, month, and week views.
            </Text>

            <View style={{ marginTop: spacing.md, flexDirection: 'row', gap: spacing.xs }}>
              {(['year', 'month', 'week'] as CalendarViewMode[]).map((mode) => (
                <TouchableOpacity
                  key={mode}
                  onPress={() => setCalendarMode(mode)}
                  style={{
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: calendarMode === mode ? palette.accentPrimary : palette.divider,
                    backgroundColor: calendarMode === mode ? `${palette.accentPrimary}22` : palette.surface,
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.xs,
                  }}
                >
                  <Text style={{ ...typography.label, color: palette.text }}>{mode.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {calendarMode !== 'year' ? (
              <View style={{ marginTop: spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <TouchableOpacity onPress={goPrevious} style={{ padding: spacing.xs }}>
                  <KISIcon name="chevron-left" size={18} color={palette.text} />
                </TouchableOpacity>
                <Text style={{ ...typography.label, color: palette.text }}>
                  {MONTH_LABELS[anchorDate.getMonth()]} {anchorDate.getFullYear()}
                </Text>
                <TouchableOpacity onPress={goNext} style={{ padding: spacing.xs }}>
                  <KISIcon name="chevron-right" size={18} color={palette.text} />
                </TouchableOpacity>
              </View>
            ) : null}

            <View style={{ marginTop: spacing.sm, borderWidth: 1, borderColor: palette.divider, borderRadius: spacing.md, padding: spacing.sm, backgroundColor: palette.surface }}>
              {calendarMode === 'year' ? (
                <View style={{ gap: spacing.sm }}>
                  <Text style={{ ...typography.label, color: palette.text }}>{calendarYear}</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: spacing.sm }}>
                    {Array.from({ length: 12 }, (_, month) => {
                      const monthDate = new Date(calendarYear, month, 1);
                      return (
                        <TouchableOpacity
                          key={`month-${month}`}
                          onPress={() => {
                            setAnchorDate(monthDate);
                            setCalendarMode('month');
                          }}
                          style={{
                            width: '48%',
                            borderWidth: 1,
                            borderColor: palette.divider,
                            borderRadius: spacing.sm,
                            padding: spacing.xs,
                            backgroundColor: palette.card,
                          }}
                        >
                          <Text style={{ ...typography.caption, color: palette.text, marginBottom: 4 }}>{MONTH_LABELS[month]}</Text>
                          {renderMonthCalendar(monthDate, true)}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ) : calendarMode === 'month' ? (
                <View {...calendarPanResponder.panHandlers}>{renderMonthCalendar(anchorDate)}</View>
              ) : (
                <View style={{ gap: spacing.xs }} {...calendarPanResponder.panHandlers}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 2 }}>
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, idx) => (
                      <Text key={`week-${idx}-${d}`} style={{ ...typography.caption, color: palette.subtext, width: 42, textAlign: 'center' }}>
                        {d}
                      </Text>
                    ))}
                  </View>
                  {weekGrid.map((week, rowIndex) => (
                    <View
                      key={`week-row-${rowIndex}`}
                      style={{ flexDirection: 'row', gap: spacing.xs }}
                      onLayout={(event) => {
                        dayRowLayoutsRef.current[`week-${rowIndex}`] = event.nativeEvent.layout;
                      }}
                    >
                      {week.map((day) => renderDayCell(day, false, `week-${rowIndex}`))}
                    </View>
                  ))}
                </View>
              )}
            </View>

            {activeDateKey ? (
              <View
                style={{
                  marginTop: spacing.sm,
                  borderWidth: 1,
                  borderColor: palette.divider,
                  borderRadius: spacing.md,
                  backgroundColor: palette.surface,
                  overflow: 'hidden',
                }}
              >
                <View style={{ padding: spacing.sm }}>
                  <Text style={{ ...typography.label, color: palette.text }}>
                    Schedule Details ({activeDateKey})
                  </Text>
                  <Text style={{ ...typography.caption, color: palette.subtext, marginTop: 2 }}>
                    Tap again to edit status, services, and time for this date.
                  </Text>
                </View>
                {activeDateStatus ? (
                  <View style={{ paddingHorizontal: spacing.sm, paddingBottom: spacing.sm }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs }}>
                      <Text style={{ ...typography.caption, color: palette.subtext }}>Status:</Text>
                      <Text style={{ ...typography.caption, color: palette.text, marginLeft: 6 }}>
                        {STATUS_OPTIONS.find((option) => option.key === activeDateStatus)?.label || activeDateStatus}
                      </Text>
                    </View>

                    <Text style={{ ...typography.caption, color: palette.subtext, marginBottom: 6 }}>
                      Services (select one or more)
                    </Text>
                    {activeServices.length ? (
                      <View style={{ gap: spacing.xs }}>
                        {activeServices.map((service) => {
                          const selected = activeDateServiceIds.includes(service.id);
                          return (
                            <TouchableOpacity
                              key={`${activeDateKey}-svc-${service.id}`}
                              onPress={() => toggleActiveDayServiceId(service.id)}
                              style={{
                                borderRadius: spacing.sm,
                                borderWidth: 1,
                                borderColor: selected ? palette.accentPrimary : palette.divider,
                                backgroundColor: selected ? `${palette.accentPrimary}22` : palette.card,
                                paddingHorizontal: spacing.sm,
                                paddingVertical: spacing.xs,
                                flexDirection: 'row',
                                alignItems: 'center',
                              }}
                            >
                              <View
                                style={{
                                  width: 18,
                                  height: 18,
                                  borderRadius: 4,
                                  borderWidth: 1,
                                  borderColor: selected ? palette.accentPrimary : palette.divider,
                                  backgroundColor: selected ? palette.accentPrimary : 'transparent',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  marginRight: spacing.xs,
                                }}
                              >
                                {selected ? <Text style={{ color: '#fff', fontSize: 11 }}>✓</Text> : null}
                              </View>
                              <Text style={{ ...typography.caption, color: palette.text, flex: 1 }}>{service.name}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    ) : (
                      <Text style={{ ...typography.caption, color: palette.subtext }}>
                        No active services. Activate at least one service in Service Catalog.
                      </Text>
                    )}

                    <Text style={{ ...typography.caption, color: palette.subtext, marginTop: spacing.sm, marginBottom: 6 }}>
                      Time (30-minute slots)
                    </Text>
                    {timeOptions.length ? (
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                        {timeOptions.map((option) => {
                          const selected = option === activeDateTime;
                          return (
                            <TouchableOpacity
                              key={`${activeDateKey}-${option}`}
                              onPress={() => setActiveDayTime(option)}
                              style={{
                                borderRadius: 999,
                                borderWidth: 1,
                                borderColor: selected ? palette.accentPrimary : palette.divider,
                                backgroundColor: selected ? `${palette.accentPrimary}22` : palette.card,
                                paddingHorizontal: spacing.sm,
                                paddingVertical: 6,
                              }}
                            >
                              <Text style={{ ...typography.caption, color: palette.text }}>{option}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    ) : (
                      <Text style={{ ...typography.caption, color: palette.subtext }}>
                        No remaining time slots for this date.
                      </Text>
                    )}

                    <Text style={{ ...typography.caption, color: palette.subtext, marginTop: spacing.sm }}>
                      Selected: {activeDateServiceIds.length} service(s){activeDateTime ? ` • ${activeDateTime}` : ''}
                    </Text>
                    {activeDateTime ? (
                      <View style={{ marginTop: spacing.xs }}>
                        <KISButton title="Clear selected time" size="sm" variant="outline" onPress={() => setActiveDayTime(null)} />
                      </View>
                    ) : null}
                  </View>
                ) : (
                  <View style={{ paddingHorizontal: spacing.sm, paddingBottom: spacing.sm }}>
                    <Text style={{ ...typography.caption, color: palette.subtext }}>
                      Select a day status first, then choose a time.
                    </Text>
                  </View>
                )}
              </View>
            ) : null}

            <Text style={{ ...typography.h3, color: palette.text, marginTop: spacing.md }}>Day Status Color Legend</Text>
            <View style={{ marginTop: spacing.xs, gap: spacing.xs }}>
              {STATUS_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.key}
                  onPress={() => setSelectedStatus(option.key)}
                  style={{
                    borderRadius: spacing.sm,
                    borderWidth: 1,
                    borderColor: selectedStatus === option.key ? option.color : palette.divider,
                    backgroundColor: selectedStatus === option.key ? `${option.color}22` : palette.surface,
                    padding: spacing.sm,
                    flexDirection: 'row',
                    alignItems: 'center',
                  }}
                >
                  <View
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 999,
                      backgroundColor: option.color,
                      marginRight: spacing.sm,
                    }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={{ ...typography.label, color: palette.text }}>{option.label}</Text>
                    <Text style={{ ...typography.caption, color: palette.subtext }}>{option.description}</Text>
                  </View>
                  <View
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 999,
                      borderWidth: 2,
                      borderColor: selectedStatus === option.key ? option.color : palette.divider,
                      backgroundColor: selectedStatus === option.key ? option.color : 'transparent',
                    }}
                  />
                </TouchableOpacity>
              ))}

              <TouchableOpacity
                onPress={() => setSelectedStatus(CLEAR_STATUS_KEY)}
                style={{
                  borderRadius: spacing.sm,
                  borderWidth: 1,
                  borderColor: selectedStatus === CLEAR_STATUS_KEY ? palette.accentPrimary : palette.divider,
                  backgroundColor: selectedStatus === CLEAR_STATUS_KEY ? `${palette.accentPrimary}22` : palette.surface,
                  padding: spacing.sm,
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
              >
                <View
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 999,
                    borderWidth: 2,
                    borderColor: palette.subtext,
                    marginRight: spacing.sm,
                  }}
                />
                <View style={{ flex: 1 }}>
                  <Text style={{ ...typography.label, color: palette.text }}>Clear</Text>
                  <Text style={{ ...typography.caption, color: palette.subtext }}>Remove status from selected date</Text>
                </View>
              </TouchableOpacity>
            </View>

            <View style={{ marginTop: spacing.md }}>
              <KISButton title={saving ? 'Saving...' : 'Save Availability'} onPress={saveAvailability} disabled={saving} />
            </View>
          </View>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}
