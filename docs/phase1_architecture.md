# Phase 1 — Groq-Enabled Healthcare Platform Architecture

## 1. Vision
Design a Groq-powered, multi-tenant medical platform supporting hospitals, clinics, labs, pharmacies, diagnostics, and wellness centers. Phase 1 documents the end-to-end architecture, services, data models, APIs, RBAC, Groq AI service, UI structure, operational workflows, and compliance/security map. Later phases will implement the backend and frontend.

---

## 2. Macro Architecture
```
                         ┌────────────────────────────┐
                         │   Global Application Shell  │
                         │  (profile switcher, alerts, │
                         │   emergency mode, search)    │
                         └─────────────┬──────────────┘
                                       │
   ┌────────────┐    ┌────────────┐    ▼    ┌────────────┐
   │  API Gate-  │────│ Event Bus  │────────►│ Command    │
   │  way/Auth   │    │(Kafka/ND)  │         │ Center     │
   └─────┬──────┘    └────┬──────┘         └────────────┘
         │               │
         ▼               ▼
 ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐
 │ Profile &  │ │ Patient    │ │ Staff      │ │ AI Service │
 │ Org Service│ │ Master     │ │ Service    │ │ (Groq APIs)│
 └─────┬──────┘ └────┬──────┘ └────┬──────┘ └────┬──────┘
       │              │             │            │
       ▼              ▼             ▼            ▼
  Microservices per domain: EHR,     Telemed,   Analytics, Billing, Compliance, Research
  Pharmacy, Lab, Imaging, Command Center, Notifications, Groq AI
 `````

### Key attributes
- **API-first microservices** with versioned REST/gRPC + GraphQL edge for UI.
- **Event-driven** via Kafka/NATS for commands, AI predictions, compliance events.
- **Real-time** streaming websockets for dashboards + AI assistant responses (Groq streaming).
- **Multi-tenant isolation**: profiles → tenants; schemas partitioned by `organization_id`.
- **Offline-first** clients with local cache and sync layer (PouchDB/SQLite).
- **HL7/FHIR** connectors bridging to NHS Spine & US HL7 interfaces.

---

## 3. Service Map & Data Models
### Microservices
1. **Profile & Org Service** – create/edit/suspend/delete multi-location health profiles (hospital, clinic, pharmacy, lab, diagnostics, wellness). Schema: `Organization`, `ProfileType`, `Location`, `Department`, `Ward`, `Service`, `Equipment`.
2. **Staff Service** – RBAC (roles, scopes, departments), credentials, shifts, licensing, on-call; schemas: `User`, `StaffProfile`, `License`, `Shift`, `AuditLog`.
3. **Patient Service** – Master patient index, family links, consent records. Tables: `Patient`, `FamilyMember`, `Consent`, `IdentityToken`.
4. **EHR/EMR Service** – longitudinal record, encounters, notes, meds, allergies, vitals; FHIR resources persisted.
5. **Scheduling & Operations** – Appointments, queues, ER operations, bed management, command center events, telemedicine sessions.
6. **Telemedicine Service** – video sessions (WebRTC), remote devices, voice dictation, AI assistant overlay.
7. **Pharmacy Service** – Rx workflow, inventory, controlled drugs (DEA logs), interactions.
8. **Lab & Imaging** – sample pipelines, machine queues, PACS-ready imaging metadata, abnormality console.
9. **Billing & Revenue Cycle** – claims, insurance, invoices, payments, denials.
10. **Analytics & Population Health** – dashboards, command center, reporting, AI predictions.
11. **Compliance & Security** – consent, audit logs, break-glass actions, retention rules.
12. **Research & Clinical Studies** – trial registry, cohorts, data exports.
13. **AI Service (Groq)** – centralized Groq integration, streaming, function calling, model switching, safety layers.
14. **Notification & Messaging** – alerts, task assignments, incident reporting.

### Sample Schemas
```sql
CREATE TABLE organization (
  id UUID PRIMARY KEY,
  name TEXT,
  type TEXT,
  status TEXT,
  tenant_id UUID,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

CREATE TABLE department (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES organization(id),
  name TEXT,
  ward BOOLEAN,
  clinical BOOLEAN
);

CREATE TABLE staff_profile (
  id UUID PRIMARY KEY,
  user_id UUID,
  organization_id UUID,
  role TEXT,
  scope JSONB,
  licenses JSONB,
  shifts JSONB,
  is_on_call BOOLEAN
);

CREATE TABLE patient (
  id UUID PRIMARY KEY,
  organization_id UUID,
  master_record TEXT,
  primary_provider UUID,
  family_links JSONB,
  consent JSONB,
  created_at TIMESTAMP
);
```

---

## 4. RBAC & Permission Model
- Hierarchical roles: super-admin, organization-admin, department-lead, clinician, nurse, lab, pharmacy tech, patient, external viewer.
- Scope-based rights per location/dept/service; field-level encryption guarded by `permissions` table.
- Emergency mode allows break-glass rights with additional audit log entry.
- Consent-aware gating (patient consent stored per record; access includes consent check).

---

