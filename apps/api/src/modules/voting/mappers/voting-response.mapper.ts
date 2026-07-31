import type { VoteAttemptSnapshot, VotingReceiptReadModel } from '@seneve/domain-voting';
import type { VotingBallotResult } from '@seneve/voting-application';

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

export function ballotResponse(result: VotingBallotResult) {
  return {
    campaign: {
      id: result.campaign.id,
      organizationId: result.campaign.organizationId,
      name: result.campaign.name,
      description: result.campaign.description,
      visibility: result.campaign.visibility,
      timezone: result.campaign.timezone,
      locale: result.campaign.locale,
      startsAt: result.campaign.startsAt.toISOString(),
      endsAt: result.campaign.endsAt.toISOString(),
      votesPerVoter: result.campaign.votesPerVoter,
      allowMultipleCandidates: result.campaign.allowMultipleCandidates,
    },
    candidates: result.candidates.map((candidate) => ({
      id: candidate.id,
      displayName: candidate.displayName,
      slug: candidate.slug,
      shortDescription: candidate.shortDescription,
      imageAssetId: candidate.imageAssetId,
      position: candidate.position,
    })),
    confirmedVoteCount: result.confirmedVoteCount,
    remainingVotes: result.remainingVotes,
  };
}

export function votingReceiptResponse(receipt: VotingReceiptReadModel) {
  return {
    id: receipt.id,
    organizationId: receipt.organizationId,
    campaignId: receipt.campaignId,
    campaignName: receipt.campaignName,
    candidateId: receipt.candidateId,
    candidateDisplayName: receipt.candidateDisplayName,
    status: receipt.status,
    createdAt: receipt.createdAt.toISOString(),
    confirmedAt: receipt.confirmedAt?.toISOString() ?? null,
  };
}
