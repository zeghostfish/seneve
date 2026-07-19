import type { PermissionId } from '@seneve/authorization-application';
import {
  Campaign,
  CampaignDomainError,
  CampaignId,
  CampaignRules,
  type CampaignListFilters,
  CampaignSchedule,
  IdentityRef,
  OrganizationId,
  type PersistedCampaignReadModel,
  type CampaignVisibility,
} from '@seneve/domain-campaign';
import type { PersistedOrganizationReadModel } from '@seneve/domain-organization';
import { organizationTenantContext, type TenantContext } from '@seneve/tenant-context';

import { CampaignApplicationError } from './application-error.js';
import type { CampaignApplicationDependencies, CampaignCommandResult } from './contracts.js';

export interface CreateCampaignCommand {
  readonly actorIdentityId: string;
  readonly organizationId: string;
  readonly name: string;
  readonly slug: string;
  readonly description?: string | null;
  readonly visibility: CampaignVisibility;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly timezone: string;
  readonly locale: string;
  readonly votingMode: 'FREE' | 'PAID' | 'HYBRID';
  readonly votesPerVoter: number;
  readonly allowMultipleCandidates: boolean;
  readonly requiresEmailVerification: boolean;
  readonly resultsVisibility: 'HIDDEN' | 'LIVE' | 'AFTER_CAMPAIGN' | 'SCHEDULED';
  readonly resultRevealAt?: Date | null;
  readonly correlationId: string;
}

export interface CampaignMutationCommand {
  readonly actorIdentityId: string;
  readonly organizationId: string;
  readonly campaignId: string;
  readonly expectedVersion: number;
  readonly correlationId: string;
}

export interface UpdateCampaignCommand extends CampaignMutationCommand {
  readonly name: string;
  readonly slug: string;
  readonly description?: string | null;
  readonly visibility: CampaignVisibility;
}

export interface UpdateCampaignRulesCommand extends CampaignMutationCommand {
  readonly votingMode: 'FREE' | 'PAID' | 'HYBRID';
  readonly votesPerVoter: number;
  readonly allowMultipleCandidates: boolean;
  readonly requiresEmailVerification: boolean;
  readonly resultsVisibility: 'HIDDEN' | 'LIVE' | 'AFTER_CAMPAIGN' | 'SCHEDULED';
  readonly resultRevealAt?: Date | null;
}

export interface ScheduleCampaignCommand extends CampaignMutationCommand {
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly timezone: string;
  readonly locale: string;
}

export class CampaignApplicationService {
  constructor(private readonly deps: CampaignApplicationDependencies) {}

  async createCampaign(command: CreateCampaignCommand): Promise<CampaignCommandResult> {
    const organization = await this.requireOrganization(command.organizationId);
    const context = await this.authorize(
      command.actorIdentityId,
      organization,
      'campaign:create',
      command.correlationId,
    );
    const now = this.deps.clock.now();
    const campaignId = this.deps.ids.uuid();
    const aggregate = translateDomainErrors(() =>
      Campaign.create({
        id: CampaignId.from(campaignId),
        organizationId: OrganizationId.from(command.organizationId),
        name: command.name,
        slug: command.slug,
        description: command.description,
        visibility: command.visibility,
        schedule: schedule(command),
        rules: rules(command),
        createdBy: IdentityRef.from(command.actorIdentityId),
        createdAt: now,
        metadata: metadata(
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
        await repositories.campaigns.createCampaign({
          id: snapshot.id,
          organizationId: snapshot.organizationId,
          name: snapshot.name,
          slug: snapshot.slug,
          description: snapshot.description,
          status: snapshot.status,
          visibility: snapshot.visibility,
          timezone: snapshot.schedule.timezone,
          locale: snapshot.schedule.locale,
          startsAt: snapshot.schedule.startsAt,
          endsAt: snapshot.schedule.endsAt,
          rules: snapshot.rules,
          createdBy: snapshot.createdBy,
          createdAt: snapshot.createdAt,
          version: snapshot.version,
        });
        await recordEvents(this.deps.auditEvents, aggregate.pullDomainEvents());
      });
    });

    return { campaign: await this.requireCampaign(command.organizationId, campaignId) };
  }

  async listCampaigns(input: {
    readonly actorIdentityId: string;
    readonly organizationId: string;
    readonly filters: CampaignListFilters;
    readonly correlationId: string;
  }) {
    const organization = await this.requireOrganization(input.organizationId);
    const context = await this.authorize(
      input.actorIdentityId,
      organization,
      'campaign:read',
      input.correlationId,
    );

    return this.withTenantContext(context, () =>
      this.deps.unitOfWork.transaction((repositories) =>
        repositories.campaigns.listCampaigns({
          organizationId: input.organizationId,
          filters: input.filters,
        }),
      ),
    );
  }

