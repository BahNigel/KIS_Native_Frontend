# Organization App Phases

This document captures what each phase accomplished so later contributors (or a future model) can pick up from the right place.

## Phase 1 – Partner UI surfaces (completed)
- **Goals:** Fetch organization apps, render floating buttons, support catalog.
- **Deliverables:** `PartnerAppLaunchBar`, `PartnerOrganizationAppsPanel`, `PartnerLayout`, `PartnersScreen` logic for tab visibility and panel wiring.
- **Notes:** No runtime embedding, external links handled via `Linking`; future phases build on this UI scaffolding.

## Phase 2 – In-app runtime container (completed)
- **Goals:** Provide a dedicated `OrganizationApp` route that opens inside KIS with partner metadata.
- **Deliverables:** Root navigation entry (`App.tsx`, `RootStackParamList`), `OrganizationAppScreen`, nav wiring from launch bar and catalog, placeholder content describing embed/AI experience.
- **Notes:** The screen currently explains that a secure WebView/SDK will host the embed later; the “Open externally” button is temporary.

## Phase 3 – Permissions & AI data connector (in progress)
- **Goals:** Log app access, surface consent controls, support data scopes.
- **Deliverables so far:** `PartnerOrganizationAppAccessLog` model + migration, serializer, view action; service helper `log_organization_app_access`; `ROUTES.partners.organizationAppAccessLog`; `OrganizationAppScreen` now loads logs, shows toggle for data sharing, posts access logs via API.
- **Next steps (pending):** Ensure partner metadata contains data scope defaults, upgrade embed container to interpret `metadata.dataAccess` for real gating, and build UI for role-based visibility tweaks.

Any new phase should append below and note its dependencies.
