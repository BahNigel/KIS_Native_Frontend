# Phase 2 — Groq-powered Healthcare Platform (Phase 2 Deliverables)

## 1. Executive Summary
- Multi-tenant, hospital-grade platform for large US/UK hospitals (hospitals, clinics, labs, pharmacies, diagnostics, wellness centers).  
- AI-first, Groq-powered intelligence service handles every symptom, triage, decision support, analytics, and automation use case.  
- Modular microservices, API-first, event-driven, real-time, HL7/FHIR-ready, HIPAA/GDPR/SOC-2 compliant.  
- UI/UX built for clinical clarity (zero ambiguity, fat-finger spacing, emergency-safe colors, dark mode for wards, offline-first).  
- Phase 2 focuses on detailed architecture, data models, APIs, Groq AI service, UI/UX structure, workflows, and compliance mapping required before coding.  

## 2. Global System Architecture Overview

```
                          [Global Application Shell]
  Profile switcher + emergency toggle + patient search + alerts + role-aware nav
                               │
                               ▼
      ┌──────────────┬──────────────┬──────────────┬──────────────┐
      │ API Gateway  │ Auth/ZTAC   │ Event Bus    │ Groq AI Hub  │
      └──────┬───────┴──────┬───────┴──────┬───────┴───────┘
             ▼               ▼              ▼
 ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
 │ Profile & Org   │ │ Staff & RBAC    │ │ Patient & EHR   │
 └──┬──────────────┘ └────┬────────────┘ └────┬────────────┘
    ▼                     ▼                   ▼
 ┌────────────┐   ┌────────────┐   ┌────────────┐
 │ Ops/Command│   │ Pharmacy   │   │ Lab/Imaging│
 └────────────┘   └────────────┘   └────────────┘
             └──┬──────────────┬────┘
                ▼              ▼
        ┌────────────────────────────┐
        │ Analytics / Revenue / Audit │
        └────────────────────────────┘
```

- **API Gateway/Auth** (zero-trust, mutual TLS, tenant-aware JWT).  
- **Event Bus** (Kafka/NATS) routes streams (appointments, AI prompts, audit events).  
- **Groq AI Hub** is centralized AI Service (streaming, function calling, safety).  
- **Microservices**: Profile, Staff, Patient/EHR, Appointments/Operations, Pharmacy, Lab/Imaging, Billing/Revenue, Analytics/Compliance, Research.  
- Real-time websockets for dashboards, command center, AI streaming.  
- Offline support via local cache (SQLite/Pouch) and synchronization layer.

