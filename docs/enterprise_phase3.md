# Enterprise Phase 3 Notes

This phase adds placeholder integrations (SSO/SCIM) and webhooks, plus the wiring
needed for future providers.

## Django endpoints

- `GET/POST /api/v1/partners/{partnerId}/integrations/`
- `PATCH /api/v1/partners/{partnerId}/integrations/{integrationId}/`
- `GET/POST /api/v1/partners/{partnerId}/webhooks/`
- `PATCH /api/v1/partners/{partnerId}/webhooks/{webhookId}/`
- `POST /api/v1/partners/{partnerId}/webhooks/{webhookId}/remove/`

## Nest integration checks

Nest now calls a policy check endpoint before send/edit/delete:
- `POST /api/v1/chat/conversations/{conversationId}/policy-check/`

Required headers:
- `X-Internal-Auth: <DJANGO_INTERNAL_TOKEN>`
- optional `Authorization: Bearer <JWT>`

## Environment variables

Django:
- `DJANGO_INTERNAL_TOKEN` (required)
- `DJANGO_AUTH_SCHEME` (optional, defaults to Bearer)

Nest:
- `DJANGO_API_URL` (base URL for Django API)
- `DJANGO_INTERNAL_TOKEN` (same as Django)
- `DJANGO_CONV_POLICY_CHECK_URL` (optional override)

## Webhook events (placeholder)

Suggested event names to standardize later:
- `message.created`
- `message.edited`
- `message.deleted`
- `member.joined`
- `member.removed`
- `role.changed`
- `policy.updated`

Currently dispatched from Django partner actions:
- `member.joined` (subscribe, auto-approve, approve application)
- `role.changed` (role assignment add/remove, admin add/remove)
- `policy.updated` (policy updates)