  async getCampaign(input: {
    readonly actorIdentityId: string;
    readonly organizationId: string;
    readonly campaignId: string;
    readonly correlationId: string;
  }): Promise<CampaignCommandResult> {
    const organization = await this.requireOrganization(input.organizationId);
    const context = await this.authorize(
      input.actorIdentityId,
      organization,
      'campaign:read',
      input.correlationId,
    );
    const campaign = await this.withTenantContext(context, () =>
      this.requireCampaign(input.organizationId, input.campaignId),
    );

    return { campaign };
  }

  async updateCampaign(command: UpdateCampaignCommand): Promise<CampaignCommandResult> {
    return this.mutateCampaign(command, 'campaign:update', (aggregate, now) =>
      aggregate.updateDetails({
        name: command.name,
        slug: command.slug,
        description: command.description,
        visibility: command.visibility,
        updatedAt: now,
        metadata: metadata(
          command.correlationId,
          command.actorIdentityId,
          this.deps.ids.uuid(),
          now,
        ),
      }),
    );
  }

  async updateCampaignRules(command: UpdateCampaignRulesCommand): Promise<CampaignCommandResult> {
    return this.mutateCampaign(command, 'campaign:manage-rules', (aggregate, now) =>
      aggregate.updateRules({
        rules: rules(command),
        updatedAt: now,
        metadata: metadata(
          command.correlationId,
          command.actorIdentityId,
          this.deps.ids.uuid(),
          now,
        ),
      }),
    );
  }

  async scheduleCampaign(command: ScheduleCampaignCommand): Promise<CampaignCommandResult> {
    return this.mutateCampaign(command, 'campaign:schedule', (aggregate, now) =>
      aggregate.schedule({
        schedule: schedule(command),
        updatedAt: now,
        metadata: metadata(
          command.correlationId,
          command.actorIdentityId,
          this.deps.ids.uuid(),
          now,
        ),
      }),
    );
  }

  async transitionCampaign(
    command: CampaignMutationCommand,
    target: 'activate' | 'pause' | 'complete' | 'cancel' | 'archive',
  ): Promise<CampaignCommandResult> {
    const permission: PermissionId = `campaign:${target}` as PermissionId;

    return this.mutateCampaign(command, permission, (aggregate, now) => {
      const input = {
        updatedAt: now,
        metadata: metadata(
          command.correlationId,
          command.actorIdentityId,
          this.deps.ids.uuid(),
          now,
        ),
      };

      return target === 'activate'
        ? aggregate.activate(input)
        : target === 'pause'
          ? aggregate.pause(input)
          : target === 'complete'
            ? aggregate.complete(input)
            : target === 'cancel'
              ? aggregate.cancel(input)
              : aggregate.archive(input);
    });
  }

  private async mutateCampaign(
    command: CampaignMutationCommand,
    permission: PermissionId,
    mutate: (aggregate: Campaign, now: Date) => Campaign,
  ): Promise<CampaignCommandResult> {
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
    const now = this.deps.clock.now();
    const aggregate = translateDomainErrors(() =>
      mutate(Campaign.rehydrate(toCampaignSnapshot(campaign)), now),
    );
    const snapshot = aggregate.toSnapshot();

    await this.withTenantContext(context, async () => {
      await this.deps.unitOfWork.transaction(async (repositories) => {
        const result =
          permission === 'campaign:update'
            ? await repositories.campaigns.updateCampaign({
                id: snapshot.id,
                organizationId: snapshot.organizationId,
                expectedVersion: command.expectedVersion,
                name: snapshot.name,
                slug: snapshot.slug,
                description: snapshot.description,
                visibility: snapshot.visibility,
                updatedAt: now,
              })
            : permission === 'campaign:manage-rules'
              ? await repositories.campaigns.updateCampaignRules({
                  id: snapshot.id,
                  organizationId: snapshot.organizationId,
                  expectedVersion: command.expectedVersion,
                  rules: snapshot.rules,
                  updatedAt: now,
                })
              : permission === 'campaign:schedule'
                ? await repositories.campaigns.updateCampaignSchedule({
                    id: snapshot.id,
                    organizationId: snapshot.organizationId,
                    expectedVersion: command.expectedVersion,
                    status: snapshot.status,
                    timezone: snapshot.schedule.timezone,
                    locale: snapshot.schedule.locale,
                    startsAt: snapshot.schedule.startsAt,
                    endsAt: snapshot.schedule.endsAt,
                    updatedAt: now,
                  })
                : await repositories.campaigns.updateCampaignStatus({
                    id: snapshot.id,
                    organizationId: snapshot.organizationId,
                    expectedVersion: command.expectedVersion,
                    status: snapshot.status,
                    updatedAt: now,
                    archivedAt: snapshot.archivedAt,
                    cancelledAt: snapshot.cancelledAt,
                  });
        assertMutation(result.outcome);
        await recordEvents(this.deps.auditEvents, aggregate.pullDomainEvents());
      });
    });

    return { campaign: await this.requireCampaign(command.organizationId, command.campaignId) };
  }