## 3. Microservice Map
| Service | Responsibilities | Interfaces |
| --- | --- | --- |
| **Profile & Org Service** | Manage hospitals/clinics/labs/pharmacies/diagnostics/wellness profiles, departments, wards, services, equipment, multi-location switch, verify/suspend/delete. | REST GraphQL: `/api/v2/organizations`, `/api/v2/profiles/{id}`; events to Command Center + Audit. |
| **Staff Service** | RBAC roles/scopes, licenses, shifts, on-call, access logs, credential verification, audit trail storage. | `/api/v2/staff`, `/api/v2/staff/{id}/shifts`, `/api/v2/staff/{id}/audit`. |
| **Patient & Master Index** | Patient search, family linking, consent, identity tokens, emergency access (break glass). | `/api/v2/patients/search`, `/api/v2/patients/{id}/consents`. |
| **EHR/EMR Service** | Longitudinal timeline, encounters, orders, medications, allergies, vitals, HL7/FHIR resources. | FHIR APIs + `/api/v2/encounters`, `/api/v2/medications`, `/fhir/`. |
| **Appointments & Operations** | Scheduling, queues, ER/hospital ops, bed tracking, telemedicine sessions, command center signals. | `/api/v2/appointments`, `/api/v2/bed-occupancy`, `/api/v2/queues`. |
| **Telemedicine Service** | Video/voice sessions (WebRTC), dictation ingestion, remote monitoring integration. | `/api/v2/telemedicine/sessions`, `/api/v2/dictation`. |
| **Pharmacy Service** | Rx workflow, inventory, expiry, interaction warnings, dispensing console, controlled drug logs. | `/api/v2/pharmacy/prescriptions`, `/api/v2/pharmacy/inventory`. |
| **Lab & Imaging Service** | Sample pipeline, machine queues, PACS-ready imaging metadata, abnormality detection console. | `/api/v2/lab/orders`, `/api/v2/imaging/results`. |
| **Billing & Revenue Cycle** | Claims, insurance, invoices, payments, denials, credit ledger. | `/api/v2/billing`, `/api/v2/insurance`. |
| **Analytics & Population Health** | Dashboards, command center, reporting, population stats, forecasting. | `/api/v2/analytics`, real-time websocket board. |
| **Compliance & Security** | Consent gating, audit log, break-glass logging, disaster recovery triggers. | `/api/v2/compliance/audit`, HSM-backed encryption. |
| **Research & Clinical Studies** | Trial registry, cohorts, exports, Groq summarization. | `/api/v2/research/cohorts`. |
| **Notification & Messaging** | Alerts, tasks, incident reporting, staff assignments. | `/api/v2/notifications`, webhooks to AI service + command center. |
| **Groq AI Service** | Central AI routing, streaming, safety, audit, tasks (detailed below). | `/api/v2/ai/stream`, `/api/v2/ai/predict`, WebSocket SSE. |

## 4. Database Schemas (simplified)

### organizations
```
id UUID PK, tenant_id UUID, name TEXT, type TEXT, status TEXT, region TEXT, created_at TIMESTAMP, updated_at TIMESTAMP
```

### profiles
```
id UUID PK, organization_id FK, profile_type TEXT (hospital/clinic/...), name TEXT, slug TEXT, status TEXT, metadata JSONB (departments/wards/services/equipment), location JSONB, created_by UUID, updated_at TIMESTAMP
```

### staff_profiles
```
id PK, user_id UUID, profile_id FK, role TEXT, permissions JSONB, licenses JSONB, shifts JSONB, on_call BOOL, scope JSONB, created_at TIMESTAMP
```

### patients
```
id PK, tenant_id UUID, master_record JSONB, demographics JSONB, consent JSONB, family JSONB, primary_provider UUID, created_at TIMESTAMP
```

### encounters
```
id PK, patient_id FK, profile_id FK, clinician_id UUID, summary TEXT, notes TEXT, orders JSONB, ai_insights JSONB, created_at TIMESTAMP
```

### operations
```
id PK, profile_id FK, type TEXT, status TEXT, data JSONB, timestamp TIMESTAMP
```

### ai_prompts
```
id PK, user_id UUID, profile_id FK, prompt TEXT, model TEXT, mode TEXT, inputs JSONB, outputs JSONB, risk_score NUMERIC, created_at TIMESTAMP
```

### audit_logs
```
id PK, tenant_id UUID, user_id UUID, action TEXT, resource_type TEXT, resource_id UUID, metadata JSONB, created_at TIMESTAMP, immutable BOOLEAN DEFAULT TRUE
```

## 5. RBAC & Permission Model
- **Roles**: super-admin, organization-admin, department-lead, clinician, nurse, lab-tech, pharmacy-tech, patient, research-analyst, emergency first responder.  
- **Scopes**: per profile, department, ward, service.  
- **Access controls** stored as JSONB in `staff_profiles.permissions`, includes allowed actions and field-level gating (e.g., PHI fields require `scope.clinical_detail`).  
- **Emergency “break-glass”** toggled via UI (global shell) which grants temporary `emergency` scope; actions recorded with `break_glass: true` in audit log.  
- **Consent-aware gating** – patient records include consent JSON; RBAC checks consent flags before read/write.  
- **Zero-trust** – API gateway validates tenant headers, enforces MFA, device binding, session expiration.  

