import type { Prisma, PrismaClient } from '@prisma/client';
import type {
  VoteAttemptRepository,
  VoteAttemptDomainEvent,
  VoteAttemptSnapshot,
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
                status: true,
                visibility: true,
                votingMode: true,
                votesPerVoter: true,
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
              select: { id: true, organizationId: true, campaignId: true, status: true },
            }),
        });
      },
      { operation: 'VOTE_SUBMISSION' },
    );
  }
}

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
