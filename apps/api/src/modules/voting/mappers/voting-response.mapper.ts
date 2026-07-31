import type { VoteAttemptSnapshot, VotingReceiptReadModel } from '@seneve/domain-voting';
import type { PrivateVotingResultsResult, VotingBallotResult } from '@seneve/voting-application';

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

export function privateVotingResultsResponse(result: PrivateVotingResultsResult) {
  return {
    campaign: {
      id: result.results.campaignId,
      organizationId: result.results.organizationId,
      name: result.results.campaignName,
      status: result.results.campaignStatus,
      resultsVisibility: result.results.resultsVisibility,
      resultRevealAt: result.results.resultRevealAt?.toISOString() ?? null,
    },
    totals: {
      confirmedVotes: result.results.totalConfirmedVotes,
      distinctVoters: result.results.distinctVoterCount,
    },
    candidates: result.results.candidates.map((candidate) => ({
      id: candidate.candidateId,
      displayName: candidate.displayName,
      status: candidate.status,
      position: candidate.position,
      confirmedVotes: candidate.confirmedVotes,
    })),
    generatedAt: result.generatedAt.toISOString(),
  };
}
