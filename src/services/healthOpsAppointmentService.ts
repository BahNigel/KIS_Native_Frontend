import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';

const toSlotStartIso = (dateKey?: string, timeValue?: string) => {
  const date = String(dateKey || '').trim();
  const time = String(timeValue || '').trim();
  if (!date) return '';
  if (!time) return `${date}T00:00:00`;
  return `${date}T${time}:00`;
};

type StartSessionArgs = {
  institutionId: string;
  cardId: string;
  serviceId?: string;
  date?: string;
  time?: string;
  ownerPreview?: boolean;
};

const shouldFallbackToBroadcast = (status?: number) =>
  status === 400 || status === 404 || status === 405;

export const startHealthServiceSession = async ({
  institutionId,
  cardId,
  serviceId,
  date,
  time,
  ownerPreview,
}: StartSessionArgs) => {
  const cleanServiceId = String(serviceId || '').trim();
  const cleanInstitutionId = String(institutionId || '').trim();
  const slotStart = toSlotStartIso(date, time);
  const isOwnerPreview = !!ownerPreview;

  if (cleanServiceId && slotStart) {
    const appointmentResponse = await postRequest(
      ROUTES.healthOps.appointmentBook(cleanServiceId),
      {
        slot_start: slotStart,
        auto_debit: !isOwnerPreview,
        owner_preview: isOwnerPreview,
        metadata: {
          cardId: String(cardId || ''),
          institutionId: cleanInstitutionId,
          source: 'health_cards',
          owner_preview: isOwnerPreview,
        },
      },
      {
        errorMessage: 'Unable to book appointment.',
      },
    );

    if (appointmentResponse?.success) {
      const workflowSessionId = String(appointmentResponse?.data?.session?.id || '').trim();
      const syntheticSessions = workflowSessionId
        ? [{ id: workflowSessionId, card_id: String(cardId || ''), cardId: String(cardId || ''), status: 'started' }]
        : [];
      return {
        ...appointmentResponse,
        data: {
          ...(appointmentResponse?.data || {}),
          service_sessions: syntheticSessions,
        },
        source: 'health_ops',
      };
    }

    if (!shouldFallbackToBroadcast(Number(appointmentResponse?.status))) {
      return { ...appointmentResponse, source: 'health_ops' };
    }
  }

  const broadcastResponse = await postRequest(
    ROUTES.broadcasts.healthCards(cleanInstitutionId),
    {
      action: 'start_service_session',
      cardId: String(cardId || ''),
      serviceId: cleanServiceId,
      date,
      time,
      ownerPreview: isOwnerPreview,
    },
    {
      errorMessage: 'Unable to start this session.',
    },
  );

  const hasHealthOpsPayload =
    !!String(broadcastResponse?.data?.session?.id || '').trim() ||
    !!String(broadcastResponse?.data?.booking?.id || '').trim();
  return {
    ...broadcastResponse,
    source: hasHealthOpsPayload ? 'health_ops' : 'broadcasts',
  };
};

export const fetchAppointmentConfig = (serviceId: string) =>
  getRequest(ROUTES.healthOps.appointmentConfig(serviceId), {
    errorMessage: 'Unable to load appointment configuration.',
  });

export const fetchAppointmentSlots = (serviceId: string, dateFrom: string, dateTo?: string) =>
  getRequest(ROUTES.healthOps.appointmentSlots(serviceId), {
    params: {
      date_from: dateFrom,
      ...(dateTo ? { date_to: dateTo } : {}),
    },
    errorMessage: 'Unable to load appointment slots.',
  });

export const fetchAppointmentBookings = (params?: {
  status?: string;
  serviceId?: string;
  institutionId?: string;
  limit?: number;
}) =>
  getRequest(ROUTES.healthOps.appointments, {
    params: {
      ...(params?.status ? { status: params.status } : {}),
      ...(params?.serviceId ? { service_id: params.serviceId } : {}),
      ...(params?.institutionId ? { institution_id: params.institutionId } : {}),
      ...(typeof params?.limit === 'number' ? { limit: params.limit } : {}),
    },
    errorMessage: 'Unable to load appointment bookings.',
  });

export const fetchAppointmentBooking = (bookingId: string) =>
  getRequest(ROUTES.healthOps.appointment(bookingId), {
    errorMessage: 'Unable to load appointment booking.',
  });

export const cancelAppointmentBooking = (bookingId: string, reason?: string) =>
  postRequest(
    ROUTES.healthOps.appointmentCancel(bookingId),
    {
      reason: String(reason || '').trim(),
    },
    {
      errorMessage: 'Unable to cancel appointment booking.',
    },
  );

export const rescheduleAppointmentBooking = (bookingId: string, slotStartIso: string) =>
  postRequest(
    ROUTES.healthOps.appointmentReschedule(bookingId),
    {
      slot_start: slotStartIso,
    },
    {
      errorMessage: 'Unable to reschedule appointment booking.',
    },
  );

export const getAppointmentIcsUrl = (bookingId: string) => ROUTES.healthOps.appointmentIcs(bookingId);
