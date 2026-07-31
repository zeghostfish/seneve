import { VotingDomainError } from './domain-error.js';

export interface VotingEligibilityInput {
  readonly identityStatus: string;
  readonly emailVerified: boolean;
  readonly campaignStatus: string;
  readonly campaignVisibility: string;
  readonly votingMode: string;
  readonly requiresEmailVerification: boolean;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly candidateStatus: string;
  readonly confirmedVoteCount: number;
  readonly votesPerVoter: number;
  readonly now: Date;
}

export type VotingCampaignAccessInput = Omit<
  VotingEligibilityInput,
  'candidateStatus' | 'confirmedVoteCount' | 'votesPerVoter'
>;

export interface VotingBallotSelectionInput {
  readonly candidateIds: readonly string[];
  readonly requestIds: readonly string[];
  readonly existingCandidateIds: readonly string[];
  readonly confirmedVoteCount: number;
  readonly votesPerVoter: number;
  readonly allowMultipleCandidates: boolean;
}

export type VotingBallotRequestInput = Pick<
  VotingBallotSelectionInput,
  'candidateIds' | 'requestIds'
>;

export function assertVotingCampaignAccess(input: VotingCampaignAccessInput): void {
  if (input.identityStatus !== 'ACTIVE') {
    throw new VotingDomainError('VOTING_IDENTITY_INACTIVE', 'The voting identity is not active.');
  }

  if (input.requiresEmailVerification && !input.emailVerified) {
    throw new VotingDomainError(
      'VOTING_EMAIL_VERIFICATION_REQUIRED',
      'The campaign requires a verified email address.',
    );
  }

  if (input.campaignStatus !== 'ACTIVE') {
    throw new VotingDomainError('VOTING_CAMPAIGN_NOT_ACTIVE', 'The campaign is not active.');
  }

  if (input.campaignVisibility === 'PRIVATE') {
    throw new VotingDomainError(
      'VOTING_CAMPAIGN_PRIVATE',
      'Private campaigns require an explicit voter admission mechanism.',
    );
  }

  if (input.now < input.startsAt || input.now >= input.endsAt) {
    throw new VotingDomainError(
      'VOTING_CAMPAIGN_OUTSIDE_WINDOW',
      'The campaign is outside its configured voting window.',
    );
  }

  if (input.votingMode !== 'FREE') {
    throw new VotingDomainError(
      'VOTING_PAYMENT_REQUIRED',
      'Paid and hybrid voting require the payment workflow.',
    );
  }
}

export function assertVotingEligibility(input: VotingEligibilityInput): void {
  assertVotingCampaignAccess(input);

  if (input.candidateStatus !== 'ELIGIBLE') {
    throw new VotingDomainError(
      'VOTING_CANDIDATE_NOT_ELIGIBLE',
      'The selected candidate is not eligible.',
    );
  }

  if (input.confirmedVoteCount >= input.votesPerVoter) {
    throw new VotingDomainError('VOTING_QUOTA_REACHED', 'The campaign vote quota is reached.');
  }
}

export function assertVotingBallotSelection(input: VotingBallotSelectionInput): void {
  assertVotingBallotRequest(input);
  assertVotingBallotAllocation(input);
}

export function assertVotingBallotRequest(input: VotingBallotRequestInput): void {
  if (input.candidateIds.length === 0) {
    throw new VotingDomainError('VOTING_BALLOT_EMPTY', 'A ballot requires at least one selection.');
  }

  if (new Set(input.candidateIds).size !== input.candidateIds.length) {
    throw new VotingDomainError(
      'VOTING_BALLOT_DUPLICATE_CANDIDATE',
      'A candidate may appear only once in a ballot.',
    );
  }

  if (new Set(input.requestIds).size !== input.requestIds.length) {
    throw new VotingDomainError(
      'VOTING_BALLOT_DUPLICATE_REQUEST',
      'Each ballot selection requires a unique request identifier.',
    );
  }
}

export function assertVotingBallotAllocation(input: VotingBallotSelectionInput): void {
  const resultingCandidates = new Set([...input.existingCandidateIds, ...input.candidateIds]);
  if (!input.allowMultipleCandidates && resultingCandidates.size > 1) {
    throw new VotingDomainError(
      'VOTING_MULTIPLE_CANDIDATES_NOT_ALLOWED',
      'This campaign does not allow votes to be distributed across multiple candidates.',
    );
  }

  if (input.confirmedVoteCount + input.candidateIds.length > input.votesPerVoter) {
    throw new VotingDomainError('VOTING_QUOTA_REACHED', 'The campaign vote quota is reached.');
  }
}
