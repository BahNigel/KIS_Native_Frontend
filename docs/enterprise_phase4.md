# Enterprise Phase 4 Notes

Phase 4 focuses on provider integrations, automation rules, and reporting/exports.

## Django endpoints

Automation:
- `GET/POST /api/v1/partners/{partnerId}/automation-rules/`
- `PATCH /api/v1/partners/{partnerId}/automation-rules/{ruleId}/`
- `POST /api/v1/partners/{partnerId}/automation-rules/{ruleId}/remove/`

Reporting:
- `GET /api/v1/partners/{partnerId}/reports/summary/`
- `GET/POST /api/v1/partners/{partnerId}/exports/`

## Automation triggers

Currently emitted events:
- `member.joined`
- `role.changed`
- `policy.updated`
- `partner.post.created`
- `partner.post.commented`
- `partner.post.reacted`

## Export kinds

- `summary`
- `members`
- `roles`
- `audit`
- `posts`
- `applications`

## Notes

- Exports are written to `media/exports/{partnerId}/...` and returned as `file_path`.
- SSO/SCIM integrations remain stored in `partner_integration.config` for now.
