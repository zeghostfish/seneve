import type { AccessTokenClaims, VerifiedAccessTokenClaims } from '@seneve/identity-application';
import type { IdentityRepository, IdentitySessionRepository } from '@seneve/domain-identity';

export interface AuthSessionValidator {
  validate(claims: VerifiedAccessTokenClaims): Promise<boolean>;
}

export class RepositoryAuthSessionValidator implements AuthSessionValidator {
  constructor(
    private readonly identities: IdentityRepository,
    private readonly sessions: IdentitySessionRepository,
    private readonly now: () => Date,
  ) {}

  async validate(claims: AccessTokenClaims): Promise<boolean> {
    const session = await this.sessions.findSessionById(claims.sessionId);

    if (
      !session ||
      session.identityId !== claims.identityId ||
      session.status !== 'ACTIVE' ||
      session.expiresAt <= this.now()
    ) {
      return false;
    }

    const identity = await this.identities.findById(claims.identityId);

    return Boolean(identity && identity.status !== 'SUSPENDED' && identity.status !== 'CLOSED');
  }
}
