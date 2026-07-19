# Authentication UX

## Status

Phase 15 adds frontend workflows for registration, login, email verification, password reset,
session listing and session revocation.

## Registration

The registration page collects:

- display name;
- email;
- password;
- password confirmation.

Client validation provides immediate feedback, but the backend remains authoritative for password
policy, duplicate email handling, token creation and audit.

After registration, the user is guided to email verification.

## Login

The login page collects email and password, normalizes the email identifier and submits credentials
to the Authentication API.

Invalid credentials use stable, generic feedback. The UI must not reveal whether a specific account
exists.

## Email Verification

The verification page supports:

- pending state;
- token completion;
- completed state;
- invalid token state;
- expired token style feedback;
- resend request.

Raw verification tokens may be read from the URL only long enough to submit to the backend. After
processing, the page replaces the browser URL to remove sensitive token parameters where practical.

## Password Reset

Password reset is split into:

- request page with generic accepted response;
- completion page with token, new password and password confirmation.

The request page does not reveal whether an account exists. The completion page removes sensitive
token parameters after processing where practical.

Successful reset requires a new login because the backend revokes active sessions and refresh tokens.

## Sessions

The sessions page displays safe session metadata:

- device display name;
- creation time;
- last activity;
- expiry;
- current-session marker.

It does not expose raw device fingerprints, token identifiers, token hashes or security internals.

Supported actions:

- revoke one owned session;
- revoke all other sessions;
- logout all sessions.

## Token Handling

Refresh tokens are handled only through secure backend cookies.

Access tokens are kept in memory by the frontend authentication provider. They are not written to
browser persistent storage in Phase 15.
