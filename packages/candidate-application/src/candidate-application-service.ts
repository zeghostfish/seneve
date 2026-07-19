import type { PermissionId } from '@seneve/authorization-application';
import type { PersistedCampaignReadModel } from '@seneve/domain-campaign';
import {
  Candidate,
  CandidateDomainError,
  CandidateId,
  type CandidateListFilters,
  type CandidateListResult,
  type CandidateSnapshot,
  CampaignId,
  IdentityRef,
  OrganizationId,
} from '@seneve/domain-candidate';
import type { PersistedOrganizationReadModel } from '@seneve/domain-organization';
import { organizationTenantContext, type TenantContext } from '@seneve/tenant-context';

import { CandidateApplicationError } from './application-error.js';
import type { CandidateApplicationDependencies, CandidateCommandResult } from './contracts.js';

export interface CreateCandidateCommand {
  readonly actorIdentityId: string;
  readonly organizationId: string;
  readonly campaignId: string;
  readonly displayName: string;
  readonly slug: string;
  readonly shortDescription?: string | null;
  readonly description?: string | null;
  readonly imageAssetId?: string | null;
  readonly externalReference?: string | null;
  readonly metadata?: Readonly<Record<string, unknown>> | null;
  readonly correlationId: string;
}

export interface CandidateMutationCommand {
  readonly actorIdentityId: string;
  readonly organizationId: string;
  readonly campaignId: string;
  readonly candidateId: string;
  readonly expectedVersion: number;
  readonly correlationId: string;
}

export interface UpdateCandidateCommand extends CandidateMutationCommand {
  readonly displayName: string;
  readonly slug: string;
  readonly shortDescription?: string | null;
  readonly description?: string | null;
  readonly imageAssetId?: string | null;
  readonly externalReference?: string | null;
  readonly metadata?: Readonly<Record<string, unknown>> | null;
}

export interface CandidateReasonCommand extends CandidateMutationCommand {
  readonly reason: string;
}

export interface ReorderCandidatesCommand {
  readonly actorIdentityId: string;
  readonly organizationId: string;
  readonly campaignId: string;
  readonly candidateIds: readonly string[];
  readonly correlationId: string;
}

export class CandidateApplicationService {
  constructor(private readonly deps: CandidateApplicationDependencies) {}

  async createCandidate(command: CreateCandidateCommand): Promise<CandidateCommandResult> {
    const organization = await this.requireOrganization(command.organizationId);
    const context = await this.authorize(
      command.actorIdentityId,
      organization,
      'candidate:create',
      command.correlationId,
    );
    const campaign = await this.withTenantContext(context, () =>
      this.requireCampaign(command.organizationId, command.campaignId),
    );
    assertCampaignAllows(campaign.status, 'create');

    const count = await this.withTenantContext(context, () =>
      this.deps.unitOfWork.transaction((repositories) =>
        repositories.candidates.countCandidates({
          organizationId: command.organizationId,
          campaignId: command.campaignId,
        }),
      ),
    );

    if (count >= this.deps.maxCandidatesPerCampaign) {
      throw new CandidateApplicationError('CANDIDATE_LIMIT_REACHED', 'Candidate limit reached.');
    }

    const now = this.deps.clock.now();
    const candidateId = this.deps.ids.uuid();
    const aggregate = translateDomainErrors(() =>
      Candidate.create({
        id: CandidateId.from(candidateId),
        organizationId: OrganizationId.from(command.organizationId),
        campaignId: CampaignId.from(command.campaignId),
        displayName: command.displayName,
        slug: command.slug,
        shortDescription: command.shortDescription,
        description: command.description,
        position: count + 1,
        imageAssetId: command.imageAssetId,
        externalReference: command.externalReference,
        metadata: command.metadata,
        createdBy: IdentityRef.from(command.actorIdentityId),
        createdAt: now,
        eventMetadata: metadata(
          command.correlationId,
          command.actorIdentityId,
          this.deps.ids.uuid(),
          now,
        ),
      }),
    );
    const snapshot = aggregate.toSnapshot();

    await this.withTenantContext(context, async () => {
      await this.deps.unitOfWork.transaction(async (repositories) => {
        await repositories.candidates.createCandidate(snapshot);
        await recordEvents(this.deps.auditEvents, aggregate.pullDomainEvents());
      });
    });

    return {
      candidate: await this.requireCandidate(
        command.organizationId,
        command.campaignId,
        candidateId,
      ),
    };
  }

