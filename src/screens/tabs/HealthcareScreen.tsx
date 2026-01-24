import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { KIS_TOKENS } from '@/theme/constants';
import { useKISTheme } from '@/theme/useTheme';
import KISButton from '@/constants/KISButton';
import GlobalShell from '@/components/healthcare/GlobalShell';
import {
  fetchTelemedicineSessions,
  fetchPatientMasterRecords,
  fetchPatientSummary,
  fetchPatientEncounters,
  fetchPatientMedications,
  fetchPatientVitals,
  fetchPatientAllergies,
  createMedicationOrder,
  createVitalSign,
  endTelemedicineSession,
  runGroqTask,
  startTelemedicineSession,
  createFamilyProfile,
  createConsentRecord,
  createPatientMasterRecord,
} from '@/services/healthcareService';
import {
  fetchHealthcareContext,
  setActiveMedicalProfile,
} from '@/services/healthcareContextService';
import StaffConsole from '@/components/healthcare/StaffConsole';
import {
  fetchStaffProfiles,
  assignStaffRole,
  assignStaffShift,
} from '@/services/staffService';

const INITIAL_PATIENT_FORM = {
  mrn: '',
  first_name: '',
  last_name: '',
  dob: '',
  gender: 'unknown',
  status: 'active',
};

const INITIAL_FAMILY_FORM = {
  relationship: '',
  members: '',
  notes: '',
};

const INITIAL_CONSENT_FORM = {
  purpose: '',
  consent_text: '',
  expires_at: '',
};

