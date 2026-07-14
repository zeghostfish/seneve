import { PasswordCredential } from './credential.js';
import {
  createIdentityEvent,
  type DomainEventMetadata,
  type IdentityDomainEvent,
} from './domain-event.js';
import { IdentityDomainError } from './domain-error.js';
import { Session } from './session.js';
import { EmailAddress, IdentityId } from './value-objects.js';

export type IdentityStatus = 'PENDING_EMAIL_VERIFICATION' | 'ACTIVE' | 'SUSPENDED' | 'CLOSED';

export interface UserProfile {
  readonly displayName: string;
}

export interface IdentitySnapshot {
  readonly id: string;
  readonly status: IdentityStatus;
  readonly user: UserProfile;
  readonly primaryEmail: {
    readonly value: string;
    readonly normalized: string;
    readonly verifiedAt: Date | null;
  };
  readonly credentialIds: readonly string[];
  readonly sessionIds: readonly string[];
  readonly createdAt: Date;
  readonly suspendedAt: Date | null;
  readonly closedAt: Date | null;
}

export class Identity {
  private readonly events: IdentityDomainEvent[] = [];

  private constructor(
    public readonly id: IdentityId,
    public readonly status: IdentityStatus,
    public readonly user: UserProfile,
    public readonly primaryEmail: EmailAddress,
    private readonly credentials: readonly PasswordCredential[],
    private readonly sessions: readonly Session[],
    public readonly createdAt: Date,
    public readonly suspendedAt: Date | null,
    public readonly closedAt: Date | null,
  ) {}

  static register(input: {
    id: IdentityId;
    user: UserProfile;
    primaryEmail: EmailAddress;
    passwordCredential: PasswordCredential;
    createdAt: Date;
    metadata: DomainEventMetadata;
  }): Identity {
    if (input.primaryEmail.verifiedAt) {
      throw new IdentityDomainError(
        'VALIDATION_FAILED',
        'Registration email must start unverified.',
      );
    }

    input.passwordCredential.assertActive();

    const identity = new Identity(
      input.id,
      'PENDING_EMAIL_VERIFICATION',
      input.user,
      input.primaryEmail,
      [input.passwordCredential],
      [],
      input.createdAt,
      null,
      null,
    );

    identity.record(
      createIdentityEvent({
        eventType: 'IdentityRegistered',
        aggregateId: input.id.value,
        metadata: input.metadata,
        payload: {
          normalizedEmail: input.primaryEmail.normalized,
          status: identity.status,
        },
      }),
    );

    return identity;
  }

  verifyPrimaryEmail(verifiedAt: Date, metadata: DomainEventMetadata): Identity {
    if (this.status === 'CLOSED') {
      throw new IdentityDomainError('USER_DEACTIVATED', 'Closed identity cannot verify email.');
    }

    const next = new Identity(
      this.id,
      this.status === 'PENDING_EMAIL_VERIFICATION' ? 'ACTIVE' : this.status,
      this.user,
      this.primaryEmail.verify(verifiedAt),
      this.credentials,
      this.sessions,
      this.createdAt,
      this.suspendedAt,
      this.closedAt,
    );

    next.recordExisting(this.events);
    next.record(
      createIdentityEvent({
        eventType: 'EmailVerified',
        aggregateId: this.id.value,
        metadata,
        payload: {
          normalizedEmail: next.primaryEmail.normalized,
          status: next.status,
        },
      }),
    );

    return next;
  }

  assertCanAuthenticate(): void {
    if (this.status === 'PENDING_EMAIL_VERIFICATION') {
      throw new IdentityDomainError(
        'EMAIL_NOT_VERIFIED',
        'Email verification is required before authentication.',
      );
    }

    if (this.status === 'SUSPENDED') {
      throw new IdentityDomainError('USER_SUSPENDED', 'Identity is suspended.');
    }

    if (this.status === 'CLOSED') {
      throw new IdentityDomainError('USER_DEACTIVATED', 'Identity is closed.');
    }
  }

  addSession(session: Session, metadata: DomainEventMetadata): Identity {
    if (session.identityId !== this.id.value) {
      throw new IdentityDomainError(
        'VALIDATION_FAILED',
        'Session identity does not match aggregate root.',
      );
    }

    this.assertCanAuthenticate();

    const next = new Identity(
      this.id,
      this.status,
      this.user,
      this.primaryEmail,
      this.credentials,
      [...this.sessions, session],
      this.createdAt,
      this.suspendedAt,
      this.closedAt,
    );

    next.recordExisting(this.events);
    next.record(
      createIdentityEvent({
        eventType: 'SessionCreated',
        aggregateId: this.id.value,
        metadata,
        payload: {
          sessionId: session.id,
        },
      }),
    );

    return next;
  }

  suspend(suspendedAt: Date, metadata: DomainEventMetadata): Identity {
    if (this.status === 'CLOSED') {
      throw new IdentityDomainError('USER_DEACTIVATED', 'Closed identity cannot be suspended.');
    }

    const revokedSessions = this.sessions.map((session) => session.revoke(suspendedAt));
    const next = new Identity(
      this.id,
      'SUSPENDED',
      this.user,
      this.primaryEmail,
      this.credentials,
      revokedSessions,
      this.createdAt,
      suspendedAt,
      this.closedAt,
    );

    next.recordExisting(this.events);
    for (const session of this.sessions) {
      if (session.status === 'ACTIVE') {
        next.record(
          createIdentityEvent({
            eventType: 'SessionRevoked',
            aggregateId: this.id.value,
            metadata,
            payload: {
              sessionId: session.id,
              reason: 'IDENTITY_SUSPENDED',
            },
          }),
        );
      }
    }

    return next;
  }

  pullDomainEvents(): readonly IdentityDomainEvent[] {
    const pulled = [...this.events];
    this.events.length = 0;
    return pulled;
  }

  toSnapshot(): IdentitySnapshot {
    return {
      id: this.id.value,
      status: this.status,
      user: this.user,
      primaryEmail: {
        value: this.primaryEmail.value,
        normalized: this.primaryEmail.normalized,
        verifiedAt: this.primaryEmail.verifiedAt,
      },
      credentialIds: this.credentials.map((credential) => credential.id),
      sessionIds: this.sessions.map((session) => session.id),
      createdAt: this.createdAt,
      suspendedAt: this.suspendedAt,
      closedAt: this.closedAt,
    };
  }

  private record(event: IdentityDomainEvent): void {
    this.events.push(event);
  }

  private recordExisting(events: readonly IdentityDomainEvent[]): void {
    this.events.push(...events);
  }
}
