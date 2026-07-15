# Authentication API

## Status

Epic 002 Phase 13 exposes the approved Identity workflows through the NestJS REST boundary.

Organization APIs, frontend pages, external email delivery, MFA, social login, passkeys and SSO
remain out of scope.

## Base Path

```text
/api/v1/auth
```

## Token Transport

Access tokens are returned in JSON responses and are intended for short-lived bearer use.

Refresh tokens are transported through the `__Host-seneve_refresh` HTTP cookie. The cookie is
`HttpOnly`, `SameSite=Lax`, scoped to `/api/v1/auth`, and uses `Secure` when
`AUTH_COOKIE_SECURE=true`.

Refresh tokens are never returned in normal JSON responses.

## Implemented Endpoints

```text
POST   /register
POST   /login
POST   /refresh
POST   /logout
POST   /logout-all
POST   /email-verification/request
POST   /email-verification/resend
POST   /email-verification/complete
POST   /password-reset/request
POST   /password-reset/complete
GET    /sessions
DELETE /sessions/:sessionId
DELETE /sessions
```

Protected endpoints require a bearer access token.

## Response Rules

Responses must not expose:

- credential hashes;
- refresh-token hashes;
- raw refresh tokens;
- verification-token hashes;
- reset-token hashes;
- Prisma records;
- internal security-event metadata.

Password-reset request responses remain generic and do not disclose account existence.

## Public Error Shape

```json
{
  "code": "INVALID_CREDENTIALS",
  "message": "Invalid credentials.",
  "correlationId": "..."
}
```

Database, cryptographic and persistence errors are not exposed directly.

## OpenAPI

The NestJS OpenAPI generator discovers the authentication controller and DTOs through the API
bootstrap. Generated schemas must remain transport contracts, not internal domain or persistence
models.
