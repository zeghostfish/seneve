import {
  VotingDomainError,
  VoteAttempt,
  assertVotingCampaignAccess,
  assertVotingEligibility,
} from '@seneve/domain-voting';
import { authenticatedVotingTenantContext } from '@seneve/tenant-context';

import { VotingApplicationError } from './application-error.js';
import type {
  SubmitVoteCommand,
  VoteCommandResult,
  VotingBallotResult,
  VotingHistoryResult,
  VotingApplicationDependencies,
} from './contracts.js';

export class VotingApplicationService {
  constructor(private readonly deps: VotingApplicationDependencies) {}

  async getBallot(input: {
    readonly voterIdentityId: string;
    readonly organizationId: string;
    readonly campaignId: string;
    readonly correlationId: string;
  }): Promise<VotingBallotResult> {
    const identity = await this.requireIdentity(input.voterIdentityId);
    const context = authenticatedVotingTenantContext({
      tenantId: input.organizationId,
      identityId: input.voterIdentityId,
      correlationId: input.correlationId,
      executionSource: 'HTTP_REQUEST',
    });

    return this.deps.executionContext.run(context, () =>
      this.deps.unitOfWork.transaction(async (repositories) => {
        const campaign = await repositories.findCampaign(input);
        if (!campaign) {
          throw new VotingApplicationError('VOTING_CAMPAIGN_NOT_FOUND', 'Campaign not found.');
        }

        translateDomainErrors(() =>
          assertVotingCampaignAccess({
            identityStatus: identity.status,
            emailVerified: Boolean(identity.primaryEmail.verifiedAt),
            campaignStatus: campaign.status,
            campaignVisibility: campaign.visibility,
            votingMode: campaign.votingMode,
            requiresEmailVerification: campaign.requiresEmailVerification,
            startsAt: campaign.startsAt,
            endsAt: campaign.endsAt,
            now: this.deps.clock.now(),
          }),
        );

        const [candidates, confirmedVoteCount] = await Promise.all([
          repositories.listEligibleCandidates(input),
          repositories.votes.countConfirmed(input),
        ]);

        return {
          campaign,
          candidates,
          confirmedVoteCount,
          remainingVotes: Math.max(0, campaign.votesPerVoter - confirmedVoteCount),
        };
      }),
    );
  }

  async submitFreeVote(command: SubmitVoteCommand): Promise<VoteCommandResult> {
    const identity = await this.requireIdentity(command.voterIdentityId);

    const context = authenticatedVotingTenantContext({
      tenantId: command.organizationId,
      identityId: command.voterIdentityId,
      correlationId: command.correlationId,
      executionSource: 'HTTP_REQUEST',
    });

    return this.deps.executionContext.run(context, () =>
      this.deps.unitOfWork.transaction(async (repositories) => {
        await repositories.votes.lockVoter(command);
        const previous = await repositories.votes.findByRequest(command);
        if (previous) {
          if (previous.candidateId !== command.candidateId) {
            throw new VotingApplicationError(
              'VOTE_REQUEST_CONFLICT',
              'The vote request identifier is already used for another candidate.',
            );
          }
          return { vote: previous, replayed: true };
        }

        const campaign = await repositories.findCampaign(command);
        if (!campaign) {
          throw new VotingApplicationError('VOTING_CAMPAIGN_NOT_FOUND', 'Campaign not found.');
        }
        const candidate = await repositories.findCandidate(command);
        if (!candidate) {
          throw new VotingApplicationError('VOTING_CANDIDATE_NOT_FOUND', 'Candidate not found.');
        }

        const confirmedVoteCount = await repositories.votes.countConfirmed(command);
        const now = this.deps.clock.now();
        translateDomainErrors(() =>
          assertVotingEligibility({
            identityStatus: identity.status,
            emailVerified: Boolean(identity.primaryEmail.verifiedAt),
            campaignStatus: campaign.status,
            campaignVisibility: campaign.visibility,
            votingMode: campaign.votingMode,
            requiresEmailVerification: campaign.requiresEmailVerification,
            startsAt: campaign.startsAt,
            endsAt: campaign.endsAt,
            candidateStatus: candidate.status,
            confirmedVoteCount,
            votesPerVoter: campaign.votesPerVoter,
            now,
          }),
        );

        const eventMetadata = () => ({
          eventId: this.deps.ids.uuid(),
          correlationId: command.correlationId,
          actorIdentityId: command.voterIdentityId,
          occurredAt: now,
        });
        const pending = translateDomainErrors(() =>
          VoteAttempt.create({
            id: this.deps.ids.uuid(),
            organizationId: command.organizationId,
            campaignId: command.campaignId,
            candidateId: command.candidateId,
            voterIdentityId: command.voterIdentityId,
            requestId: command.requestId,
            createdAt: now,
            metadata: eventMetadata(),
          }),
        );
        const createdEvents = pending.pullDomainEvents();
        const confirmed = translateDomainErrors(() =>
          pending.confirm({ confirmedAt: now, metadata: eventMetadata() }),
        );
        const confirmedEvents = confirmed.pullDomainEvents();

        await repositories.votes.create(confirmed.toSnapshot());
        for (const event of [...createdEvents, ...confirmedEvents]) {
          await repositories.auditEvents.record(event);
        }

        return { vote: confirmed.toSnapshot(), replayed: false };
      }),
    );
  }

  async getOwnVote(input: {
    readonly voterIdentityId: string;
    readonly organizationId: string;
    readonly voteAttemptId: string;
    readonly correlationId: string;
  }): Promise<VoteCommandResult> {
    const context = authenticatedVotingTenantContext({
      tenantId: input.organizationId,
      identityId: input.voterIdentityId,
      correlationId: input.correlationId,
      executionSource: 'HTTP_REQUEST',
    });
    const vote = await this.deps.executionContext.run(context, () =>
      this.deps.unitOfWork.transaction((repositories) => repositories.votes.findOwnedById(input)),
    );
    if (!vote) {
      throw new VotingApplicationError('VOTE_NOT_FOUND', 'Vote not found.');
    }
    return { vote, replayed: false };
  }

  async listOwnVotes(input: {
    readonly voterIdentityId: string;
    readonly organizationId: string;
    readonly limit: number;
    readonly cursor: string | null;
    readonly correlationId: string;
  }): Promise<VotingHistoryResult> {
    const context = authenticatedVotingTenantContext({
      tenantId: input.organizationId,
      identityId: input.voterIdentityId,
      correlationId: input.correlationId,
      executionSource: 'HTTP_REQUEST',
    });

    return this.deps.executionContext.run(context, () =>
      this.deps.unitOfWork.transaction((repositories) => repositories.votes.listOwned(input)),
    );
  }

  private async requireIdentity(identityId: string) {
    const identity = await this.deps.identities.findById(identityId);
    if (!identity) {
      throw new VotingApplicationError('VOTING_IDENTITY_NOT_FOUND', 'Voting identity not found.');
    }
    return identity;
  }
}

function translateDomainErrors<T>(work: () => T): T {
  try {
    return work();
  } catch (error) {
    if (error instanceof VotingDomainError) {
      throw new VotingApplicationError(error.code, error.message);
    }
    throw error;
  }
}
