import type { Prisma, PrismaClient } from '@prisma/client';
import type {
  CampaignListResult,
  CampaignPersistenceRepositories,
  CampaignRepository,
  CampaignUnitOfWork,
  PersistedCampaignCreate,
  PersistedCampaignReadModel,
  PersistedCampaignRulesUpdate,
  PersistedCampaignScheduleUpdate,
  PersistedCampaignStatusUpdate,
  PersistedCampaignUpdate,
  CampaignMutationResult,
  CampaignListFilters,
} from '@seneve/domain-campaign';
import { PrismaTenantRlsTransactionBoundary } from '@seneve/organization-persistence';

type PrismaExecutor = PrismaClient | Prisma.TransactionClient;
type CampaignRecord = Prisma.CampaignGetPayload<Record<string, never>>;

export class PrismaCampaignRepository implements CampaignRepository {
  constructor(private readonly prisma: PrismaExecutor) {}

  async createCampaign(input: PersistedCampaignCreate): Promise<void> {
    await this.prisma.campaign.create({
      data: {
        id: input.id,
        organizationId: input.organizationId,
        name: input.name,
        slug: input.slug,
        description: input.description,
        status: input.status,
        visibility: input.visibility,
        timezone: input.timezone,
        locale: input.locale,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        votingMode: input.rules.votingMode,
        votesPerVoter: input.rules.votesPerVoter,
        allowMultipleCandidates: input.rules.allowMultipleCandidates,
        requiresEmailVerification: input.rules.requiresEmailVerification,
        resultsVisibility: input.rules.results.visibility,
        resultRevealAt: input.rules.results.revealAt,
        createdBy: input.createdBy,
        createdAt: input.createdAt,
        updatedAt: input.createdAt,
        version: input.version,
      },
    });
  }

  async findCampaignById(input: {
    readonly organizationId: string;
    readonly campaignId: string;
  }): Promise<PersistedCampaignReadModel | null> {
    const campaign = await this.prisma.campaign.findFirst({
      where: {
        id: input.campaignId,
        organizationId: input.organizationId,
      },
    });

    return campaign ? toCampaignReadModel(campaign) : null;
  }

  async listCampaigns(input: {
    readonly organizationId: string;
    readonly filters: CampaignListFilters;
  }): Promise<CampaignListResult> {
    const take = Math.min(Math.max(input.filters.limit, 1), 100) + 1;
    const campaigns = await this.prisma.campaign.findMany({
      where: {
        organizationId: input.organizationId,
        status: input.filters.status,
        visibility: input.filters.visibility,
        createdAt: range(input.filters.createdFrom, input.filters.createdTo),
        startsAt: range(input.filters.startsFrom, input.filters.startsTo),
        ...(input.filters.search
          ? {
              OR: [
                { name: { contains: input.filters.search, mode: 'insensitive' } },
                { slug: { contains: input.filters.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take,
      ...(input.filters.cursor ? { cursor: { id: input.filters.cursor }, skip: 1 } : {}),
    });
    const page = campaigns.slice(0, input.filters.limit);

    return {
      campaigns: page.map(toCampaignReadModel),
      nextCursor: campaigns.length > input.filters.limit ? (page.at(-1)?.id ?? null) : null,
    };
  }

  async updateCampaign(input: PersistedCampaignUpdate): Promise<CampaignMutationResult> {
    const result = await this.prisma.campaign.updateMany({
      where: {
        id: input.id,
        organizationId: input.organizationId,
        version: input.expectedVersion,
      },
      data: {
        name: input.name,
        slug: input.slug,
        description: input.description,
        visibility: input.visibility,
        updatedAt: input.updatedAt,
        version: { increment: 1 },
      },
    });

    return this.mutationResult(input.organizationId, input.id, result.count);
  }

  async updateCampaignRules(input: PersistedCampaignRulesUpdate): Promise<CampaignMutationResult> {
    const result = await this.prisma.campaign.updateMany({
      where: {
        id: input.id,
        organizationId: input.organizationId,
        version: input.expectedVersion,
      },
      data: {
        votingMode: input.rules.votingMode,
        votesPerVoter: input.rules.votesPerVoter,
        allowMultipleCandidates: input.rules.allowMultipleCandidates,
        requiresEmailVerification: input.rules.requiresEmailVerification,
        resultsVisibility: input.rules.results.visibility,
        resultRevealAt: input.rules.results.revealAt,
        updatedAt: input.updatedAt,
        version: { increment: 1 },
      },
    });

    return this.mutationResult(input.organizationId, input.id, result.count);
  }

  async updateCampaignSchedule(
    input: PersistedCampaignScheduleUpdate,
  ): Promise<CampaignMutationResult> {
    const result = await this.prisma.campaign.updateMany({
      where: {
        id: input.id,
        organizationId: input.organizationId,
        version: input.expectedVersion,
      },
      data: {
        status: input.status,
        timezone: input.timezone,
        locale: input.locale,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        updatedAt: input.updatedAt,
        version: { increment: 1 },
      },
    });

    return this.mutationResult(input.organizationId, input.id, result.count);
  }

  async updateCampaignStatus(
    input: PersistedCampaignStatusUpdate,
  ): Promise<CampaignMutationResult> {
    const result = await this.prisma.campaign.updateMany({
      where: {
        id: input.id,
        organizationId: input.organizationId,
        version: input.expectedVersion,
      },
      data: {
        status: input.status,
        updatedAt: input.updatedAt,
        archivedAt: input.archivedAt,
        cancelledAt: input.cancelledAt,
        version: { increment: 1 },
      },
    });

    return this.mutationResult(input.organizationId, input.id, result.count);
  }

  private async mutationResult(
    organizationId: string,
    campaignId: string,
    count: number,
  ): Promise<CampaignMutationResult> {
    if (count === 1) {
      return { outcome: 'UPDATED' };
    }

    const existing = await this.findCampaignById({ organizationId, campaignId });
    return existing ? { outcome: 'CONFLICT' } : { outcome: 'NOT_FOUND' };
  }
}

export class PrismaCampaignRlsUnitOfWork implements CampaignUnitOfWork {
  constructor(private readonly boundary: PrismaTenantRlsTransactionBoundary) {}

  async transaction<T>(
    work: (repositories: CampaignPersistenceRepositories) => Promise<T>,
  ): Promise<T> {
    return this.boundary.transaction(async (tx) =>
      work({
        campaigns: new PrismaCampaignRepository(tx),
      }),
    );
  }
}

function range(from?: Date, to?: Date): Prisma.DateTimeFilter | undefined {
  if (!from && !to) {
    return undefined;
  }

  return {
    gte: from,
    lte: to,
  };
}

function toCampaignReadModel(record: CampaignRecord): PersistedCampaignReadModel {
  return {
    id: record.id,
    organizationId: record.organizationId,
    name: record.name,
    slug: record.slug,
    description: record.description,
    status: record.status,
    visibility: record.visibility,
    timezone: record.timezone,
    locale: record.locale,
    startsAt: record.startsAt,
    endsAt: record.endsAt,
    rules: {
      votingMode: record.votingMode,
      votesPerVoter: record.votesPerVoter,
      allowMultipleCandidates: record.allowMultipleCandidates,
      requiresEmailVerification: record.requiresEmailVerification,
      results: {
        visibility: record.resultsVisibility,
        revealAt: record.resultRevealAt,
      },
    },
    createdBy: record.createdBy,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    archivedAt: record.archivedAt,
    cancelledAt: record.cancelledAt,
    version: record.version,
  };
}