  async listCandidates(input: {
    readonly actorIdentityId: string;
    readonly organizationId: string;
    readonly campaignId: string;
    readonly filters: CandidateListFilters;
    readonly correlationId: string;
  }): Promise<CandidateListResult> {
    const organization = await this.requireOrganization(input.organizationId);
    const context = await this.authorize(
      input.actorIdentityId,
      organization,
      'candidate:read',
      input.correlationId,
    );
    await this.withTenantContext(context, () =>
      this.requireCampaign(input.organizationId, input.campaignId),
    );

    return this.withTenantContext(context, () =>
      this.deps.unitOfWork.transaction((repositories) =>
        repositories.candidates.listCandidates({
          organizationId: input.organizationId,
          campaignId: input.campaignId,
          filters: input.filters,
        }),
      ),
    );
  }

  async getCandidate(input: {
    readonly actorIdentityId: string;
    readonly organizationId: string;
    readonly campaignId: string;
    readonly candidateId: string;
    readonly correlationId: string;
  }): Promise<CandidateCommandResult> {
    const organization = await this.requireOrganization(input.organizationId);
    const context = await this.authorize(
      input.actorIdentityId,
      organization,
      'candidate:read',
      input.correlationId,
    );
    await this.withTenantContext(context, () =>
      this.requireCampaign(input.organizationId, input.campaignId),
    );
    const candidate = await this.withTenantContext(context, () =>
      this.requireCandidate(input.organizationId, input.campaignId, input.candidateId),
    );

    return { candidate };
  }

  async updateCandidate(command: UpdateCandidateCommand): Promise<CandidateCommandResult> {
    return this.mutateCandidate(command, 'candidate:update', 'update', (aggregate, now) =>
      aggregate.update({
        displayName: command.displayName,
        slug: command.slug,
        shortDescription: command.shortDescription,
        description: command.description,
        imageAssetId: command.imageAssetId,
        externalReference: command.externalReference,
        metadata: command.metadata,
        updatedAt: now,
        eventMetadata: metadata(
          command.correlationId,
          command.actorIdentityId,
          this.deps.ids.uuid(),
          now,
        ),
      }),
    );
  }

  async markCandidateEligible(command: CandidateMutationCommand): Promise<CandidateCommandResult> {
    return this.mutateCandidate(
      command,
      'candidate:manage-status',
      'eligibility',
      (aggregate, now) =>
        aggregate.markEligible({
          updatedAt: now,
          eventMetadata: metadata(
            command.correlationId,
            command.actorIdentityId,
            this.deps.ids.uuid(),
            now,
          ),
        }),
    );
  }

  async suspendCandidate(command: CandidateReasonCommand): Promise<CandidateCommandResult> {
    return this.mutateCandidate(command, 'candidate:manage-status', 'status', (aggregate, now) =>
      aggregate.suspend({
        reason: command.reason,
        updatedAt: now,
        eventMetadata: metadata(
          command.correlationId,
          command.actorIdentityId,
          this.deps.ids.uuid(),
          now,
        ),
      }),
    );
  }

  async reactivateCandidate(command: CandidateMutationCommand): Promise<CandidateCommandResult> {
    return this.mutateCandidate(
      command,
      'candidate:manage-status',
      'reactivate',
      (aggregate, now) =>
        aggregate.reactivate({
          updatedAt: now,
          eventMetadata: metadata(
            command.correlationId,
            command.actorIdentityId,
            this.deps.ids.uuid(),
            now,
          ),
        }),
    );
  }

  async withdrawCandidate(command: CandidateReasonCommand): Promise<CandidateCommandResult> {
    return this.mutateCandidate(command, 'candidate:withdraw', 'status', (aggregate, now) =>
      aggregate.withdraw({
        reason: command.reason,
        updatedAt: now,
        eventMetadata: metadata(
          command.correlationId,
          command.actorIdentityId,
          this.deps.ids.uuid(),
          now,
        ),
      }),
    );
  }

  async disqualifyCandidate(command: CandidateReasonCommand): Promise<CandidateCommandResult> {
    return this.mutateCandidate(command, 'candidate:disqualify', 'status', (aggregate, now) =>
      aggregate.disqualify({
        reason: command.reason,
        updatedAt: now,
        eventMetadata: metadata(
          command.correlationId,
          command.actorIdentityId,
          this.deps.ids.uuid(),
          now,
        ),
      }),
    );
  }

  async archiveCandidate(command: CandidateMutationCommand): Promise<CandidateCommandResult> {
    return this.mutateCandidate(command, 'candidate:archive', 'archive', (aggregate, now) =>
      aggregate.archive({
        updatedAt: now,
        eventMetadata: metadata(
          command.correlationId,
          command.actorIdentityId,
          this.deps.ids.uuid(),
          now,
        ),
      }),
    );
  }

