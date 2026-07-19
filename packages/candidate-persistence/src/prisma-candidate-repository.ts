import type { Prisma, PrismaClient } from '@prisma/client';
import type {
  CandidateListFilters,
  CandidateListResult,
  CandidateMutationResult,
  CandidatePersistenceRepositories,
  CandidateRepository,
  CandidateSnapshot,
  CandidateUnitOfWork,
} from '@seneve/domain-candidate';
import { PrismaTenantRlsTransactionBoundary } from '@seneve/organization-persistence';

type PrismaExecutor = PrismaClient | Prisma.TransactionClient;
type CandidateRecord = Prisma.CandidateGetPayload<Record<string, never>>;

export class PrismaCandidateRepository implements CandidateRepository {
  constructor(private readonly prisma: PrismaExecutor) {}

  async createCandidate(input: CandidateSnapshot): Promise<void> {
    await this.prisma.candidate.create({
      data: toCandidateData(input),
    });
  }

  async countCandidates(input: {
    readonly organizationId: string;
    readonly campaignId: string;
  }): Promise<number> {
    return this.prisma.candidate.count({
      where: {
        organizationId: input.organizationId,
        campaignId: input.campaignId,
      },
    });
  }

  async findCandidateById(input: {
    readonly organizationId: string;
    readonly campaignId: string;
    readonly candidateId: string;
  }): Promise<CandidateSnapshot | null> {
    const candidate = await this.prisma.candidate.findFirst({
      where: {
        id: input.candidateId,
        organizationId: input.organizationId,
        campaignId: input.campaignId,
      },
    });

    return candidate ? toCandidateSnapshot(candidate) : null;
  }

  async listCandidates(input: {
    readonly organizationId: string;
    readonly campaignId: string;
    readonly filters: CandidateListFilters;
  }): Promise<CandidateListResult> {
    const take = Math.min(Math.max(input.filters.limit, 1), 500) + 1;
    const candidates = await this.prisma.candidate.findMany({
      where: {
        organizationId: input.organizationId,
        campaignId: input.campaignId,
        status: input.filters.eligibleOnly ? 'ELIGIBLE' : input.filters.status,
        createdAt: range(input.filters.createdFrom, input.filters.createdTo),
        ...(input.filters.search
          ? {
              OR: [
                { displayName: { contains: input.filters.search, mode: 'insensitive' } },
                { slug: { contains: input.filters.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      take,
      ...(input.filters.cursor ? { cursor: { id: input.filters.cursor }, skip: 1 } : {}),
    });
    const page = candidates.slice(0, input.filters.limit);

    return {
      candidates: page.map(toCandidateSnapshot),
      nextCursor: candidates.length > input.filters.limit ? (page.at(-1)?.id ?? null) : null,
    };
  }

  async updateCandidate(
    input: CandidateSnapshot & { readonly expectedVersion: number },
  ): Promise<CandidateMutationResult> {
    const result = await this.prisma.candidate.updateMany({
      where: {
        id: input.id,
        organizationId: input.organizationId,
        campaignId: input.campaignId,
        version: input.expectedVersion,
      },
      data: {
        displayName: input.displayName,
        slug: input.slug,
        shortDescription: input.shortDescription,
        description: input.description,
        status: input.status,
        position: input.position,
        imageAssetId: input.imageAssetId,
        externalReference: input.externalReference,
        metadata: input.metadata as Prisma.InputJsonValue,
        updatedAt: input.updatedAt,
        statusReason: input.statusReason,
        archivedAt: input.archivedAt,
        version: { increment: 1 },
      },
    });

    return this.mutationResult(input.organizationId, input.campaignId, input.id, result.count);
  }

  async reorderCandidates(input: {
    readonly organizationId: string;
    readonly campaignId: string;
    readonly candidateIds: readonly string[];
    readonly updatedAt: Date;
  }): Promise<CandidateMutationResult> {
    const existing = await this.prisma.candidate.findMany({
      where: {
        organizationId: input.organizationId,
        campaignId: input.campaignId,
        id: { in: [...input.candidateIds] },
      },
      select: { id: true },
    });

    if (existing.length !== input.candidateIds.length) {
      return { outcome: 'NOT_FOUND' };
    }

    await this.prisma.$executeRawUnsafe(
      'SET CONSTRAINTS "uq_candidates_campaign_position" DEFERRED',
    );

    for (const [index, candidateId] of input.candidateIds.entries()) {
      await this.prisma.candidate.updateMany({
        where: {
          id: candidateId,
          organizationId: input.organizationId,
          campaignId: input.campaignId,
        },
        data: {
          position: index + 1,
          updatedAt: input.updatedAt,
          version: { increment: 1 },
        },
      });
    }

    return { outcome: 'UPDATED' };
  }

  private async mutationResult(
    organizationId: string,
    campaignId: string,
    candidateId: string,
    count: number,
  ): Promise<CandidateMutationResult> {
    if (count === 1) {
      return { outcome: 'UPDATED' };
    }

    const existing = await this.findCandidateById({ organizationId, campaignId, candidateId });
    return existing ? { outcome: 'CONFLICT' } : { outcome: 'NOT_FOUND' };
  }
}

export class PrismaCandidateRlsUnitOfWork implements CandidateUnitOfWork {
  constructor(private readonly boundary: PrismaTenantRlsTransactionBoundary) {}

  async transaction<T>(
    work: (repositories: CandidatePersistenceRepositories) => Promise<T>,
  ): Promise<T> {
    return this.boundary.transaction(async (tx) =>
      work({
        candidates: new PrismaCandidateRepository(tx),
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

function toCandidateData(input: CandidateSnapshot): Prisma.CandidateUncheckedCreateInput {
  return {
    id: input.id,
    organizationId: input.organizationId,
    campaignId: input.campaignId,
    displayName: input.displayName,
    slug: input.slug,
    shortDescription: input.shortDescription,
    description: input.description,
    status: input.status,
    position: input.position,
    imageAssetId: input.imageAssetId,
    externalReference: input.externalReference,
    metadata: input.metadata as Prisma.InputJsonValue,
    createdBy: input.createdBy,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    statusReason: input.statusReason,
    archivedAt: input.archivedAt,
    version: input.version,
  };
}

function toCandidateSnapshot(record: CandidateRecord): CandidateSnapshot {
  return {
    id: record.id,
    organizationId: record.organizationId,
    campaignId: record.campaignId,
    displayName: record.displayName,
    slug: record.slug,
    shortDescription: record.shortDescription,
    description: record.description,
    status: record.status,
    position: record.position,
    imageAssetId: record.imageAssetId,
    externalReference: record.externalReference,
    metadata: (record.metadata ?? {}) as Readonly<Record<string, unknown>>,
    createdBy: record.createdBy,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    statusReason: record.statusReason,
    archivedAt: record.archivedAt,
    version: record.version,
  };
}
