import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { patchRequest } from '@/network/patch';
import { postRequest } from '@/network/post';

export const HEALTH_OPS_VIDEO_STEPS = [
  'confirm_identity',
  'test_mic_camera',
  'confirm_consent',
  'join_session',
  'post_session_summary',
] as const;

export type HealthOpsVideoStepKey = (typeof HEALTH_OPS_VIDEO_STEPS)[number];

type StartVideoArgs = {
  workflowSessionId: string;
  appointmentBookingId?: string;
  recordingEnabled?: boolean;
  waitingRoomEnabled?: boolean;
  metadata?: Record<string, any>;
};

export const startHealthOpsVideoSession = ({
  workflowSessionId,
  appointmentBookingId,
  recordingEnabled = false,
  waitingRoomEnabled = true,
  metadata,
}: StartVideoArgs) =>
  postRequest(
    ROUTES.healthOps.videoSessionStart,
    {
      workflow_session_id: String(workflowSessionId || '').trim(),
      ...(appointmentBookingId ? { appointment_booking_id: String(appointmentBookingId).trim() } : {}),
      recording_enabled: !!recordingEnabled,
      waiting_room_enabled: !!waitingRoomEnabled,
      ...(metadata && typeof metadata === 'object' ? { metadata } : {}),
    },
    {
      errorMessage: 'Unable to start video consultation session.',
    },
  );

export const fetchHealthOpsVideoSession = (videoSessionId: string) =>
  getRequest(ROUTES.healthOps.videoSession(videoSessionId), {
    errorMessage: 'Unable to load video consultation session.',
  });

export const updateHealthOpsVideoStep = (
  videoSessionId: string,
  stepKey: HealthOpsVideoStepKey,
  payload?: Record<string, any>,
  isCompleted = true,
) =>
  patchRequest(
    ROUTES.healthOps.videoSessionStep(videoSessionId),
    {
      step_key: stepKey,
      is_completed: !!isCompleted,
      ...(payload && typeof payload === 'object' ? { payload } : {}),
    },
    {
      errorMessage: 'Unable to update video consultation step.',
    },
  );

export const endHealthOpsVideoSession = (
  videoSessionId: string,
  options?: {
    status?: 'completed' | 'cancelled';
    summary?: string;
    metadata?: Record<string, any>;
  },
) =>
  postRequest(
    ROUTES.healthOps.videoSessionEnd(videoSessionId),
    {
      status: options?.status || 'completed',
      summary: String(options?.summary || '').trim(),
      ...(options?.metadata && typeof options.metadata === 'object' ? { metadata: options.metadata } : {}),
    },
    {
      errorMessage: 'Unable to end video consultation session.',
    },
  );
