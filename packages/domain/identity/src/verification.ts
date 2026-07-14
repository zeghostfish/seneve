import { IdentityDomainError } from './domain-error.js';
import { TokenHash } from './value-objects.js';

export type OneTimeTokenStatus = 'PENDING' | 'CONSUMED' | 'REVOKED' | 'EXPIRED';

abstract class OneTimeToken {
  protected constructor(
    public readonly id: string,
    public readonly identityId: string,
    protected readonly tokenHash: TokenHash,
    public readonly status: OneTimeTokenStatus,
    public readonly createdAt: Date,
    public readonly expiresAt: Date,
    public readonly consumedAt: Date | null,
  ) {}

  protected assertConsumable(
    presentedHash: TokenHash,
    now: Date,
    invalidCode: 'VERIFICATION_TOKEN_INVALID' | 'RESET_TOKEN_INVALID',
  ): void {
    if (!this.tokenHash.equals(presentedHash)) {
      throw new IdentityDomainError(invalidCode, 'One-time token is invalid.');
    }

    if (this.expiresAt <= now || this.status === 'EXPIRED') {
      throw new IdentityDomainError(
        invalidCode === 'VERIFICATION_TOKEN_INVALID'
          ? 'VERIFICATION_TOKEN_EXPIRED'
          : 'RESET_TOKEN_EXPIRED',
        'One-time token has expired.',
      );
    }

    if (this.status !== 'PENDING') {
      throw new IdentityDomainError(
        invalidCode,
        'One-time token has already been used or revoked.',
      );
    }
  }
}

export class EmailVerification extends OneTimeToken {
  static create(input: {
    id: string;
    identityId: string;
    tokenHash: TokenHash;
    createdAt: Date;
    expiresAt: Date;
  }): EmailVerification {
    if (input.expiresAt <= input.createdAt) {
      throw new IdentityDomainError(
        'VALIDATION_FAILED',
        'Email verification expiry must be after creation time.',
      );
    }

    return new EmailVerification(
      input.id,
      input.identityId,
      input.tokenHash,
      'PENDING',
      input.createdAt,
      input.expiresAt,
      null,
    );
  }

  consume(presentedHash: TokenHash, consumedAt: Date): EmailVerification {
    this.assertConsumable(presentedHash, consumedAt, 'VERIFICATION_TOKEN_INVALID');
    return new EmailVerification(
      this.id,
      this.identityId,
      this.tokenHash,
      'CONSUMED',
      this.createdAt,
      this.expiresAt,
      consumedAt,
    );
  }
}

export class PasswordReset extends OneTimeToken {
  static create(input: {
    id: string;
    identityId: string;
    tokenHash: TokenHash;
    createdAt: Date;
    expiresAt: Date;
  }): PasswordReset {
    if (input.expiresAt <= input.createdAt) {
      throw new IdentityDomainError(
        'VALIDATION_FAILED',
        'Password reset expiry must be after creation time.',
      );
    }

    return new PasswordReset(
      input.id,
      input.identityId,
      input.tokenHash,
      'PENDING',
      input.createdAt,
      input.expiresAt,
      null,
    );
  }

  consume(presentedHash: TokenHash, consumedAt: Date): PasswordReset {
    this.assertConsumable(presentedHash, consumedAt, 'RESET_TOKEN_INVALID');
    return new PasswordReset(
      this.id,
      this.identityId,
      this.tokenHash,
      'CONSUMED',
      this.createdAt,
      this.expiresAt,
      consumedAt,
    );
  }
}