## 6. API Contracts (selected)
1. **Organization & Profiles**  
   - `POST /api/v2/organizations/` – create organization with tenant metadata, lead admin, region.  
   - `GET /api/v2/profiles/` – list user-accessible profiles (with multi-location).  
   - `PATCH /api/v2/profiles/{id}` – edit name/status/verify/suspend.  
   - `POST /api/v2/profiles/{id}/switch` – change active profile in shell.  

2. **Staff**  
   - `POST /api/v2/staff/roles` – assign roles, scopes, shift templates.  
   - `GET /api/v2/staff/{id}/shifts` – fetch scheduled shifts with on-call flags.  
   - `POST /api/v2/staff/{id}/audit` – log credential/license changes.  

3. **Patient & EHR**  
   - `GET /api/v2/patients/search?q=` – universal patient search (RW).  
   - `POST /api/v2/encounters` – record encounter with orders, notes, attachments, inline AI insights (Groq).  
   - `POST /api/v2/medications` – order RX verifying interactions via AI.  
   - `POST /fhir/MedicationRequest` – HL7/FHIR compliant order.  

4. **Operations & Command Center**  
   - `POST /api/v2/appointments` – schedule appointment + queue/ER assignment; emits event to command center.  
   - `GET /api/v2/bed-occupancy` – live grid streaming via WebSocket (push updates).  
   - `POST /api/v2/queues/{id}/dispatch` – assign staff.  

5. **Telemedicine & Dictation**  
   - `POST /api/v2/telemedicine/sessions` – create room, record, integrate Groq dictation streaming.  
   - `POST /api/v2/dictation` – audio stream -> Groq transcription -> attach to encounter.  

6. **AI Service (Groq)**  
   - `POST /api/v2/ai/stream` – stream prompt/responses via WebSocket/SSE; supports function calling (e.g., triage, scheduling).  
   - `POST /api/v2/ai/task` – queue/route domain-specific tasks using model switching.  

7. **Billing & Compliance**  
   - `POST /api/v2/billing/claims` – submit claim, track status.  
   - `POST /api/v2/compliance/audit` – immutable logging; invoked by every sensitive action (including AI prompts).  

## 7. Groq AI Service Architecture
- **Gateway**: receives UI prompts, enriches with tenant metadata, identifies mode (triage, decision, scheduling).  
- **Task Router**: Based on intent, routes to specialized Groq models (triage, differential, drug safety, forecasting).  
- **Streaming Layer**: SSE/WebSocket bridging Groq streaming API to RN clients (doctors, nurses, command center).  
- **Function Calling**: Templates for triage (collect vitals), Rx interactions (call pharmacist service), scheduling (shift optimizer).  
- **Safety Layer**: Input sanitization (PHI masking), risk scoring (if output flagged “high”, bubble to human), fallback to clinician, log gating.  
- **Audit & Logging**: `ai_prompts` table records prompt, model, decision, bias score, version.  
- **Model Switching**: Weighted service routes triage -> `groq-triage-v1`, lab interpretation -> `groq-interpret-v1`, fill fallback.  
- **Streaming Observability**: Stats (latency, tokens) forwarded to Analytics service, triggers alert if abnormal.  

## 8. UI/UX Screen Structure
1. **Global Application Shell** (`ShellNavigator` for RN):  
   - Profile switcher dropdown (multilocation).  
   - Emergency mode toggle (break-glass).  
   - Universal patient search bar (predictive).  
   - Alerts bar (push notifications).  
   - Role-aware nav (tabs for Command Center, Patients, Staff, AI Center, Profile).  
   - Accessibility/offline indicators (icon + tooltip).  

2. **Management Panel** (dashboard route with cards):  
   - Cards per profile type (hospital, clinic, lab, pharmacy, diagnostics, wellness).  
   - Buttons: Manage departments/wards, assign staff, upload compliance docs, open AI center.  
   - Staff & permissions list with inline edit, shift assignment, license upload.  

