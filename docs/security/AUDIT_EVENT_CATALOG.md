# Audit Event Catalog

## Status

Implemented in Epic 002 Phase 12.

Every audit event uses an immutable name and explicit version. Version `1` is the initial contract for all events listed here.

## Identity Events

| Event                                   | Version |
| --------------------------------------- | ------- |
| `IDENTITY_REGISTERED`                   | 1       |
| `LOGIN_SUCCEEDED`                       | 1       |
| `LOGIN_FAILED`                          | 1       |
| `LOGOUT_COMPLETED`                      | 1       |
| `SESSION_CREATED`                       | 1       |
| `SESSION_REVOKED`                       | 1       |
| `ALL_SESSIONS_REVOKED`                  | 1       |
| `REFRESH_TOKEN_ROTATED`                 | 1       |
| `REFRESH_TOKEN_REUSE_DETECTED`          | 1       |
| `EMAIL_VERIFICATION_REQUESTED`          | 1       |
| `EMAIL_VERIFICATION_RESENT`             | 1       |
| `EMAIL_VERIFIED`                        | 1       |
| `EMAIL_VERIFICATION_FAILED`             | 1       |
| `EMAIL_VERIFICATION_EXPIRED`            | 1       |
| `PASSWORD_CHANGED`                      | 1       |
| `PASSWORD_RESET_REQUESTED`              | 1       |
| `PASSWORD_RESET_RESENT`                 | 1       |
| `PASSWORD_RESET_COMPLETED`              | 1       |
| `PASSWORD_RESET_FAILED`                 | 1       |
| `PASSWORD_RESET_EXPIRED`                | 1       |
| `PASSWORD_CREDENTIAL_REPLACED`          | 1       |
| `SESSIONS_REVOKED_AFTER_PASSWORD_RESET` | 1       |
| `IDENTITY_SUSPENDED`                    | 1       |
| `SESSION_EXPIRED`                       | 1       |
| `NEW_DEVICE`                            | 1       |
| `SUSPICIOUS_LOGIN`                      | 1       |
| `CONCURRENT_LOGIN_LIMIT_REACHED`        | 1       |
| `ADMINISTRATOR_SESSION_REVOKED`         | 1       |
| `SECURITY_POLICY_VIOLATION`             | 1       |

## Organization Events

| Event                          | Version |
| ------------------------------ | ------- |
| `ORGANIZATION_CREATED`         | 1       |
| `ORGANIZATION_ACTIVATED`       | 1       |
| `ORGANIZATION_SUSPENDED`       | 1       |
| `ORGANIZATION_REACTIVATED`     | 1       |
| `ORGANIZATION_CLOSED`          | 1       |
| `ORGANIZATION_ARCHIVED`        | 1       |
| `ORGANIZATION_PROFILE_UPDATED` | 1       |

## Membership and Invitation Events

| Event                     | Version |
| ------------------------- | ------- |
| `MEMBERSHIP_CREATED`      | 1       |
| `MEMBERSHIP_ROLE_CHANGED` | 1       |
| `MEMBERSHIP_SUSPENDED`    | 1       |
| `MEMBERSHIP_REMOVED`      | 1       |
| `INVITATION_CREATED`      | 1       |
| `INVITATION_REVOKED`      | 1       |
| `INVITATION_EXPIRED`      | 1       |
| `INVITATION_ACCEPTED`     | 1       |
| `OWNERSHIP_TRANSFERRED`   | 1       |

## Authorization and Tenancy Events

| Event                             | Version |
| --------------------------------- | ------- |
| `PERMISSION_DENIED`               | 1       |
| `POLICY_DENIED`                   | 1       |
| `CROSS_TENANT_ACCESS_REQUESTED`   | 1       |
| `CROSS_TENANT_ACCESS_PERFORMED`   | 1       |
| `PLATFORM_ADMIN_ACTION_PERFORMED` | 1       |
| `TENANT_CONTEXT_REJECTED`         | 1       |
| `RLS_OPERATION_DENIED`            | 1       |

## Contract Rules

- Do not change the meaning of an existing event version.
- Add a new version for incompatible payload changes.
- Do not include raw secrets, tokens, passwords, authorization headers, cookies or unrestricted request bodies.
- Prefer identifiers and redacted metadata.
