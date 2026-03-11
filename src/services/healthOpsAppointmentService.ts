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

const unsupportedHealthOpsBookingServiceIds = new Set<string>();

const findBackendCardIdFromCardsResponse = (
  cardsPayload: any,
  args: { serviceId?: string; date?: string; time?: string },
) => {
  const cards = Array.isArray(cardsPayload?.cards) ? cardsPayload.cards : [];
  if (!cards.length) return '';
  const serviceId = String(args.serviceId || '').trim();
  const date = String(args.date || '').trim();
  const time = String(args.time || '').trim();

  const byDateServiceTime = cards.find((card: any) => {
    const rowDate = String(card?.date || card?.dateKey || '').trim();
    const rowServiceId = String(card?.service?.id || card?.service_id || '').trim();
    const rowTime = String(card?.time || card?.timeValue || '').trim();
    if (date && rowDate !== date) return false;
    if (serviceId && rowServiceId !== serviceId) return false;
    if (time && rowTime && rowTime !== time) return false;
    return true;
  });
  if (byDateServiceTime?.id) return String(byDateServiceTime.id);

  const byDateService = cards.find((card: any) => {
    const rowDate = String(card?.date || card?.dateKey || '').trim();
    const rowServiceId = String(card?.service?.id || card?.service_id || '').trim();
    if (date && rowDate !== date) return false;
    if (serviceId && rowServiceId !== serviceId) return false;
    return true;
  });
  if (byDateService?.id) return String(byDateService.id);

  return '';
};

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
  const cleanCardId = String(cardId || '').trim();
  const slotStart = toSlotStartIso(date, time);
  const isOwnerPreview = !!ownerPreview;
  const skipHealthOpsAttempt = cleanServiceId && unsupportedHealthOpsBookingServiceIds.has(cleanServiceId);

  if (cleanServiceId && slotStart && !skipHealthOpsAttempt) {
    const appointmentResponse = await postRequest(
      ROUTES.healthOps.appointmentBook(cleanServiceId),
      {
        slot_start: slotStart,
        auto_debit: !isOwnerPreview,
        owner_preview: isOwnerPreview,
        metadata: {
          cardId: cleanCardId,
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
      unsupportedHealthOpsBookingServiceIds.delete(cleanServiceId);
      const workflowSessionId = String(appointmentResponse?.data?.session?.id || '').trim();
      const syntheticSessions = workflowSessionId
        ? [{ id: workflowSessionId, card_id: cleanCardId, cardId: cleanCardId, status: 'started' }]
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

    if (Number(appointmentResponse?.status) === 404 || Number(appointmentResponse?.status) === 405) {
      unsupportedHealthOpsBookingServiceIds.add(cleanServiceId);
    }

    if (!shouldFallbackToBroadcast(Number(appointmentResponse?.status))) {
      return { ...appointmentResponse, source: 'health_ops' };
    }
  }

  const baseBroadcastPayload = {
    action: 'start_service_session',
    cardId: cleanCardId,
    serviceId: cleanServiceId,
    date,
    time,
    ownerPreview: isOwnerPreview,
  };
  let broadcastResponse = await postRequest(
    ROUTES.broadcasts.healthCards(cleanInstitutionId),
    baseBroadcastPayload,
    {
      errorMessage: 'Unable to start this session.',
    },
  );

  if (
    !broadcastResponse?.success &&
    Number(broadcastResponse?.status) === 404 &&
    cleanInstitutionId &&
    cleanServiceId &&
    date
  ) {
    const cardsResponse = await getRequest(ROUTES.broadcasts.healthCards(cleanInstitutionId), {
      forceNetwork: true,
      errorMessage: 'Unable to resolve health card for booking.',
    });
    if (cardsResponse?.success) {
      const resolvedCardId = findBackendCardIdFromCardsResponse(cardsResponse?.data, {
        serviceId: cleanServiceId,
        date,
        time,
      });
      if (resolvedCardId && resolvedCardId !== cleanCardId) {
        broadcastResponse = await postRequest(
          ROUTES.broadcasts.healthCards(cleanInstitutionId),
          {
            ...baseBroadcastPayload,
            cardId: resolvedCardId,
          },
          {
            errorMessage: 'Unable to start this session.',
          },
        );
      }
    }
  }

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
