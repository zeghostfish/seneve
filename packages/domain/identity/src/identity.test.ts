import { describe, expect, it } from 'vitest';

import {
  EmailAddress,
  EmailVerification,
  Identity,
  IdentityDomainError,
  IdentityId,
  PasswordCredential,
  PasswordHash,
  PasswordPolicy,
  RefreshToken,
  Session,
  TokenHash,
} from './index.js';

const identityId = IdentityId.from('11111111-1111-4111-8111-111111111111');
const now = new Date('2026-07-14T00:00:00.000Z');
const later = new Date('2026-07-15T00:00:00.000Z');
const metadata = {
  eventId: '22222222-2222-4222-8222-222222222222',
  correlationId: '33333333-3333-4333-8333-333333333333',
  occurredAt: now,
};

function passwordCredential(): PasswordCredential {
  return PasswordCredential.create({
    id: 'credential-1',
    passwordHash: PasswordHash.fromStoredHash('$argon2id$v=19$m=65536,t=3,p=1$hash'),
    createdAt: now,
  });
}

function registeredIdentity(): Identity {
  return Identity.register({
    id: identityId,
    user: { displayName: 'Ada Lovelace' },
    primaryEmail: EmailAddress.create(' Ada@Example.COM ', { isPrimary: true }),
    passwordCredential: passwordCredential(),
    createdAt: now,
    metadata,
  });
}

describe('Identity aggregate', () => {
  it('registers an identity with normalized unverified email and a domain event', () => {
    const identity = registeredIdentity();

    expect(identity.toSnapshot()).toMatchObject({
      id: identityId.value,
      status: 'PENDING_EMAIL_VERIFICATION',
      primaryEmail: {
        value: 'Ada@Example.COM',
        normalized: 'ada@example.com',
        verifiedAt: null,
      },
      credentialIds: ['credential-1'],
    });
    expect(identity.pullDomainEvents()).toEqual([
      expect.objectContaining({
        eventType: 'IdentityRegistered',
        aggregateId: identityId.value,
        payload: {
          normalizedEmail: 'ada@example.com',
          status: 'PENDING_EMAIL_VERIFICATION',
        },
      }),
    ]);
  });

  it('activates the identity after primary email verification', () => {
    const verified = registeredIdentity().verifyPrimaryEmail(later, metadata);

    expect(verified.toSnapshot().status).toBe('ACTIVE');
    expect(verified.toSnapshot().primaryEmail.verifiedAt).toEqual(later);
    expect(verified.pullDomainEvents().map((event) => event.eventType)).toEqual([
      'IdentityRegistered',
      'EmailVerified',
    ]);
  });

  it('blocks authentication until email verification is complete', () => {
    expect(() => registeredIdentity().assertCanAuthenticate()).toThrowError(
      new IdentityDomainError(
        'EMAIL_NOT_VERIFIED',
        'Email verification is required before authentication.',
      ),
    );
  });

  it('revokes active sessions when the identity is suspended', () => {
    const active = registeredIdentity().verifyPrimaryEmail(later, metadata);
    const session = Session.create({
      id: 'session-1',
      identityId: identityId.value,
      createdAt: later,
      expiresAt: new Date('2026-08-14T00:00:00.000Z'),
    });

    const suspended = active
      .addSession(session, metadata)
      .suspend(new Date('2026-07-16T00:00:00.000Z'), metadata);

    expect(suspended.toSnapshot().status).toBe('SUSPENDED');
    expect(suspended.pullDomainEvents().map((event) => event.eventType)).toContain(
      'SessionRevoked',
    );
  });
});

describe('Identity value objects and tokens', () => {
  it('rejects plaintext password storage and validates password policy separately', () => {
    expect(() => PasswordHash.fromStoredHash('plaintext-password')).toThrowError(
      IdentityDomainError,
    );
    expect(PasswordPolicy.validatePlaintext('weak')).toEqual({
      valid: false,
      failures: expect.arrayContaining([
        'PASSWORD_TOO_SHORT',
        'PASSWORD_REQUIRES_UPPERCASE',
        'PASSWORD_REQUIRES_NUMBER',
      ]),
    });
  });

  it('prevents refresh-token reuse after rotation', () => {
    const hash = TokenHash.fromStoredHash('hmac-sha256:abcdefghijklmnopqrstuvwxyz123456');
    const token = RefreshToken.issue({
      id: 'refresh-token-1',
      sessionId: 'session-1',
      familyId: 'family-1',
      tokenHash: hash,
      issuedAt: now,
      expiresAt: later,
    });

    const rotated = token.rotate(new Date('2026-07-14T01:00:00.000Z'));

    expect(() => rotated.assertCanRotate(hash, new Date('2026-07-14T02:00:00.000Z'))).toThrowError(
      new IdentityDomainError(
        'REFRESH_TOKEN_REUSED',
        'Refresh token has already been consumed or revoked.',
      ),
    );
  });

  it('prevents expired or consumed email verification token reuse', () => {
    const hash = TokenHash.fromStoredHash('sha256:abcdefghijklmnopqrstuvwxyz123456');
    const verification = EmailVerification.create({
      id: 'verification-1',
      identityId: identityId.value,
      tokenHash: hash,
      createdAt: now,
      expiresAt: later,
    });

    const consumed = verification.consume(hash, new Date('2026-07-14T01:00:00.000Z'));

    expect(() => consumed.consume(hash, new Date('2026-07-14T02:00:00.000Z'))).toThrowError(
      new IdentityDomainError(
        'VERIFICATION_TOKEN_INVALID',
        'One-time token has already been used or revoked.',
      ),
    );
    expect(() => verification.consume(hash, new Date('2026-07-16T00:00:00.000Z'))).toThrowError(
      new IdentityDomainError('VERIFICATION_TOKEN_EXPIRED', 'One-time token has expired.'),
    );
  });
});
