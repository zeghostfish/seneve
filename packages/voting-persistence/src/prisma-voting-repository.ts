import type { Prisma, PrismaClient } from '@prisma/client';
import type {
  VoteAttemptRepository,
  VoteAttemptDomainEvent,
  VoteAttemptSnapshot,
  VotingReceiptListResult,
  VotingRepositories,
  VotingUnitOfWork,
} from '@seneve/domain-voting';
import { PrismaTenantRlsTransactionBoundary } from '@seneve/organization-persistence';

type PrismaExecutor = PrismaClient | Prisma.TransactionClient;

export class PrismaVoteAttemptRepository implements VoteAttemptRepository {
  constructor(private readonly prisma: PrismaExecutor) {}

  async lockVoter(input: {
    readonly organizationId: string;
    readonly campaignId: string;
    readonly voterIdentityId: string;
  }): Promise<void> {
    const key = `${input.organizationId}:${input.campaignId}:${input.voterIdentityId}`;
    await this.prisma.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
  }

  async findByRequest(input: {
    readonly organizationId: string;
    readonly campaignId: string;
    readonly voterIdentityId: string;
    readonly requestId: string;
  }): Promise<VoteAttemptSnapshot | null> {
    const record = await this.prisma.voteAttempt.findUnique({
      where: {
        organizationId_campaignId_voterIdentityId_requestId: input,
      },
    });
    return record ? toSnapshot(record) : null;
  }

  countConfirmed(input: {
    readonly organizationId: string;
    readonly campaignId: string;
    readonly voterIdentityId: string;
  }): Promise<number> {
    return this.prisma.voteAttempt.count({ where: { ...input, status: 'CONFIRMED' } });
  }

  async listConfirmedCandidateIds(input: {
    readonly organizationId: string;
    readonly campaignId: string;
    readonly voterIdentityId: string;
  }): Promise<readonly string[]> {
    const records = await this.prisma.voteAttempt.findMany({
      where: { ...input, status: 'CONFIRMED' },
      distinct: ['candidateId'],
      select: { candidateId: true },
    });
    return records.map((record) => record.candidateId);
  }

  async create(attempt: VoteAttemptSnapshot): Promise<void> {
    await this.prisma.voteAttempt.create({ data: attempt });
  }

  async findOwnedById(input: {
    readonly organizationId: string;
    readonly voterIdentityId: string;
    readonly voteAttemptId: string;
  }): Promise<VoteAttemptSnapshot | null> {
    const record = await this.prisma.voteAttempt.findFirst({
      where: {
        id: input.voteAttemptId,
        organizationId: input.organizationId,
        voterIdentityId: input.voterIdentityId,
      },
    });
    return record ? toSnapshot(record) : null;
  }

  async listOwned(input: {
    readonly organizationId: string;
    readonly voterIdentityId: string;
    readonly limit: number;
    readonly cursor: string | null;
  }): Promise<VotingReceiptListResult> {
    const records = await this.prisma.voteAttempt.findMany({
      where: {
        organizationId: input.organizationId,
        voterIdentityId: input.voterIdentityId,
        status: 'CONFIRMED',
      },
      select: {
        id: true,
        organizationId: true,
        campaignId: true,
        candidateId: true,
        status: true,
        createdAt: true,
        confirmedAt: true,
        campaign: { select: { name: true } },
        candidate: { select: { displayName: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: input.limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    });
    const hasNextPage = records.length > input.limit;
    const visible = hasNextPage ? records.slice(0, input.limit) : records;

    return {
      receipts: visible.map((record) => ({
        id: record.id,
        organizationId: record.organizationId,
        campaignId: record.campaignId,
        campaignName: record.campaign.name,
        candidateId: record.candidateId,
        candidateDisplayName: record.candidate.displayName,
        status: record.status,
        createdAt: record.createdAt,
        confirmedAt: record.confirmedAt,
      })),
      nextCursor: hasNextPage ? (visible.at(-1)?.id ?? null) : null,
    };
  }
}

export class PrismaVotingRlsUnitOfWork implements VotingUnitOfWork {
  constructor(
    private readonly boundary: PrismaTenantRlsTransactionBoundary,
    private readonly auditRecorderFactory: (tx: Prisma.TransactionClient) => {
      record(event: VoteAttemptDomainEvent): Promise<unknown>;
    },
  ) {}

  transaction<T>(work: (repositories: VotingRepositories) => Promise<T>): Promise<T> {
    return this.boundary.transaction(
      async (tx) => {
        const votes = new PrismaVoteAttemptRepository(tx);
        return work({
          votes,
          auditEvents: this.auditRecorderFactory(tx),
          findCampaign: async (input) =>
            tx.campaign.findFirst({
              where: { id: input.campaignId, organizationId: input.organizationId },
              select: {
                id: true,
                organizationId: true,
                name: true,
                description: true,
                status: true,
                visibility: true,
                timezone: true,
                locale: true,
                votingMode: true,
                votesPerVoter: true,
                allowMultipleCandidates: true,
                requiresEmailVerification: true,
                startsAt: true,
                endsAt: true,
              },
            }),
          findCandidate: async (input) =>
            tx.candidate.findFirst({
              where: {
                id: input.candidateId,
                organizationId: input.organizationId,
                campaignId: input.campaignId,
              },
              select: candidateSelection,
            }),
          listEligibleCandidates: async (input) =>
            tx.candidate.findMany({
              where: {
                organizationId: input.organizationId,
                campaignId: input.campaignId,
                status: 'ELIGIBLE',
              },
              select: candidateSelection,
              orderBy: [{ position: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
            }),
        });
      },
      { operation: 'VOTE_SUBMISSION' },
    );
  }
}

const candidateSelection = {
  id: true,
  organizationId: true,
  campaignId: true,
  displayName: true,
  slug: true,
  shortDescription: true,
  imageAssetId: true,
  position: true,
  status: true,
} as const;

type VoteRecord = Prisma.VoteAttemptGetPayload<Record<string, never>>;

function toSnapshot(record: VoteRecord): VoteAttemptSnapshot {
  return {
    id: record.id,
    organizationId: record.organizationId,
    campaignId: record.campaignId,
    candidateId: record.candidateId,
    voterIdentityId: record.voterIdentityId,
    requestId: record.requestId,
    status: record.status,
    rejectionCode: record.rejectionCode,
    createdAt: record.createdAt,
    confirmedAt: record.confirmedAt,
    rejectedAt: record.rejectedAt,
    version: record.version,
  };
}