  private async authorize(
    actorIdentityId: string,
    organization: PersistedOrganizationReadModel,
    permission: PermissionId,
    correlationId: string,
  ): Promise<TenantContext> {
    const actor = await this.deps.identities.findById(actorIdentityId);

    if (!actor) {
      throw new CampaignApplicationError('CAMPAIGN_PERMISSION_DENIED', 'Permission denied.');
    }

    const actorMembership =
      organization.memberships.find(
        (membership) => membership.identityId === actorIdentityId && membership.status === 'ACTIVE',
      ) ?? null;

    if (!actorMembership) {
      throw new CampaignApplicationError('CAMPAIGN_PERMISSION_DENIED', 'Permission denied.');
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
      throw new CampaignApplicationError('CAMPAIGN_PERMISSION_DENIED', 'Permission denied.');
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
      throw new CampaignApplicationError('CAMPAIGN_NOT_FOUND', 'Campaign not found.');
    }

    return organization;
  }

  private async requireCampaign(
    organizationId: string,
    campaignId: string,
  ): Promise<PersistedCampaignReadModel> {
    const campaign = await this.deps.unitOfWork.transaction((repositories) =>
      repositories.campaigns.findCampaignById({ organizationId, campaignId }),
    );

    if (!campaign) {
      throw new CampaignApplicationError('CAMPAIGN_NOT_FOUND', 'Campaign not found.');
    }

    return campaign;
  }
}

async function recordEvents(
  recorder: {
    record(
      event: Parameters<CampaignApplicationDependencies['auditEvents']['record']>[0],
    ): Promise<unknown>;
  },
  events: readonly Parameters<CampaignApplicationDependencies['auditEvents']['record']>[0][],
): Promise<void> {
  for (const event of events) {
    await recorder.record(event);
  }
}

function schedule(input: {
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly timezone: string;
  readonly locale: string;
}) {
  return CampaignSchedule.create({
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    timezone: input.timezone,
    locale: input.locale,
  });
}

function rules(input: {
  readonly votingMode: 'FREE' | 'PAID' | 'HYBRID';
  readonly votesPerVoter: number;
  readonly allowMultipleCandidates: boolean;
  readonly requiresEmailVerification: boolean;
  readonly resultsVisibility: 'HIDDEN' | 'LIVE' | 'AFTER_CAMPAIGN' | 'SCHEDULED';
  readonly resultRevealAt?: Date | null;
}) {
  return CampaignRules.create({
    votingMode: input.votingMode,
    votesPerVoter: input.votesPerVoter,
    allowMultipleCandidates: input.allowMultipleCandidates,
    requiresEmailVerification: input.requiresEmailVerification,
    results: {
      visibility: input.resultsVisibility,
      revealAt: input.resultRevealAt ?? null,
    },
  });
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

function assertMutation(outcome: 'UPDATED' | 'NOT_FOUND' | 'CONFLICT'): void {
  if (outcome === 'UPDATED') {
    return;
  }

  if (outcome === 'NOT_FOUND') {
    throw new CampaignApplicationError('CAMPAIGN_NOT_FOUND', 'Campaign not found.');
  }

  throw new CampaignApplicationError('CAMPAIGN_VERSION_CONFLICT', 'Campaign mutation conflicted.');
}

function translateDomainErrors<T>(work: () => T): T {
  try {
    return work();
  } catch (error) {
    if (error instanceof CampaignDomainError) {
      throw new CampaignApplicationError(error.code, error.message);
    }

    throw error;
  }
}

function toCampaignSnapshot(campaign: PersistedCampaignReadModel) {
  return {
    id: campaign.id,
    organizationId: campaign.organizationId,
    name: campaign.name,
    slug: campaign.slug,
    description: campaign.description,
    status: campaign.status,
    visibility: campaign.visibility,
    schedule: {
      startsAt: campaign.startsAt,
      endsAt: campaign.endsAt,
      timezone: campaign.timezone,
      locale: campaign.locale,
    },
    rules: campaign.rules,
    createdBy: campaign.createdBy,
    createdAt: campaign.createdAt,
    updatedAt: campaign.updatedAt,
    archivedAt: campaign.archivedAt,
    cancelledAt: campaign.cancelledAt,
    version: campaign.version,
  };
}