## 5. API Contracts (Phase 1 targets)
1. `POST /api/v1/organizations/` – create profile with departments/services.
2. `PATCH /api/v1/profiles/{id}` – edit/suspend/verify.
3. `POST /api/v1/staff/roles` – assign, update RBAC, licensing.
4. `GET /api/v1/patients/search` – universal patient search across tenants.
5. `POST /api/v1/ehr/encounters` – create encounter, include AI hooks.
6. `POST /api/v1/appointments` – schedule with queues, telemedicine.
7. `POST /api/v1/orders/medications` – Rx orders verifying interactions via Groq AI.
8. `POST /api/v1/lab/orders` – pipeline + telemetry.
9. `GET /api/v1/command-center` – aggregated command state, bed occupancy, staff radar.
10. `POST /api/v1/ai/stream` – Groq streaming, function calls, safety gating.
11. `POST /api/v1/compliance/audit` – log immutable audit entry.

Each API enforces zero-trust (JWT + mutual TLS, per-tenant headers), logs prompts/AI decisions, and emits events to Kafka.

---

## 6. Groq AI Service Architecture
- **Gateway** handles tenant routing, identity, and model selection (triage, differential, assistant).
- **Streaming layer** uses WebSocket + SSE for AI responses; hooks into `GroqAIClient` using Groq streaming API.
- **Function calling** for domain actions (e.g., triage response, order suggestions, prescription validation).
- **Task router** analyzes prompt type (triage, forecasting, scheduling) and switches Groq models accordingly (Groq-1, Groq-2).
- **Safety layers:** input sanitization (patient PHI masking), risk gating (if output flagged high risk escalate to clinician), auditing (log prompts/responses + tenant metadata), fallback assistant for ambiguous results.
- **Model orchestration:** Groq pipeline can call specialized models, blend with hospital data, support rule-based overrides.

Flow:
1. UI request hits `GET /api/v1/ai/stream?mode=triage`.
2. AI Service validates, attaches patient identifier, triggers Groq streaming endpoint.
3. Streaming response sent over WebSocket to UI (doctor workspace, command center).
4. Service logs prompt/outcome, raises event for analytics/compliance.

---

## 7. UI/UX Structure (Global + Screens)
1. **Global Shell:** profile switcher, emergency toggle, universal patient search, alerts bar, offline/role indicators.   
2. **Management Panel:** profile cards, dept/wards, staff management, services, compliance docs, AI center (Groq dashboards).  
3. **Command Center:** live patient flow wall, ER/ICU status, bed grid, staff radar, alerts, equipment telemetry, AI predictions.  
4. **Doctor workspace:** patient timeline, orders/prescriptions, imaging viewer, risk alerts, voice dictation (Groq speech-to-text), AI clinical assistant sidebar (Groq chat).  
5. **Nurse UI:** ward dashboards, medication rounds, task handovers, vitals capture (offline ready), incident reporting.  
6. **Lab UI:** sample pipeline, machine queue, validation console, report builder, abnormal alert highlighting (Groq detection).  
7. **Pharmacy UI:** Rx workflow, inventory/expiry, controlled logs, interaction warnings (Groq), dispensing console.  
8. **Patient App:** health timeline, appointments, telemedicine, meds/adherence, lab data, AI health assistant, emergency wallet, family profiles, wellness plans.
9. **AI center:** interactive Groq chat, triage assistant, voice dictation, predictions embedded in command center and staff UIs.

UI principles: zero ambiguity, minimal load, emergency-safe colors, WCAG compliance, fat-finger spacing, dark mode for wards, offline-first flows.

---

## 8. Clinical & Operational Workflows
1. **Triage → AI Support:** Patient enters symptom data → Groq triage triages → triage results recorded in EHR → doctor notified with Groq recommendations.  
2. **Medication order:** Order created → AI service checks interactions/allergies → pharmacist notified.  
3. **Bed command:** Admissions update bed grid → AI service forecasts patient flow + alerts command center.  
4. **Lab pipeline:** Sample logged → imaging results streamed to Groq for interpretation → notify clinician.  
5. **Research cohort:** Data extracted with consent → AI summarization for studies.

---

## 9. Compliance & Security Mapping
| Requirement | Controls |
|-------------|----------|
| HIPAA/GDPR | Encryption in transit/at rest, consent gate, audit logs, breach notifications. |
| NHS DSP | Data residency per region, NHS Spine-ready connectors, access reviews. |
| SOC-2 | Monitoring, incident response, separation of duties. |
| Zero Trust | Fine-grained policies, session/device management, MFA, emergency break-glass. |
| Audit & Logging | Immutable audit logs for data access, AI prompts/responses, attachments. |
| Field encryption | Sensitive fields (PHI) masked/encrypted; use HSM-backed keys. |

---

## 10. Deployment & Scaling (Phase 1 target)
- **Infra**: Kubernetes with multi-region clusters, managed Postgres, Kafka, Redis, object storage (S3) for attachments.  
- **Security**: WAF, API gateway, Istio/Linkerd for mTLS, secrets manager for tenants.  
- **Groq AI Service** deployed as dedicated pod/service with autoscaling; communicates with Groq endpoints via secure API keys.  
- **Monitoring**: OpenTelemetry, Grafana, ELK for logs/audit, SLO alerts.  
- **CI/CD**: pipelines for backend (Django), frontend (React Native), Groq AI service tests.

## Next steps
Phase 2 will implement the backend services, Groq AI integration, and API contracts defined above. Phase 3 will build the React Native UI/UX scaffolding.