3. **Hospital Command Center**:  
   - Live patient flow wall (grid + stats).  
   - ER/ICU status boards (color-coded: green, yellow, red).  
   - Bed occupancy grid (tile map).  
   - Staff availability radar (circular chart).  
   - Critical alerts feed (high priority, ack).  
   - Equipment monitoring panel (IoT telemetry).  
   - AI predictions/risk panel (Groq outputs).  

4. **Clinical Workspaces**:  
   - **Doctor UI**: patient timeline, orders/prescriptions, diagnostics/imaging viewer, alerts, AI sidebar (Groq chatbot + suggestions), voice dictation button streaming to backend.  
   - **Nurse UI**: ward dashboard, medication rounds checklist, task/handover list, vitals capture form (offline sync), incident report.  
   - **Lab UI**: sample pipeline table, machine queue statuses, abnormal result highlight, validation console, report builder.  
   - **Pharmacy UI**: prescription workflow, inventory board (expiry), controlled drug log, interaction warnings (Groq flagged), dispensing console.  

5. **Patient Application** (mobile/responsive):  
   - Health timeline (meds, visits).  
   - Appointments & telemedicine tile.  
   - Medications tracker & adherence reminders.  
   - Lab/imaging results viewer (PACS links).  
   - AI health assistant (Groq chatbot).  
   - Emergency medical wallet (critical data).  
   - Family profiles (multi-member).  
   - Wellness plans + rehabilitation tasks.  

## 9. Clinical & Operational Workflows
1. **Symptom/Triage**: Patient enters data → `POST /ai/stream?mode=triage` → Groq triage assistant returns acuity + suggested department → record in encounter + queue.  
2. **Medication order**: Prescriber orders Rx → Groq decision/prediction model checks allergies/interactions → alerts pharmacist UI + logs AI decision.  
3. **Bed & flow**: Admissions updates bed occupancy → event publishes to command center + Groq forecasting service predicts demand.  
4. **Lab/imaging**: Sample recorded → Groq imaging interpretation invoked → abnormality flagged in Lab UI + clinician notified.  
5. **Research**: Cohorts defined → Groq summarization extracts insights + compliance service logs usage.  

## 10. Security & Compliance Mapping
- **HIPAA/GDPR/SOC-2**: Encryption (TLS 1.3), consent gating before PHI access, immutable audit logs, data residency per region.  
- **Zero Trust & Break-Glass**: Device/session management, emergency toggle writes `break_glass` event, re-auth & audit.  
- **Field Encryption**: PHI fields encrypted (HSM) in DB; `api/v2/compliance/audit` enforces immutability.  
- **Consent-aware access**: Consent JSON checked before reading patient details; UI surfaces consent/historical snapshot.  
- **Disaster Recovery**: Backups to multi-region object storage, hot standby database, automation tests for failover.  

## 11. Deployment & Scaling Architecture
- Kubernetes (EKS/AKS) multi-region with tenant isolation per namespace.  
- Managed Postgres + Cockroach for multi-tenant data.  
- Kafka/NATS for event bus; Redis for cache/leader election.  
- Object storage (S3-compatible) for attachments/build Groq models.  
- API Gateway (Istio/Linkerd service mesh) with mutual TLS + rate limiting per tenant.  
- CI/CD pipelines: Django backend, RN frontend, Groq AI service; tests run for each PR.  
- Monitoring: OpenTelemetry + Prometheus + Grafana + ELK for logs.  
- Groq AI Service runs dedicated pods with autoscaling tied to streaming load; integrates Groq streaming API using secure keys and logs to audit.  

## 12. Next Steps (Phase 3 Preview)
- Implement all backend services (Django microservices, Groq service, event listeners).  
- Build React Native UI per screens above with offline sync, attachments, multi-tenant awareness.  
- Wire Groq AI prompts via streaming endpoints with safety gating and logging.  
- Deploy dev/staging clusters, run load/clinical scenario testing, and validate compliance hooks.
