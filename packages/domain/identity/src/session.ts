import { IdentityDomainError } from './domain-error.js';
import { TokenHash } from './value-objects.js';

export type SessionStatus = 'ACTIVE' | 'REVOKED' | 'EXPIRED';
export type RefreshTokenStatus = 'ACTIVE' | 'ROTATED' | 'REVOKED' | 'EXPIRED';

export class Session {
  private constructor(
    public readonly id: string,
    public readonly identityId: string,
    public readonly status: SessionStatus,
    public readonly createdAt: Date,
    public readonly expiresAt: Date,
    public readonly revokedAt: Date | null,
  ) {}

  static create(input: {
    id: string;
    identityId: string;
    createdAt: Date;
    expiresAt: Date;
  }): Session {
    if (input.expiresAt <= input.createdAt) {
      throw new IdentityDomainError(
        'VALIDATION_FAILED',
        'Session expiry must be after creation time.',
      );
    }

    return new Session(
      input.id,
      input.identityId,
      'ACTIVE',
      input.createdAt,
      input.expiresAt,
      null,
    );
  }

  assertUsable(now: Date): void {
    if (this.status === 'REVOKED') {
      throw new IdentityDomainError('SESSION_REVOKED', 'Session has been revoked.');
    }

    if (this.expiresAt <= now || this.status === 'EXPIRED') {
      throw new IdentityDomainError('SESSION_REVOKED', 'Session has expired.');
    }
  }

  revoke(revokedAt: Date): Session {
    if (this.status === 'REVOKED') {
      return this;
    }

    return new Session(
      this.id,
      this.identityId,
      'REVOKED',
      this.createdAt,
      this.expiresAt,
      revokedAt,
    );
  }
}

export class RefreshToken {
  private constructor(
    public readonly id: string,
    public readonly sessionId: string,
    public readonly familyId: string,
    private readonly tokenHash: TokenHash,
    public readonly status: RefreshTokenStatus,
    public readonly issuedAt: Date,
    public readonly expiresAt: Date,
    public readonly consumedAt: Date | null,
    public readonly revokedAt: Date | null,
  ) {}

  static issue(input: {
    id: string;
    sessionId: string;
    familyId: string;
    tokenHash: TokenHash;
    issuedAt: Date;
    expiresAt: Date;
  }): RefreshToken {
    if (input.expiresAt <= input.issuedAt) {
      throw new IdentityDomainError(
        'VALIDATION_FAILED',
        'Refresh-token expiry must be after issue time.',
      );
    }

    return new RefreshToken(
      input.id,
      input.sessionId,
      input.familyId,
      input.tokenHash,
      'ACTIVE',
      input.issuedAt,
      input.expiresAt,
      null,
      null,
    );
  }

  assertCanRotate(presentedHash: TokenHash, now: Date): void {
    if (!this.tokenHash.equals(presentedHash)) {
      throw new IdentityDomainError('INVALID_CREDENTIALS', 'Refresh token does not match.');
    }

    if (this.expiresAt <= now || this.status === 'EXPIRED') {
      throw new IdentityDomainError('REFRESH_TOKEN_EXPIRED', 'Refresh token has expired.');
    }

    if (this.status !== 'ACTIVE') {
      throw new IdentityDomainError(
        'REFRESH_TOKEN_REUSED',
        'Refresh token has already been consumed or revoked.',
      );
    }
  }

  rotate(consumedAt: Date): RefreshToken {
    this.assertCanRotate(this.tokenHash, consumedAt);

    return new RefreshToken(
      this.id,
      this.sessionId,
      this.familyId,
      this.tokenHash,
      'ROTATED',
      this.issuedAt,
      this.expiresAt,
      consumedAt,
      this.revokedAt,
    );
  }

  revoke(revokedAt: Date): RefreshToken {
    if (this.status === 'REVOKED') {
      return this;
    }

    return new RefreshToken(
      this.id,
      this.sessionId,
      this.familyId,
      this.tokenHash,
      'REVOKED',
      this.issuedAt,
      this.expiresAt,
      this.consumedAt,
      revokedAt,
    );
  }

  storedHash(): string {
    return this.tokenHash.toString();
  }
}