  async reorderCandidates(command: ReorderCandidatesCommand): Promise<CandidateListResult> {
    const organization = await this.requireOrganization(command.organizationId);
    const context = await this.authorize(
      command.actorIdentityId,
      organization,
      'candidate:reorder',
      command.correlationId,
    );
    const campaign = await this.withTenantContext(context, () =>
      this.requireCampaign(command.organizationId, command.campaignId),
    );
    assertCampaignAllows(campaign.status, 'reorder');
    assertUniqueIds(command.candidateIds);

    const existing = await this.withTenantContext(context, () =>
      this.deps.unitOfWork.transaction((repositories) =>
        repositories.candidates.listCandidates({
          organizationId: command.organizationId,
          campaignId: command.campaignId,
          filters: { limit: this.deps.maxCandidatesPerCampaign },
        }),
      ),
    );

    assertFullOrdering(
      existing.candidates.map((candidate) => candidate.id),
      command.candidateIds,
    );

    await this.withTenantContext(context, async () => {
      await this.deps.unitOfWork.transaction(async (repositories) => {
        const result = await repositories.candidates.reorderCandidates({
          organizationId: command.organizationId,
          campaignId: command.campaignId,
          candidateIds: command.candidateIds,
          updatedAt: this.deps.clock.now(),
        });
        assertMutation(result.outcome);
      });
    });

    return this.listCandidates({
      actorIdentityId: command.actorIdentityId,
      organizationId: command.organizationId,
      campaignId: command.campaignId,
      correlationId: command.correlationId,
      filters: { limit: this.deps.maxCandidatesPerCampaign },
    });
  }

  private async mutateCandidate(
    command: CandidateMutationCommand,
    permission: PermissionId,
    operation: CandidateCampaignOperation,
    mutate: (aggregate: Candidate, now: Date) => Candidate,
  ): Promise<CandidateCommandResult> {
    const organization = await this.requireOrganization(command.organizationId);
    const context = await this.authorize(
      command.actorIdentityId,
      organization,
      permission,
      command.correlationId,
    );
    const campaign = await this.withTenantContext(context, () =>
      this.requireCampaign(command.organizationId, command.campaignId),
    );
    assertCampaignAllows(campaign.status, operation);
    const candidate = await this.withTenantContext(context, () =>
      this.requireCandidate(command.organizationId, command.campaignId, command.candidateId),
    );
    const now = this.deps.clock.now();
    const aggregate = translateDomainErrors(() => mutate(Candidate.rehydrate(candidate), now));
    const snapshot = aggregate.toSnapshot();

    await this.withTenantContext(context, async () => {
      await this.deps.unitOfWork.transaction(async (repositories) => {
        const result = await repositories.candidates.updateCandidate({
          ...snapshot,
          expectedVersion: command.expectedVersion,
        });
        assertMutation(result.outcome);
        await recordEvents(this.deps.auditEvents, aggregate.pullDomainEvents());
      });
    });

    return {
      candidate: await this.requireCandidate(
        command.organizationId,
        command.campaignId,
        command.candidateId,
      ),
    };
  }

  private async authorize(
    actorIdentityId: string,
    organization: PersistedOrganizationReadModel,
    permission: PermissionId,
    correlationId: string,
  ): Promise<TenantContext> {
    const actor = await this.deps.identities.findById(actorIdentityId);

    if (!actor) {
      throw new CandidateApplicationError('CANDIDATE_PERMISSION_DENIED', 'Permission denied.');
    }

    const actorMembership =
      organization.memberships.find(
        (membership) => membership.identityId === actorIdentityId && membership.status === 'ACTIVE',
      ) ?? null;

    if (!actorMembership) {
      throw new CandidateApplicationError('CANDIDATE_PERMISSION_DENIED', 'Permission denied.');
    }

    const context = organizationTenantContext({
      tenantId: organization.id,
      identityId: actorIdentityId,
      membershipId: actorMembership.id,
      role: actorMembership.role,
      correlationId,
      executionSource: 'HTTP_REQUEST',
    });
    const decision = this.deps.permissions.evaluate({
      actor: {
        identityId: actor.id,
        identityStatus: actor.status,
        emailVerified: Boolean(actor.primaryEmail.verifiedAt),
      },
      tenant: context,
      permission,
      organization: {
        id: organization.id,
        status: organization.status,
      },
      membership: {
        organizationId: organization.id,
        identityId: actorMembership.identityId,
        role: actorMembership.role,
        status: actorMembership.status,
      },
      resource: {
        organizationId: organization.id,
      },
    });

    if (!decision.allowed) {
      throw new CandidateApplicationError('CANDIDATE_PERMISSION_DENIED', 'Permission denied.');
    }

    return context;
  }

