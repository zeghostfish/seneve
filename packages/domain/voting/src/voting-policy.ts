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

export function assertVotingEligibility(input: VotingEligibilityInput): void {
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