export default function HealthcareScreen() {
  const { palette, tokens } = useKISTheme();
  const styles = useMemo(() => makeStyles(tokens), [tokens]);

  const [medicalContext, setMedicalContext] = useState<any>(null);
  const [teleSessions, setTeleSessions] = useState<any[]>([]);
  const [patientCount, setPatientCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [teleLoading, setTeleLoading] = useState(false);
  const [contextLoading, setContextLoading] = useState(false);
  const [emergencyMode, setEmergencyMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [staffProfiles, setStaffProfiles] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [patientDetail, setPatientDetail] = useState<any | null>(null);
  const [patientDetailLoading, setPatientDetailLoading] = useState(false);
  const [timelineEntries, setTimelineEntries] = useState<any[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [medOrderForm, setMedOrderForm] = useState({
    drug_name: '',
    dosage: '',
    route: '',
    frequency: '',
    notes: '',
  });
  const [vitalForm, setVitalForm] = useState({ vital_type: '', value: '', units: '', notes: '' });
  const [medSubmitting, setMedSubmitting] = useState(false);
  const [vitalSubmitting, setVitalSubmitting] = useState(false);
  const [aiDoctorResult, setAiDoctorResult] = useState<string | null>(null);
  const [aiDoctorLoading, setAiDoctorLoading] = useState(false);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffUpdateId, setStaffUpdateId] = useState<string | null>(null);
  const [staffShiftId, setStaffShiftId] = useState<string | null>(null);
  const [aiStaffId, setAiStaffId] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [triageResult, setTriageResult] = useState<string | null>(null);
  const [patientForm, setPatientForm] = useState({ ...INITIAL_PATIENT_FORM });
  const [familyForm, setFamilyForm] = useState({ ...INITIAL_FAMILY_FORM });
  const [consentForm, setConsentForm] = useState({ ...INITIAL_CONSENT_FORM });
  const [patientSaving, setPatientSaving] = useState(false);
  const [familySaving, setFamilySaving] = useState(false);
  const [consentSaving, setConsentSaving] = useState(false);

  const loadContext = useCallback(async () => {
    setContextLoading(true);
    const res = await fetchHealthcareContext();
    setContextLoading(false);
    if (res.success) {
      setMedicalContext(res.data);
      return;
    }
    Alert.alert('Context', res.message || 'Unable to load medical context.');
  }, []);

  const loadPatientRecords = useCallback(
    async (query?: string) => {
      setLoading(true);
      const params = query ? { search: query } : undefined;
      const res = await fetchPatientMasterRecords(params);
      if (res.success) {
        const rows = Array.isArray(res.data)
          ? res.data
          : Array.isArray(res.data?.results)
          ? res.data.results
          : [];
        setPatients(rows);
        setPatientCount(rows.length);
        setPatientDetail(null);
      } else {
        Alert.alert('Patients', res.message || 'Unable to load patients.');
      }
      setLoading(false);
    },
    [],
  );

  const loadTeleSessions = useCallback(async () => {
    setTeleLoading(true);
    const res = await fetchTelemedicineSessions();
    setTeleLoading(false);
    if (res.success) {
      setTeleSessions(Array.isArray(res.data) ? res.data : []);
      return;
    }
    Alert.alert('Telemedicine', res.message || 'Unable to load sessions.');
  }, []);

  const loadPatientTimeline = useCallback(async (patientId: string) => {
    setTimelineLoading(true);
    try {
      const normalize = (response: any) =>
        Array.isArray(response?.data)
          ? response.data
          : Array.isArray(response?.data?.results)
          ? response.data.results
          : [];

      const [encRes, medRes, vitalRes, allergyRes] = await Promise.all([
        fetchPatientEncounters(patientId),
        fetchPatientMedications(patientId),
        fetchPatientVitals(patientId),
        fetchPatientAllergies(patientId),
      ]);

      const entries: any[] = [];
      const addEntry = (item: {
        id: string;
        type: string;
        label: string;
        summary: string;
        timestamp?: string | null;
        payload?: any;
      }) => {
        const stamp = item.timestamp || new Date().toISOString();
        entries.push({ ...item, timestamp: stamp });
      };

      normalize(encRes).forEach((enc) =>
        addEntry({
          id: `enc-${enc.id}`,
          type: 'encounter',
          label: enc.encounter_type || 'Clinical encounter',
          summary: enc.summary || enc.notes || 'Encounter logged.',
          timestamp: enc.created_at || enc.updated_at,
          payload: enc,
        }),
      );

      normalize(medRes).forEach((med) =>
        addEntry({
          id: `med-${med.id}`,
          type: 'medication',
          label: med.drug_name,
          summary: `${med.dosage || 'dosage'} · ${med.status || 'status'}`,
          timestamp: med.created_at || med.updated_at,
          payload: med,
        }),
      );

      normalize(vitalRes).forEach((vital) =>
        addEntry({
          id: `vital-${vital.id}`,
          type: 'vital',
          label: `${vital.vital_type || 'vital'} ${vital.value || ''}${vital.units || ''}`,
          summary: vital.notes || 'Vital recorded',
          timestamp: vital.recorded_at,
          payload: vital,
        }),
      );

      normalize(allergyRes).forEach((allergy) =>
        addEntry({
          id: `allergy-${allergy.id}`,
          type: 'allergy',
          label: `${allergy.agent} (${allergy.severity})`,
          summary: allergy.reaction || 'Allergy noted',
          timestamp: allergy.recorded_at,
          payload: allergy,
        }),
      );

      const sorted = entries.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );
      setTimelineEntries(sorted);
    } catch (error: any) {
      Alert.alert('Timeline', error?.message || 'Unable to load timeline data.');
    } finally {
      setTimelineLoading(false);
    }
  }, []);

  const loadStaffProfiles = useCallback(async () => {
    const profileId = medicalContext?.active_profile_id;
    if (!profileId) {
      setStaffProfiles([]);
      return;
    }
    setStaffLoading(true);
    const res = await fetchStaffProfiles({ profile: profileId });
    setStaffLoading(false);
    if (res.success) {
      const array = Array.isArray(res.data) ? res.data : res.data?.results ?? [];
      setStaffProfiles(array);
      return;
    }
    Alert.alert('Staff', res.message || 'Unable to load staff directory.');
  }, [medicalContext?.active_profile_id]);

  const loadPatientDetail = useCallback(
    async (patientId: string) => {
      const res = await fetchPatientSummary(patientId);
      if (res.success) {
        setPatientDetail(res.data);
        await loadPatientTimeline(patientId);
        return;
      }
      Alert.alert('Patient', res.message || 'Unable to load patient profile.');
    },
    [loadPatientTimeline],
  );

  useEffect(() => {
    loadStaffProfiles();
  }, [loadStaffProfiles]);

  useEffect(() => {
    loadContext();
    loadTeleSessions();
    loadPatientRecords();
  }, [loadContext, loadTeleSessions, loadPatientRecords]);

  const handleSearchSubmit = useCallback(() => {
    loadPatientRecords(searchTerm);
  }, [loadPatientRecords, searchTerm]);

  const handleSelectPatient = useCallback(
    async (patientId: string) => {
      setPatientDetailLoading(true);
      await loadPatientDetail(patientId);
      setPatientDetailLoading(false);
    },
    [loadPatientDetail],
  );

  const handleSessionAction = useCallback(
    async (session: any, action: 'start' | 'end') => {
      const executor =
        action === 'start'
          ? startTelemedicineSession
          : endTelemedicineSession;
      const res = await executor(session.id);
      if (res.success) {
        loadTeleSessions();
        return;
      }
      Alert.alert('Telemedicine', res.message || 'Unable to update session.');
    },
    [loadTeleSessions],
  );

  const handleRunTriage = useCallback(async () => {
    setAiLoading(true);
    const payload = {
      prompt: 'Patient reports cough, fever, and mild shortness of breath.',
      mode: 'triage',
      function_call: {
        name: 'triage_prepare',
        payload: { symptoms: ['cough', 'fever', 'shortness of breath'] },
      },
    };
    const res = await runGroqTask(payload);
    setAiLoading(false);
    if (!res.success) {
      Alert.alert('AI Triage', res.message || 'Unable to reach Groq.');
      return;
    }
    setTriageResult(JSON.stringify(res.data.result ?? res.data, null, 2));
  }, []);

  const handleCreatePatient = useCallback(async () => {
    const { mrn, first_name, last_name } = patientForm;
    if (!mrn.trim() || !first_name.trim() || !last_name.trim()) {
      Alert.alert('Patient', 'MRN, first name, and last name are required.');
      return;
    }
    setPatientSaving(true);
    try {
      const payload = {
        ...patientForm,
        organization: medicalContext?.active_organization_id,
      };
      const res = await createPatientMasterRecord(payload);
      if (res.success) {
        setPatientForm({ ...INITIAL_PATIENT_FORM });
        loadPatientRecords();
        Alert.alert('Patient', 'Patient record created.');
        return;
      }
      Alert.alert('Patient', res.message || 'Unable to create patient record.');
    } catch (error: any) {
      Alert.alert('Patient', error?.message || 'Unable to create patient record.');
    } finally {
      setPatientSaving(false);
    }
  }, [patientForm, medicalContext?.active_organization_id, loadPatientRecords]);

  const handleCreateFamilyProfile = useCallback(async () => {
    if (!patientDetail) {
      Alert.alert('Family', 'Select a patient first.');
      return;
    }
    if (!familyForm.relationship.trim()) {
      Alert.alert('Family', 'Provide a relationship for the family record.');
      return;
    }
    setFamilySaving(true);
    try {
      const membersArray = (familyForm.members || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
      const payload = {
        ...familyForm,
        patient: patientDetail.id,
        members: membersArray,
      };
      const res = await createFamilyProfile(payload);
      if (res.success) {
        setFamilyForm({ ...INITIAL_FAMILY_FORM });
        await loadPatientDetail(patientDetail.id);
        Alert.alert('Family', 'Family profile saved.');
        return;
      }
      Alert.alert('Family', res.message || 'Unable to save family profile.');
    } catch (error: any) {
      Alert.alert('Family', error?.message || 'Unable to save family profile.');
    } finally {
      setFamilySaving(false);
    }
  }, [familyForm, patientDetail, loadPatientDetail]);

  const handleCreateConsentRecord = useCallback(async () => {
    if (!patientDetail) {
      Alert.alert('Consent', 'Select a patient first.');
      return;
    }
    if (!consentForm.purpose.trim() || !consentForm.consent_text.trim()) {
      Alert.alert('Consent', 'Purpose and consent text are required.');
      return;
    }
    setConsentSaving(true);
    try {
      const payload = {
        ...consentForm,
        patient: patientDetail.id,
      };
      const res = await createConsentRecord(payload);
      if (res.success) {
        setConsentForm({ ...INITIAL_CONSENT_FORM });
        await loadPatientDetail(patientDetail.id);
        Alert.alert('Consent', 'Consent recorded.');
        return;
      }
      Alert.alert('Consent', res.message || 'Unable to record consent.');
    } catch (error: any) {
      Alert.alert('Consent', error?.message || 'Unable to record consent.');
    } finally {
      setConsentSaving(false);
    }
  }, [consentForm, patientDetail, loadPatientDetail]);

  const handleCreateMedicationOrder = useCallback(async () => {
    if (!patientDetail) {
      Alert.alert('Medication', 'Select a patient first.');
      return;
    }
    if (!medOrderForm.drug_name.trim()) {
      Alert.alert('Medication', 'Drug name is required.');
      return;
    }
    setMedSubmitting(true);
    try {
      const payload = {
        ...medOrderForm,
        patient: patientDetail.id,
      };
      const res = await createMedicationOrder(payload);
      if (res.success) {
        setMedOrderForm({
          drug_name: '',
          dosage: '',
          route: '',
          frequency: '',
          notes: '',
        });
        await loadPatientTimeline(patientDetail.id);
        Alert.alert('Medication', 'Medication order created.');
        return;
      }
      Alert.alert('Medication', res.message || 'Unable to create medication order.');
    } catch (error: any) {
      Alert.alert('Medication', error?.message || 'Unable to create medication order.');
    } finally {
      setMedSubmitting(false);
    }
  }, [medOrderForm, patientDetail, loadPatientTimeline]);

  const handleCreateVitalSign = useCallback(async () => {
    if (!patientDetail) {
      Alert.alert('Vitals', 'Select a patient first.');
      return;
    }
    if (!vitalForm.vital_type.trim() || !vitalForm.value) {
      Alert.alert('Vitals', 'Vital type and value are required.');
      return;
    }
    setVitalSubmitting(true);
    try {
      const payload = {
        ...vitalForm,
        patient: patientDetail.id,
      };
      const res = await createVitalSign(payload);
      if (res.success) {
        setVitalForm({ vital_type: '', value: '', units: '', notes: '' });
        await loadPatientTimeline(patientDetail.id);
        Alert.alert('Vitals', 'Vital sign logged.');
        return;
      }
      Alert.alert('Vitals', res.message || 'Unable to log vital sign.');
    } catch (error: any) {
      Alert.alert('Vitals', error?.message || 'Unable to log vital sign.');
    } finally {
      setVitalSubmitting(false);
    }
  }, [vitalForm, patientDetail, loadPatientTimeline]);

  const handleDoctorAiInsight = useCallback(async () => {
    if (!patientDetail) {
      Alert.alert('AI doctor', 'Select a patient to generate recommendations.');
      return;
    }
    setAiDoctorLoading(true);
    try {
      const interactions = timelineEntries.slice(0, 6).map((entry) => ({
        type: entry.type,
        label: entry.label,
        summary: entry.summary,
        timestamp: entry.timestamp,
      }));
      const payload = {
        prompt: `Provide a clinical overview for ${patientDetail.first_name} ${patientDetail.last_name} (${patientDetail.mrn}).`,
        mode: 'clinical',
        function_call: {
          name: 'interact_schema',
          payload: {
            patientId: patientDetail.id,
            interactions,
          },
        },
        tenant_id: patientDetail?.tenant_id ?? undefined,
      };
      const res = await runGroqTask(payload);
      if (res.success) {
        const content = res.data?.result ?? res.data;
        setAiDoctorResult(typeof content === 'string' ? content : JSON.stringify(content, null, 2));
        return;
      }
      Alert.alert('AI doctor', res.message || 'Unable to reach Groq.');
    } catch (error: any) {
      Alert.alert('AI doctor', error?.message || 'Unable to reach Groq.');
    } finally {
      setAiDoctorLoading(false);
    }
  }, [patientDetail, timelineEntries]);


  const handleUpdateStaffRole = useCallback(
    async (staffId: string, payload: { role?: string; scope?: string }) => {
      setStaffUpdateId(staffId);
      try {
        await assignStaffRole(staffId, payload);
        await loadStaffProfiles();
      } catch (error: any) {
        Alert.alert('Staff', error?.message || 'Unable to update staff role.');
      } finally {
        setStaffUpdateId(null);
      }
    },
    [loadStaffProfiles],
  );

  const handleAssignStaffShift = useCallback(
    async (staffId: string, shifts: any[]) => {
      setStaffShiftId(staffId);
      try {
        await assignStaffShift(staffId, shifts);
        await loadStaffProfiles();
      } catch (error: any) {
        Alert.alert('Staff', error?.message || 'Unable to assign shift.');
      } finally {
        setStaffShiftId(null);
      }
    },
    [loadStaffProfiles],
  );

  const handleStaffAiReview = useCallback(
    async (staff: any) => {
      setAiStaffId(staff.id);
      try {
        const prompt = `Review the credential highlights for ${staff.role || 'staff member'} and note any license counts (${(staff.licenses || []).length}).`;
        const res = await runGroqTask({
          prompt,
          mode: 'clinical',
          function_call: {
            name: 'staff_review',
            payload: {
              staffId: staff.id,
              role: staff.role,
            },
          },
        });
        if (!res.success) {
          throw new Error(res.message || 'Groq review failed.');
        }
        const summary = res.data?.result ?? res.data?.response ?? 'AI review complete.';
        Alert.alert('AI staff review', typeof summary === 'string' ? summary : JSON.stringify(summary, null, 2));
      } catch (error: any) {
        Alert.alert('AI review', error?.message || 'Unable to run AI assistant.');
      } finally {
        setAiStaffId(null);
      }
    },
    [],
  );

  const handleProfileSelect = useCallback(
    async (profileId: string) => {
      const res = await setActiveMedicalProfile(profileId);
      if (res.success) {
        loadContext();
        return;
      }
      Alert.alert('Profile', res.message || 'Unable to activate profile.');
    },
    [loadContext],
  );

  const handleEmergencyToggle = useCallback(() => {
    setEmergencyMode((prev) => !prev);
  }, []);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: palette.bg }]}
      contentContainerStyle={{ paddingBottom: 48 }}
    >
      <GlobalShell
        organizations={medicalContext?.organizations ?? []}
        activeProfileId={medicalContext?.active_profile_id ?? null}
        activeOrganizationId={medicalContext?.active_organization_id ?? null}
        onSelectProfile={handleProfileSelect}
        emergencyMode={emergencyMode}
        onToggleEmergency={handleEmergencyToggle}
        searchTerm={searchTerm}
        onChangeSearch={setSearchTerm}
        onSubmitSearch={handleSearchSubmit}
      />

      <View style={[styles.section, { backgroundColor: palette.card }]}>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>
          Healthcare organizations
        </Text>
        {contextLoading ? (
          <ActivityIndicator color={palette.primaryStrong} />
        ) : (medicalContext?.organizations ?? []).length === 0 ? (
          <Text style={{ color: palette.subtext }}>No organizations found.</Text>
        ) : (
          (medicalContext?.organizations ?? []).map((org: any) => (
            <View
              key={org.id}
              style={[styles.card, { borderColor: palette.divider, backgroundColor: palette.surface }]}
            >
              <Text style={[styles.cardTitle, { color: palette.text }]} numberOfLines={1}>
                {org.name}
              </Text>
              <Text style={{ color: palette.subtext, fontSize: 12 }}>
                Type: {org.org_type}
              </Text>
              <Text style={{ color: palette.subtext, fontSize: 12 }}>
                Status: {org.status}
              </Text>
              <Text style={{ color: palette.subtext, fontSize: 12 }}>
                Profiles: {(org.profiles || []).length}
              </Text>
            </View>
          ))
        )}
      </View>

      <StaffConsole
        loading={staffLoading}
        staff={staffProfiles}
        profileId={medicalContext?.active_profile_id ?? null}
        updatingId={staffUpdateId}
        shiftLoadingId={staffShiftId}
        aiLoadingId={aiStaffId}
        onUpdateRole={handleUpdateStaffRole}
        onAssignShift={handleAssignStaffShift}
        onRunAi={handleStaffAiReview}
      />

      <View style={[styles.section, { backgroundColor: palette.card }]}>
        <View style={styles.sectionHeading}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>
            Telemedicine sessions
          </Text>
          <Text style={{ color: palette.subtext }}>{teleSessions.length} sessions</Text>
        </View>
        {teleLoading ? (
          <ActivityIndicator color={palette.primaryStrong} />
        ) : teleSessions.length === 0 ? (
          <Text style={{ color: palette.subtext }}>No sessions scheduled yet.</Text>
        ) : (
          teleSessions.map((session) => (
            <View
              key={session.id}
              style={[
                styles.card,
                { borderColor: palette.divider, backgroundColor: palette.surface },
              ]}
            >
              <View style={styles.row}>
                <Text style={[styles.cardTitle, { color: palette.text }]}>
                  Session {session.id?.slice?.(-5) ?? ''}
                </Text>
                <Text style={{ color: palette.primaryStrong, fontWeight: '700' }}>
                  {session.status?.toUpperCase()}
                </Text>
              </View>
              <Text style={{ color: palette.subtext, fontSize: 12 }}>
                Patient: {session.patient || 'Unassigned'}
              </Text>
              <Text style={{ color: palette.subtext, fontSize: 12 }}>
                Clinician: {session.clinician || 'Unassigned'}
              </Text>
              <View style={styles.actionsRow}>
                {session.status === 'pending' ? (
                  <KISButton size="sm" variant="secondary" title="Start" onPress={() => handleSessionAction(session, 'start')} />
                ) : (
                  <KISButton size="sm" variant="outline" title="End" onPress={() => handleSessionAction(session, 'end')} />
                )}
              </View>
            </View>
          ))
        )}
      </View>

      <View style={[styles.section, { backgroundColor: palette.card }]}>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>Create patient record</Text>
        <Text style={{ color: palette.subtext, marginBottom: 8 }}>
          Add a new person to the master index and connect them to the active medical profile.
        </Text>
        <View style={styles.formGrid}>
          <TextInput
            value={patientForm.mrn}
            onChangeText={(value) => setPatientForm((prev) => ({ ...prev, mrn: value }))}
            placeholder="MRN"
            placeholderTextColor={palette.subtext}
            style={[styles.input, { backgroundColor: palette.surface }]}
          />
          <TextInput
            value={patientForm.first_name}
            onChangeText={(value) => setPatientForm((prev) => ({ ...prev, first_name: value }))}
            placeholder="First name"
            placeholderTextColor={palette.subtext}
            style={[styles.input, { backgroundColor: palette.surface }]}
          />
          <TextInput
            value={patientForm.last_name}
            onChangeText={(value) => setPatientForm((prev) => ({ ...prev, last_name: value }))}
            placeholder="Last name"
            placeholderTextColor={palette.subtext}
            style={[styles.input, { backgroundColor: palette.surface }]}
          />
          <TextInput
            value={patientForm.dob}
            onChangeText={(value) => setPatientForm((prev) => ({ ...prev, dob: value }))}
            placeholder="DOB (YYYY-MM-DD)"
            placeholderTextColor={palette.subtext}
            style={[styles.input, { backgroundColor: palette.surface }]}
          />
          <TextInput
            value={patientForm.gender}
            onChangeText={(value) => setPatientForm((prev) => ({ ...prev, gender: value }))}
            placeholder="Gender"
            placeholderTextColor={palette.subtext}
            style={[styles.input, { backgroundColor: palette.surface }]}
          />
          <TextInput
            value={patientForm.status}
            onChangeText={(value) => setPatientForm((prev) => ({ ...prev, status: value }))}
            placeholder="Status"
            placeholderTextColor={palette.subtext}
            style={[styles.input, { backgroundColor: palette.surface }]}
          />
        </View>
        <KISButton
          title={patientSaving ? 'Saving…' : 'Create patient'}
          onPress={handleCreatePatient}
          disabled={patientSaving}
        />
      </View>

      <View style={[styles.section, { backgroundColor: palette.card }]}>
        <View style={styles.sectionHeading}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Patients</Text>
          <Text style={{ color: palette.subtext }}>{patientCount} records</Text>
        </View>
        <Text style={{ color: palette.subtext, marginBottom: 10 }}>
          Master index entries available for AI-assisted triage and clinical workflows.
        </Text>
        {loading && <ActivityIndicator color={palette.primaryStrong} />}
        <KISButton
          title="Refresh patient list"
          variant="outline"
          size="sm"
          onPress={() => loadPatientRecords(searchTerm)}
        />
        <ScrollView style={{ maxHeight: 240, marginTop: 12 }}>
          {patients.length === 0 ? (
            <Text style={{ color: palette.subtext }}>No patients matched your search yet.</Text>
          ) : (
            patients.map((patient) => (
              <Pressable
                key={patient.id}
                onPress={() => handleSelectPatient(patient.id)}
                style={[
                  styles.patientRow,
                  {
                    borderColor:
                      patientDetail?.id === patient.id ? palette.primary : palette.divider,
                    backgroundColor:
                      patientDetail?.id === patient.id ? palette.primarySoft : palette.surface,
                  },
                ]}
              >
                <Text style={{ color: palette.text, fontWeight: '900' }}>
                  {patient.last_name}, {patient.first_name}
                </Text>
                <Text style={{ color: palette.subtext, fontSize: 12 }}>
                  MRN: {patient.mrn} · Status: {patient.status}
                </Text>
              </Pressable>
            ))
          )}
        </ScrollView>
        {patientDetailLoading && <ActivityIndicator color={palette.primaryStrong} />}
        {patientDetail && (
          <View style={[styles.patientDetail, { borderColor: palette.divider, backgroundColor: palette.surface }]}>
            <Text style={{ color: palette.text, fontWeight: '900', fontSize: 14 }}>Family profiles</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, marginVertical: 8 }}>
              {(patientDetail.family_profiles || []).map((family: any) => (
                <View key={family.id} style={[styles.familyCard, { borderColor: palette.divider }]}>
                  <Text style={{ color: palette.text, fontWeight: '900' }}>{family.relationship}</Text>
                  <Text style={{ color: palette.subtext, fontSize: 12 }}>
                    {Array.isArray(family.members) ? family.members.length : 0} members
                  </Text>
                  {!!family.notes && (
                    <Text style={{ color: palette.subtext, fontSize: 11 }}>{family.notes}</Text>
                  )}
                </View>
              ))}
            </ScrollView>
            <Text style={{ color: palette.text, fontWeight: '900', fontSize: 14 }}>Consents</Text>
            <View style={{ gap: 6, marginTop: 6 }}>
              {(patientDetail.consents || []).map((consent: any) => {
                const expires = consent.expires_at ? new Date(consent.expires_at) : null;
                const isActive = !expires || expires > new Date();
                return (
                  <View key={consent.id} style={[styles.consentRow, { borderColor: palette.divider }]}>
                    <Text style={{ color: palette.text, fontWeight: '700' }}>{consent.purpose}</Text>
                    <Text style={{ color: palette.subtext, fontSize: 11 }}>
                      Granted by {consent.granted_by || 'unknown'} · {new Date(consent.granted_at).toLocaleDateString()}
                    </Text>
                    <Text
                      style={{
                        color: isActive ? palette.primaryStrong : palette.danger,
                        fontWeight: '900',
                        fontSize: 12,
                      }}
                    >
                      {consent.expires_at ? `Expires ${new Date(consent.expires_at).toLocaleDateString()}` : 'No expiry'}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}
        {patientDetail && (
          <View style={[styles.formGrid, { marginTop: 16 }]}>
            <View style={[styles.formColumn, { backgroundColor: palette.surface, borderColor: palette.divider }]}>
              <Text style={[styles.sectionTitle, { fontSize: 14, color: palette.text }]}>Add family profile</Text>
              <TextInput
                value={familyForm.relationship}
                onChangeText={(value) => setFamilyForm((prev) => ({ ...prev, relationship: value }))}
                placeholder="Relationship"
                placeholderTextColor={palette.subtext}
                style={[styles.input, { backgroundColor: palette.card }]}
              />
              <TextInput
                value={familyForm.members}
                onChangeText={(value) => setFamilyForm((prev) => ({ ...prev, members: value }))}
                placeholder="Members (comma separated)"
                placeholderTextColor={palette.subtext}
                style={[styles.input, { backgroundColor: palette.card }]}
              />
              <TextInput
                value={familyForm.notes}
                onChangeText={(value) => setFamilyForm((prev) => ({ ...prev, notes: value }))}
                placeholder="Notes"
                placeholderTextColor={palette.subtext}
                multiline
                style={[styles.input, styles.textArea, { backgroundColor: palette.card }]}
              />
              <KISButton
                title={familySaving ? 'Saving…' : 'Save family'}
                onPress={handleCreateFamilyProfile}
                size="sm"
                disabled={familySaving}
              />
            </View>
            <View style={[styles.formColumn, { backgroundColor: palette.surface, borderColor: palette.divider }]}>
              <Text style={[styles.sectionTitle, { fontSize: 14, color: palette.text }]}>Add consent</Text>
              <TextInput
                value={consentForm.purpose}
                onChangeText={(value) => setConsentForm((prev) => ({ ...prev, purpose: value }))}
                placeholder="Purpose"
                placeholderTextColor={palette.subtext}
                style={[styles.input, { backgroundColor: palette.card }]}
              />
              <TextInput
                value={consentForm.consent_text}
                onChangeText={(value) => setConsentForm((prev) => ({ ...prev, consent_text: value }))}
                placeholder="Consent text"
                placeholderTextColor={palette.subtext}
                multiline
                style={[styles.input, styles.textArea, { backgroundColor: palette.card }]}
              />
              <TextInput
                value={consentForm.expires_at}
                onChangeText={(value) => setConsentForm((prev) => ({ ...prev, expires_at: value }))}
                placeholder="Expires at (YYYY-MM-DD)"
                placeholderTextColor={palette.subtext}
                style={[styles.input, { backgroundColor: palette.card }]}
              />
              <KISButton
                title={consentSaving ? 'Saving…' : 'Save consent'}
                onPress={handleCreateConsentRecord}
                size="sm"
                disabled={consentSaving}
              />
            </View>
          </View>
        )}
      </View>

      <View style={[styles.section, { backgroundColor: palette.card }]}>
        <View style={[styles.row, { justifyContent: 'space-between' }]}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Clinical timeline</Text>
          <Text style={{ color: palette.subtext }}>{timelineEntries.length} events</Text>
        </View>
        <View style={styles.timelineContainer}>
          <View style={[styles.timelineColumn, { borderColor: palette.divider, backgroundColor: palette.surface }]}>
            {timelineLoading ? (
              <ActivityIndicator color={palette.primaryStrong} />
            ) : timelineEntries.length === 0 ? (
              <Text style={{ color: palette.subtext }}>No timeline events yet.</Text>
            ) : (
              <ScrollView style={{ maxHeight: 220 }}>
                {timelineEntries.map((entry) => (
                  <Pressable
                    key={entry.id}
                    style={[styles.timelineEntry, { borderColor: palette.divider }]}
                  >
                    <Text style={[styles.timelineLabel, { color: palette.text }]}>{entry.label}</Text>
                    <Text style={{ color: palette.subtext, fontSize: 12 }}>{entry.summary}</Text>
                    <Text style={[styles.timelineTime, { color: palette.subtext }]}>
                      {new Date(entry.timestamp).toLocaleString()}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>
          <View style={[styles.aiPanel, { borderColor: palette.divider, backgroundColor: palette.surface }]}>
            <Text style={{ color: palette.text, fontWeight: '900', marginBottom: 6 }}>AI clinical assistant</Text>
            <Text style={{ color: palette.subtext, fontSize: 12, marginBottom: 12 }}>
              Groq insights for the selected patient and timeline.
            </Text>
            {aiDoctorResult ? (
              <View style={[styles.resultBox, { borderColor: palette.divider, marginBottom: 6 }]}>
                <Text style={{ color: palette.text, fontSize: 12 }} selectable>
                  {aiDoctorResult}
                </Text>
              </View>
            ) : (
              <Text style={{ color: palette.subtext, fontSize: 12, marginBottom: 6 }}>
                Run the assistant to summarize the clinical picture.
              </Text>
            )}
            <KISButton
              title={aiDoctorLoading ? 'Generating…' : 'Run AI assistant'}
              onPress={handleDoctorAiInsight}
              disabled={aiDoctorLoading}
              size="sm"
            />
          </View>
        </View>
      </View>

      <View style={[styles.section, { backgroundColor: palette.card }]}>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>Orders & vitals</Text>
        <View style={styles.formGrid}>
          <View style={[styles.formColumn, { backgroundColor: palette.surface, borderColor: palette.divider }]}>
            <Text style={{ color: palette.text, fontWeight: '900' }}>Medication order</Text>
            <TextInput
              value={medOrderForm.drug_name}
              onChangeText={(value) => setMedOrderForm((prev) => ({ ...prev, drug_name: value }))}
              placeholder="Drug name"
              placeholderTextColor={palette.subtext}
              style={[styles.input, { backgroundColor: palette.card }]}
            />
            <TextInput
              value={medOrderForm.dosage}
              onChangeText={(value) => setMedOrderForm((prev) => ({ ...prev, dosage: value }))}
              placeholder="Dosage instructions"
              placeholderTextColor={palette.subtext}
              style={[styles.input, { backgroundColor: palette.card }]}
            />
            <TextInput
              value={medOrderForm.route}
              onChangeText={(value) => setMedOrderForm((prev) => ({ ...prev, route: value }))}
              placeholder="Route"
              placeholderTextColor={palette.subtext}
              style={[styles.input, { backgroundColor: palette.card }]}
            />
            <TextInput
              value={medOrderForm.frequency}
              onChangeText={(value) => setMedOrderForm((prev) => ({ ...prev, frequency: value }))}
              placeholder="Frequency"
              placeholderTextColor={palette.subtext}
              style={[styles.input, { backgroundColor: palette.card }]}
            />
            <TextInput
              value={medOrderForm.notes}
              onChangeText={(value) => setMedOrderForm((prev) => ({ ...prev, notes: value }))}
              placeholder="Notes"
              placeholderTextColor={palette.subtext}
              multiline
              style={[styles.input, styles.textArea, { backgroundColor: palette.card }]}
            />
            <KISButton
              title={medSubmitting ? 'Sending…' : 'Add order'}
              onPress={handleCreateMedicationOrder}
              size="sm"
              disabled={medSubmitting}
            />
          </View>
          <View style={[styles.formColumn, { backgroundColor: palette.surface, borderColor: palette.divider }]}>
            <Text style={{ color: palette.text, fontWeight: '900' }}>Vital signs</Text>
            <TextInput
              value={vitalForm.vital_type}
              onChangeText={(value) => setVitalForm((prev) => ({ ...prev, vital_type: value }))}
              placeholder="Vital type (e.g. BP)"
              placeholderTextColor={palette.subtext}
              style={[styles.input, { backgroundColor: palette.card }]}
            />
            <TextInput
              value={vitalForm.value}
              onChangeText={(value) => setVitalForm((prev) => ({ ...prev, value: value }))}
              placeholder="Value"
              placeholderTextColor={palette.subtext}
              keyboardType="numeric"
              style={[styles.input, { backgroundColor: palette.card }]}
            />
            <TextInput
              value={vitalForm.units}
              onChangeText={(value) => setVitalForm((prev) => ({ ...prev, units: value }))}
              placeholder="Units"
              placeholderTextColor={palette.subtext}
              style={[styles.input, { backgroundColor: palette.card }]}
            />
            <TextInput
              value={vitalForm.notes}
              onChangeText={(value) => setVitalForm((prev) => ({ ...prev, notes: value }))}
              placeholder="Notes"
              placeholderTextColor={palette.subtext}
              multiline
              style={[styles.input, styles.textArea, { backgroundColor: palette.card }]}
            />
            <KISButton
              title={vitalSubmitting ? 'Sending…' : 'Log vital'}
              onPress={handleCreateVitalSign}
              size="sm"
              disabled={vitalSubmitting}
            />
          </View>
        </View>
      </View>

      <View style={[styles.section, { backgroundColor: palette.card }]}>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>Groq AI triage</Text>
        <Text style={{ color: palette.subtext, marginBottom: 8 }}>
          Use the Groq advisory service to triage incoming symptoms in real time.
        </Text>
        {triageResult ? (
          <View style={[styles.resultBox, { borderColor: palette.divider }]}>
            <Text style={{ color: palette.text, fontSize: 12 }} selectable>
              {triageResult}
            </Text>
          </View>
        ) : (
          <Text style={{ color: palette.subtext, fontSize: 12 }}>
            Run an AI task to review a symptom set.
          </Text>
        )}
        <KISButton
          title={aiLoading ? 'Running…' : 'Run triage check'}
          onPress={handleRunTriage}
          disabled={aiLoading}
        />
      </View>
    </ScrollView>
  );
}

const makeStyles = (tokens: typeof KIS_TOKENS) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    section: {
      borderWidth: 2,
      borderRadius: tokens.radius.xl,
      padding: tokens.spacing.lg,
      marginHorizontal: tokens.spacing.lg,
      marginTop: tokens.spacing.md,
      gap: tokens.spacing.sm,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '900',
    },
    sectionHeading: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    card: {
      borderWidth: 2,
      borderRadius: tokens.radius.md,
      padding: tokens.spacing.sm,
      marginVertical: tokens.spacing.xs,
    },
    cardTitle: {
      fontWeight: '900',
      fontSize: 14,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    resultBox: {
      borderWidth: 2,
      borderRadius: tokens.radius.md,
      padding: tokens.spacing.sm,
      marginBottom: tokens.spacing.sm,
    },
    actionsRow: {
      flexDirection: 'row',
      marginTop: tokens.spacing.sm,
    },
    patientRow: {
      borderWidth: 2,
      borderRadius: tokens.radius.md,
      padding: tokens.spacing.sm,
      marginBottom: tokens.spacing.xs,
    },
    patientDetail: {
      borderWidth: 2,
      borderRadius: tokens.radius.md,
      padding: tokens.spacing.sm,
      marginTop: tokens.spacing.sm,
      gap: tokens.spacing.sm,
    },
    familyCard: {
      borderWidth: 2,
      borderRadius: tokens.radius.md,
      padding: tokens.spacing.sm,
      minWidth: 140,
    },
    consentRow: {
      borderWidth: 2,
      borderRadius: tokens.radius.md,
      padding: tokens.spacing.sm,
    },
    formGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: tokens.spacing.sm,
      marginBottom: tokens.spacing.sm,
    },
    formColumn: {
      flex: 1,
      minWidth: 200,
      borderWidth: 2,
      borderRadius: tokens.radius.md,
      padding: tokens.spacing.sm,
      gap: tokens.spacing.xs,
    },
    input: {
      borderWidth: 2,
      borderRadius: tokens.radius.md,
      paddingHorizontal: tokens.spacing.sm,
      paddingVertical: tokens.spacing.sm,
      borderColor: '#ccc',
    },
    textArea: {
      minHeight: 60,
      textAlignVertical: 'top',
    },
    timelineContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: tokens.spacing.sm,
      marginTop: tokens.spacing.sm,
    },
    timelineColumn: {
      flex: 1,
      minHeight: 220,
      borderWidth: 2,
      borderRadius: tokens.radius.md,
      padding: tokens.spacing.sm,
    },
    aiPanel: {
      flex: 1,
      minHeight: 220,
      borderWidth: 2,
      borderRadius: tokens.radius.md,
      padding: tokens.spacing.sm,
    },
    timelineEntry: {
      borderWidth: 2,
      borderRadius: tokens.radius.md,
      padding: tokens.spacing.sm,
      marginBottom: tokens.spacing.sm,
    },
    timelineLabel: {
      fontWeight: '700',
      fontSize: 13,
    },
    timelineTime: {
      fontSize: 11,
      marginTop: 4,
    },
  });