  private async withTenantContext<T>(context: TenantContext, work: () => Promise<T>): Promise<T> {
    return this.deps.executionContext.run(context, work);
  }

  private async requireOrganization(
    organizationId: string,
  ): Promise<PersistedOrganizationReadModel> {
    const organization = await this.deps.organizations.findOrganizationById(organizationId);

    if (!organization) {
      throw new CandidateApplicationError('CANDIDATE_NOT_FOUND', 'Candidate not found.');
    }

    return organization;
  }

  private async requireCampaign(
    organizationId: string,
    campaignId: string,
  ): Promise<PersistedCampaignReadModel> {
    const campaign = await this.deps.campaigns.findCampaignById({ organizationId, campaignId });

    if (!campaign) {
      throw new CandidateApplicationError('CANDIDATE_NOT_FOUND', 'Candidate not found.');
    }

    return campaign;
  }

  private async requireCandidate(
    organizationId: string,
    campaignId: string,
    candidateId: string,
  ): Promise<CandidateSnapshot> {
    const candidate = await this.deps.unitOfWork.transaction((repositories) =>
      repositories.candidates.findCandidateById({ organizationId, campaignId, candidateId }),
    );

    if (!candidate) {
      throw new CandidateApplicationError('CANDIDATE_NOT_FOUND', 'Candidate not found.');
    }

    return candidate;
  }
}

type CandidateCampaignOperation =
  'create' | 'update' | 'eligibility' | 'status' | 'reactivate' | 'archive' | 'reorder';

const campaignPolicy: Readonly<Record<string, readonly CandidateCampaignOperation[]>> = {
  DRAFT: ['create', 'update', 'eligibility', 'status', 'reactivate', 'archive', 'reorder'],
  SCHEDULED: ['create', 'update', 'eligibility', 'status', 'reactivate', 'archive', 'reorder'],
  ACTIVE: ['status'],
  PAUSED: ['status', 'reactivate'],
  COMPLETED: ['archive'],
  CANCELLED: ['archive'],
  ARCHIVED: [],
};

async function recordEvents(
  recorder: {
    record(
      event: Parameters<CandidateApplicationDependencies['auditEvents']['record']>[0],
    ): Promise<unknown>;
  },
  events: readonly Parameters<CandidateApplicationDependencies['auditEvents']['record']>[0][],
): Promise<void> {
  for (const event of events) {
    await recorder.record(event);
  }
}

function assertCampaignAllows(
  status: PersistedCampaignReadModel['status'],
  operation: CandidateCampaignOperation,
): void {
  if (!campaignPolicy[status]?.includes(operation)) {
    throw new CandidateApplicationError(
      'CANDIDATE_CAMPAIGN_STATE_CONFLICT',
      'Campaign lifecycle does not allow this candidate operation.',
    );
  }
}

function assertMutation(outcome: 'UPDATED' | 'NOT_FOUND' | 'CONFLICT'): void {
  if (outcome === 'UPDATED') {
    return;
  }

  if (outcome === 'NOT_FOUND') {
    throw new CandidateApplicationError('CANDIDATE_NOT_FOUND', 'Candidate not found.');
  }

  throw new CandidateApplicationError(
    'CANDIDATE_VERSION_CONFLICT',
    'Candidate mutation conflicted.',
  );
}

function assertUniqueIds(candidateIds: readonly string[]): void {
  if (candidateIds.length === 0 || new Set(candidateIds).size !== candidateIds.length) {
    throw new CandidateApplicationError(
      'CANDIDATE_REORDER_INVALID',
      'Candidate reorder list is invalid.',
    );
  }
}

function assertFullOrdering(existingIds: readonly string[], requestedIds: readonly string[]): void {
  if (existingIds.length !== requestedIds.length) {
    throw new CandidateApplicationError(
      'CANDIDATE_REORDER_INVALID',
      'Candidate reorder must include every candidate.',
    );
  }

  const existing = new Set(existingIds);
  const everyCandidateIncluded = requestedIds.every((candidateId) => existing.has(candidateId));

  if (!everyCandidateIncluded) {
    throw new CandidateApplicationError(
      'CANDIDATE_REORDER_INVALID',
      'Candidate reorder contains an invalid candidate.',
    );
  }
}

function metadata(
  correlationId: string,
  actorIdentityId: string,
  eventId: string,
  occurredAt: Date,
) {
  return {
    eventId,
    correlationId,
    actorIdentityId,
    occurredAt,
  };
}

function translateDomainErrors<T>(work: () => T): T {
  try {
    return work();
  } catch (error) {
    if (error instanceof CandidateDomainError) {
      throw new CandidateApplicationError(error.code, error.message);
    }

    throw error;
  }
}
