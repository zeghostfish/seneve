import type { VoteAttemptSnapshot } from '@seneve/domain-voting';

export function votingResponse(vote: VoteAttemptSnapshot) {
  return {
    id: vote.id,
    organizationId: vote.organizationId,
    campaignId: vote.campaignId,
    candidateId: vote.candidateId,
    status: vote.status,
    rejectionCode: vote.rejectionCode,
    createdAt: vote.createdAt.toISOString(),
    confirmedAt: vote.confirmedAt?.toISOString() ?? null,
    rejectedAt: vote.rejectedAt?.toISOString() ?? null,
    version: vote.version,
  };
}
