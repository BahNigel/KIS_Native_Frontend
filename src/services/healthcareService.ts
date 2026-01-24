import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';

export type GroqFunctionCall = {
  name: string;
  payload?: Record<string, any>;
};

export const fetchHealthcareOrganizations = () =>
  getRequest(ROUTES.healthcare.organizations);

export const fetchMedicalProfiles = () =>
  getRequest(ROUTES.healthcare.profiles);

export const fetchTelemedicineSessions = () =>
  getRequest(ROUTES.telemedicine.sessions);

export const startTelemedicineSession = (sessionId: string) =>
  postRequest(ROUTES.telemedicine.sessionStart(sessionId), {});

export const endTelemedicineSession = (sessionId: string) =>
  postRequest(ROUTES.telemedicine.sessionEnd(sessionId), {});

export const fetchPatientMasterRecords = (params?: Record<string, any>) =>
  getRequest(ROUTES.patients.master, {
    params,
    errorMessage: 'Unable to load patient master records.',
  });

export const fetchPatientSummary = (id: string) =>
  getRequest(ROUTES.patients.summary(id), {
    errorMessage: 'Unable to load patient summary.',
  });

export const fetchPatientEncounters = (patientId: string) =>
  getRequest(ROUTES.patients.encounters, {
    params: { patient: patientId },
    errorMessage: 'Unable to load encounter timeline.',
  });

export const fetchPatientMedications = (patientId: string) =>
  getRequest(ROUTES.patients.medications, {
    params: { patient: patientId },
    errorMessage: 'Unable to load medication orders.',
  });

export const createMedicationOrder = (payload: Record<string, any>) =>
  postRequest(ROUTES.patients.medications, payload, {
    errorMessage: 'Unable to create medication order.',
  });

export const fetchPatientAllergies = (patientId: string) =>
  getRequest(ROUTES.patients.allergies, {
    params: { patient: patientId },
    errorMessage: 'Unable to load allergy records.',
  });

export const fetchPatientVitals = (patientId: string) =>
  getRequest(ROUTES.patients.vitals, {
    params: { patient: patientId },
    errorMessage: 'Unable to load vitals.',
  });

export const createVitalSign = (payload: Record<string, any>) =>
  postRequest(ROUTES.patients.vitals, payload, {
    errorMessage: 'Unable to log vital sign.',
  });

export const createFamilyProfile = (payload: Record<string, any>) =>
  postRequest(ROUTES.patients.family, payload, {
    errorMessage: 'Unable to create family profile.',
  });

export const createConsentRecord = (payload: Record<string, any>) =>
  postRequest(ROUTES.patients.consents, payload, {
    errorMessage: 'Unable to record consent.',
  });

export const createPatientMasterRecord = (payload: Record<string, any>) =>
  postRequest(ROUTES.patients.master, payload, {
    errorMessage: 'Unable to create patient record.',
  });

export const runGroqTask = (payload: {
  prompt: string;
  mode?: string;
  function_call?: GroqFunctionCall;
  tenant_id?: string;
}) =>
  postRequest(ROUTES.ai.groqTask, payload);
