import { IdentityDomainError } from './domain-error.js';
import { PasswordHash } from './value-objects.js';

export type CredentialStatus = 'ACTIVE' | 'REVOKED';
export type CredentialType = 'PASSWORD';

export interface PasswordCredentialSnapshot {
  readonly id: string;
  readonly type: CredentialType;
  readonly passwordHash: string;
  readonly status: CredentialStatus;
  readonly createdAt: Date;
  readonly revokedAt: Date | null;
}

export class PasswordCredential {
  private constructor(
    public readonly id: string,
    private readonly passwordHash: PasswordHash,
    public readonly status: CredentialStatus,
    public readonly createdAt: Date,
    public readonly revokedAt: Date | null,
  ) {}

  static create(input: {
    id: string;
    passwordHash: PasswordHash;
    createdAt: Date;
  }): PasswordCredential {
    return new PasswordCredential(input.id, input.passwordHash, 'ACTIVE', input.createdAt, null);
  }

  revoke(revokedAt: Date): PasswordCredential {
    if (this.status === 'REVOKED') {
      return this;
    }

    return new PasswordCredential(this.id, this.passwordHash, 'REVOKED', this.createdAt, revokedAt);
  }

  assertActive(): void {
    if (this.status !== 'ACTIVE') {
      throw new IdentityDomainError('INVALID_CREDENTIALS', 'Credential is not active.');
    }
  }

  toSnapshot(): PasswordCredentialSnapshot {
    return {
      id: this.id,
      type: 'PASSWORD',
      passwordHash: this.passwordHash.toString(),
      status: this.status,
      createdAt: this.createdAt,
      revokedAt: this.revokedAt,
    };
  }
}
