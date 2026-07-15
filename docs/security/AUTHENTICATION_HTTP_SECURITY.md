# Authentication HTTP Security

## Scope

The HTTP layer adapts approved Identity application services. It does not own business rules for
registration, sessions, refresh-token rotation, email verification or password reset.

## Request Validation

Authentication inputs use explicit DTO validation with `class-validator`.

The global validation pipe enforces:

```text
whitelist = true
forbidNonWhitelisted = true
transform = true
```

DTOs validate email shape, password length, token length, UUID parameters and required fields.

## Cookie Strategy

Refresh tokens use the `__Host-seneve_refresh` cookie.

Cookie attributes:

```text
HttpOnly
SameSite=Lax
Path=/api/v1/auth
Secure=true when AUTH_COOKIE_SECURE=true
```

Refresh-token values are not returned in JSON responses.

## CSRF Strategy

Because refresh tokens are cookie transported, `HttpOnly` alone is not treated as CSRF protection.

Phase 13 implements:

- `SameSite=Lax` refresh cookie protection;
- explicit origin validation for state-changing requests when the `Origin` header is present;
- credentialed CORS only for configured origins;
- no wildcard CORS with credentials.

A dedicated CSRF token may be added later if cross-site browser flows require it.

## Access-Token Guard

The guard:

1. extracts a bearer token;
2. verifies signature, issuer, audience and expiry through the token verifier abstraction;
3. validates the associated session and identity through a session validator;
4. rejects revoked, expired or foreign sessions;
5. rejects suspended or closed identities;
6. establishes authenticated request metadata for the controller.

Organization roles and permissions are not embedded in access tokens during this phase.

## Rate Limiting

The API module introduces a Redis-backed rate-limiter boundary for runtime use.

Rate-limit keys are hashed before storage. Plaintext emails are not used as Redis keys.

An in-memory limiter exists for tests and local fallback scenarios only. It is not a production
distributed rate limiter.

## Audit Integration

HTTP handlers do not construct arbitrary audit payloads.

Identity application services emit security events. The configured security-event recorder maps
those events into the generic Audit subsystem where workflow integration supports it.

PostgreSQL validation for Audit and RLS remains pending until the database-backed suite can run.

## Security Headers

The API bootstrap configures Helmet and marks authentication responses as:

```text
Cache-Control: no-store
```

Production deployments must configure HTTPS and `AUTH_COOKIE_SECURE=true`.
