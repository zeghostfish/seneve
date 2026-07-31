import type { Prisma, PrismaClient } from '@prisma/client';
import type {
  PrivateVotingResultsReadModel,
  VotingResultsRepository,
  VotingResultsUnitOfWork,
} from '@seneve/domain-voting';
import { PrismaTenantRlsTransactionBoundary } from '@seneve/organization-persistence';

type PrismaExecutor = PrismaClient | Prisma.TransactionClient;

export class PrismaVotingResultsRepository implements VotingResultsRepository {
  constructor(private readonly prisma: PrismaExecutor) {}

  async getPrivateResults(input: {
    readonly organizationId: string;
    readonly campaignId: string;
  }): Promise<PrivateVotingResultsReadModel | null> {
    const campaign = await this.prisma.campaign.findFirst({
      where: {
        id: input.campaignId,
        organizationId: input.organizationId,
      },
      select: {
        id: true,
        organizationId: true,
        name: true,
        status: true,
        resultsVisibility: true,
        resultRevealAt: true,
      },
    });
    if (!campaign) {
      return null;
    }

    const [candidates, voteCounts, voterGroups] = await Promise.all([
      this.prisma.candidate.findMany({
        where: {
          organizationId: input.organizationId,
          campaignId: input.campaignId,
        },
        select: {
          id: true,
          displayName: true,
          status: true,
          position: true,
          createdAt: true,
        },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.voteAttempt.groupBy({
        by: ['candidateId'],
        where: {
          organizationId: input.organizationId,
          campaignId: input.campaignId,
          status: 'CONFIRMED',
        },
        _count: { _all: true },
      }),
      this.prisma.voteAttempt.groupBy({
        by: ['voterIdentityId'],
        where: {
          organizationId: input.organizationId,
          campaignId: input.campaignId,
          status: 'CONFIRMED',
        },
      }),
    ]);
    const countByCandidate = new Map(
      voteCounts.map((result) => [result.candidateId, result._count._all]),
    );

    return {
      organizationId: campaign.organizationId,
      campaignId: campaign.id,
      campaignName: campaign.name,
      campaignStatus: campaign.status,
      resultsVisibility: campaign.resultsVisibility,
      resultRevealAt: campaign.resultRevealAt,
      totalConfirmedVotes: voteCounts.reduce((total, result) => total + result._count._all, 0),
      distinctVoterCount: voterGroups.length,
      candidates: candidates.map((candidate) => ({
        candidateId: candidate.id,
        displayName: candidate.displayName,
        status: candidate.status,
        position: candidate.position,
        confirmedVotes: countByCandidate.get(candidate.id) ?? 0,
      })),
    };
  }
}

export class PrismaVotingResultsRlsUnitOfWork implements VotingResultsUnitOfWork {
  constructor(private readonly boundary: PrismaTenantRlsTransactionBoundary) {}

  transaction<T>(work: (repository: VotingResultsRepository) => Promise<T>): Promise<T> {
    return this.boundary.transaction((tx) => work(new PrismaVotingResultsRepository(tx)));
  }
}
