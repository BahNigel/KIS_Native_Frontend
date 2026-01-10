# Enterprise Phase 5 Notes

Phase 5 focuses on access governance (requests + reviews) and scheduled exports.

## Django endpoints

Access governance:
- `GET/POST /api/v1/partners/{partnerId}/access-requests/`
- `POST /api/v1/partners/{partnerId}/access-requests/{requestId}/approve/`
- `POST /api/v1/partners/{partnerId}/access-requests/{requestId}/reject/`
- `GET/POST /api/v1/partners/{partnerId}/access-reviews/`
- `POST /api/v1/partners/{partnerId}/access-reviews/{reviewId}/close/`

Export schedules:
- `GET/POST /api/v1/partners/{partnerId}/export-schedules/`
- `PATCH /api/v1/partners/{partnerId}/export-schedules/{scheduleId}/`
- `POST /api/v1/partners/{partnerId}/export-schedules/{scheduleId}/remove/`
- `POST /api/v1/partners/{partnerId}/export-schedules/{scheduleId}/run/`

## Webhook + automation events

- `access.requested`
- `access.approved`
- `access.rejected`
