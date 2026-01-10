# Enterprise Phase 6 Notes

Phase 6 focuses on webhook delivery logging and retries for enterprise reliability.

## Django endpoints

- `GET /api/v1/partners/{partnerId}/webhooks/{webhookId}/deliveries/`
- `POST /api/v1/partners/{partnerId}/webhooks/{webhookId}/deliveries/{deliveryId}/retry/`

## Notes

- Each webhook delivery is logged with status, attempts, and next retry time.
- Webhooks now store retry settings (`retry_limit`, `retry_backoff_seconds`).
