import { organizationTenantContext } from '@seneve/tenant-context';

import { VotingApplicationError } from './application-error.js';
import type {
  PrivateVotingResultsResult,
  VotingResultsApplicationDependencies,
} from './contracts.js';

export class VotingResultsApplicationService {
  constructor(private readonly deps: VotingResultsApplicationDependencies) {}

  async getPrivateResults(input: {
    readonly actorIdentityId: string;
    readonly organizationId: string;
    readonly campaignId: string;
    readonly correlationId: string;
  }): Promise<PrivateVotingResultsResult> {
    const organization = await this.deps.organizations.findOrganizationById(input.organizationId);
    const actor = await this.deps.identities.findById(input.actorIdentityId);
    const membership =
      organization?.memberships.find(
        (candidate) =>
          candidate.identityId === input.actorIdentityId && candidate.status === 'ACTIVE',
      ) ?? null;

    if (!organization || !actor || !membership) {
      throw new VotingApplicationError('VOTING_RESULTS_PERMISSION_DENIED', 'Permission denied.');
    }

    const context = organizationTenantContext({
      tenantId: organization.id,
      identityId: actor.id,
      membershipId: membership.id,
      role: membership.role,
      correlationId: input.correlationId,
      executionSource: 'HTTP_REQUEST',
    });
    const decision = this.deps.permissions.evaluate({
      actor: {
        identityId: actor.id,
        identityStatus: actor.status,
        emailVerified: Boolean(actor.primaryEmail.verifiedAt),
      },
      tenant: context,
      permission: 'voting:results:read',
      organization: {
        id: organization.id,
        status: organization.status,
      },
      membership: {
        organizationId: organization.id,
        identityId: membership.identityId,
        role: membership.role,
        status: membership.status,
      },
      resource: { organizationId: organization.id },
    });

    if (!decision.allowed) {
      throw new VotingApplicationError('VOTING_RESULTS_PERMISSION_DENIED', 'Permission denied.');
    }

    const results = await this.deps.executionContext.run(context, () =>
      this.deps.unitOfWork.transaction((repository) =>
        repository.getPrivateResults({
          organizationId: input.organizationId,
          campaignId: input.campaignId,
        }),
      ),
    );

    if (!results) {
      throw new VotingApplicationError('VOTING_RESULTS_NOT_FOUND', 'Results not found.');
    }

    return { results, generatedAt: this.deps.clock.now() };
  }
}
