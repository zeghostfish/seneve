import { IdentityDomainError } from './domain-error.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TOKEN_HASH_PATTERN = /^(sha256|hmac-sha256|argon2id):[A-Za-z0-9+/=._:-]{32,}$/;

export class IdentityId {
  private constructor(public readonly value: string) {}

  static from(value: string): IdentityId {
    if (!UUID_PATTERN.test(value)) {
      throw new IdentityDomainError('VALIDATION_FAILED', 'Identity id must be a UUID.');
    }

    return new IdentityId(value);
  }
}

export class EmailAddress {
  private constructor(
    public readonly value: string,
    public readonly normalized: string,
    public readonly verifiedAt: Date | null,
    public readonly isPrimary: boolean,
  ) {}

  static create(
    value: string,
    options: { verifiedAt?: Date | null; isPrimary?: boolean } = {},
  ): EmailAddress {
    const trimmed = value.trim();
    const normalized = trimmed.toLowerCase();

    if (!EMAIL_PATTERN.test(normalized)) {
      throw new IdentityDomainError('VALIDATION_FAILED', 'Email address is invalid.');
    }

    return new EmailAddress(
      trimmed,
      normalized,
      options.verifiedAt ?? null,
      options.isPrimary ?? false,
    );
  }

  verify(verifiedAt: Date): EmailAddress {
    if (this.verifiedAt) {
      return this;
    }

    return new EmailAddress(this.value, this.normalized, verifiedAt, this.isPrimary);
  }
}

export class PasswordHash {
  private constructor(private readonly storedValue: string) {}

  static fromStoredHash(storedValue: string): PasswordHash {
    if (!storedValue.startsWith('$argon2id$')) {
      throw new IdentityDomainError(
        'INVALID_CREDENTIALS',
        'Password credential must use Argon2id hash format.',
      );
    }

    return new PasswordHash(storedValue);
  }

  toString(): string {
    return this.storedValue;
  }
}

export class TokenHash {
  private constructor(private readonly storedValue: string) {}

  static fromStoredHash(storedValue: string): TokenHash {
    if (!TOKEN_HASH_PATTERN.test(storedValue)) {
      throw new IdentityDomainError(
        'VALIDATION_FAILED',
        'Token hash must be non-reversible stored material.',
      );
    }

    return new TokenHash(storedValue);
  }

  equals(other: TokenHash): boolean {
    return this.storedValue === other.storedValue;
  }

  toString(): string {
    return this.storedValue;
  }
}

export interface PasswordPolicyResult {
  readonly valid: boolean;
  readonly failures: readonly string[];
}

export class PasswordPolicy {
  static validatePlaintext(candidate: string): PasswordPolicyResult {
    const failures: string[] = [];

    if (candidate.length < 12) {
      failures.push('PASSWORD_TOO_SHORT');
    }

    if (!/[A-Z]/.test(candidate)) {
      failures.push('PASSWORD_REQUIRES_UPPERCASE');
    }

    if (!/[a-z]/.test(candidate)) {
      failures.push('PASSWORD_REQUIRES_LOWERCASE');
    }

    if (!/[0-9]/.test(candidate)) {
      failures.push('PASSWORD_REQUIRES_NUMBER');
    }

    if (!/[^A-Za-z0-9]/.test(candidate)) {
      failures.push('PASSWORD_REQUIRES_SYMBOL');
    }

    return {
      valid: failures.length === 0,
      failures,
    };
  }
}
