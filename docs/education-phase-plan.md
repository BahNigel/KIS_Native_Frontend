# Broadcast Education Roadmap

**Last updated:** January 25, 2026

## Summary
- Progress so far: the broadcast education tab is driven by `EducationDiscoverPage` + `useEducationData`, fetching live lessons, bible courses, and education-profile courses; partners already have a Create-managed education profile and a broadcast endpoint (`/api/v1/broadcasts/education/courses/broadcast/`).
- Backend references: frontend points at the Django codebase under `/Users/nigel/All other files/CC/KIS/main_kis_bakend/backend/kis`, especially `apps/broadcasts/views.py` (lesson list, profile management, course broadcast) plus `apps/broadcasts/serializers.py`. The react-native frontend (no expo) lives in `/Users/nigel/dev/KIS`.
- Constraint reminder: **do not run any git commands or modify git history until explicitly told.**

## Long-term objectives (Coursera-level education experience)
1. **Streaming catalog + broadcast-feed sync**
2. **Partner/education-profile orchestration**
3. **Learner lifecycle & analytics (milestones, certs)**

## Phases
### Phase 1 — Stabilize the foundation (current focus)
- Ensure the education tab shows every partner/education-profile asset (courses, lessons, workshops) from the backend so the feed stays live.
- Let partners broadcast courses directly from the education UI using the `/api/v1/broadcasts/education/courses/broadcast/` endpoint (metadata includes partner/course info). Keep the UI untouched while wiring the network calls.
- Fix attachment handling in the broadcast feed detail view so a single feed item with multiple attachments becomes a full-width carousel with left/right buttons (matching the existing trending experience).
- Deliverable: working Coursera-style catalog kicker ready for Phase 2.

### Phase 1 progress
- ✅ Implemented the carousel in `BroadcastDetailScreen` so that every attachment fills the card just like the trending feed.
- ✅ Captured the roadmap, dependencies, and no-git constraint for future agents.
- ✅ Extended the education tab to surface education-profile workshops/modules with resource links and CTAs that open the Broadcast profile controls.
- ⏳ Remaining Phase 1 work: verify the education tab fully surfaces the backend lessons/courses/workshops (including partner-created education profiles), expose enrollment actions, and document any missing endpoints before moving on to course management.

### Phase 2 — Course management & engagement
- ✅ Added module/workshop management controls inside the education profile console (module list, resource links, CTA to profile, module form that submits to `manageProfileSection('education_profile')`).
- ✅ Surfaced learner insights (upcoming lessons, enrollments) plus analytics refresh and placeholder live-session tools.
- ⏳ Next: turn the analytics into granular cohort dashboards, add assessments/reminders, and capture live-session recordings before Phase 3.

### Phase 3 — Experience polish & certification
- ✅ Delivered certification performance (vault, completion progress, upcoming badge insights) and discovery flows in the education tab.
- ✅ Wallet summary + “Add credits” buttons now open the wallet sheet via `DeviceEventEmitter('wallet.open')`, and certificates are sourced from `/api/v1/bible/credentials/`.
- ⏳ Next: evolve the certification sharing workflow, run commerce/lesson analytics, and build deeper discovery/signature playlists for micro-credentials.

## Next steps
1. Iterate on certification sharing, gamified badges, and commerce bundles for paid enrollments while gleaning analytics from future backend endpoints.
2. Keep this document as the single source of truth so future agents can pick up further education enhancements without re-planning.
