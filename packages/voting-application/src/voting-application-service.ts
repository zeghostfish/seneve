import {
  VotingDomainError,
  VoteAttempt,
  type VoteAttemptSnapshot,
  assertVotingBallotAllocation,
  assertVotingBallotRequest,
  assertVotingCampaignAccess,
  assertVotingEligibility,
} from '@seneve/domain-voting';
import { authenticatedVotingTenantContext } from '@seneve/tenant-context';

import { VotingApplicationError } from './application-error.js';
import type {
  BallotCommandResult,
  SubmitBallotCommand,
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
    const result = await this.submitFreeBallot({
      voterIdentityId: command.voterIdentityId,
      organizationId: command.organizationId,
      campaignId: command.campaignId,
      selections: [{ candidateId: command.candidateId, requestId: command.requestId }],
      correlationId: command.correlationId,
    });
    const vote = result.votes[0];
    if (!vote) {
      throw new VotingApplicationError(
        'VOTING_TRANSACTION_FAILED',
        'The vote transaction returned no vote.',
      );
    }
    return { vote, replayed: result.replayed };
  }

  async submitFreeBallot(command: SubmitBallotCommand): Promise<BallotCommandResult> {
    translateDomainErrors(() =>
      assertVotingBallotRequest({
        candidateIds: command.selections.map((selection) => selection.candidateId),
        requestIds: command.selections.map((selection) => selection.requestId),
      }),
    );
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
        const previous = await Promise.all(
          command.selections.map((selection) =>
            repositories.votes.findByRequest({ ...command, requestId: selection.requestId }),
          ),
        );
        for (const [index, vote] of previous.entries()) {
          if (vote && vote.candidateId !== command.selections[index]?.candidateId) {
            throw new VotingApplicationError(
              'VOTE_REQUEST_CONFLICT',
              'The vote request identifier is already used for another candidate.',
            );
          }
        }
        if (previous.every(Boolean)) {
          return { votes: previous as VoteAttemptSnapshot[], replayed: true };
        }

        const pendingSelections = command.selections.filter((_, index) => !previous[index]);

        const campaign = await repositories.findCampaign(command);
        if (!campaign) {
          throw new VotingApplicationError('VOTING_CAMPAIGN_NOT_FOUND', 'Campaign not found.');
        }
        const [confirmedVoteCount, existingCandidateIds] = await Promise.all([
          repositories.votes.countConfirmed(command),
          repositories.votes.listConfirmedCandidateIds(command),
        ]);
        const now = this.deps.clock.now();
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
            now,
          }),
        );
        translateDomainErrors(() =>
          assertVotingBallotAllocation({
            candidateIds: pendingSelections.map((selection) => selection.candidateId),
            requestIds: pendingSelections.map((selection) => selection.requestId),
            existingCandidateIds,
            confirmedVoteCount,
            votesPerVoter: campaign.votesPerVoter,
            allowMultipleCandidates: campaign.allowMultipleCandidates,
          }),
        );

        const eventMetadata = () => ({
          eventId: this.deps.ids.uuid(),
          correlationId: command.correlationId,
          actorIdentityId: command.voterIdentityId,
          occurredAt: now,
        });
        const createdVotes = new Map<string, VoteAttemptSnapshot>();
        for (const selection of pendingSelections) {
          const candidate = await repositories.findCandidate({
            ...command,
            candidateId: selection.candidateId,
          });
          if (!candidate) {
            throw new VotingApplicationError('VOTING_CANDIDATE_NOT_FOUND', 'Candidate not found.');
          }
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

          const pending = translateDomainErrors(() =>
            VoteAttempt.create({
              id: this.deps.ids.uuid(),
              organizationId: command.organizationId,
              campaignId: command.campaignId,
              candidateId: selection.candidateId,
              voterIdentityId: command.voterIdentityId,
              requestId: selection.requestId,
              createdAt: now,
              metadata: eventMetadata(),
            }),
          );
          const createdEvents = pending.pullDomainEvents();
          const confirmed = translateDomainErrors(() =>
            pending.confirm({ confirmedAt: now, metadata: eventMetadata() }),
          );
          const confirmedEvents = confirmed.pullDomainEvents();
          const snapshot = confirmed.toSnapshot();

          await repositories.votes.create(snapshot);
          for (const event of [...createdEvents, ...confirmedEvents]) {
            await repositories.auditEvents.record(event);
          }
          createdVotes.set(selection.requestId, snapshot);
        }

        return {
          votes: command.selections.map((selection, index) => {
            const vote = previous[index] ?? createdVotes.get(selection.requestId);
            if (!vote) {
              throw new VotingApplicationError(
                'VOTING_TRANSACTION_FAILED',
                'The ballot transaction returned an incomplete result.',
              );
            }
            return vote;
          }),
          replayed: false,
        };
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
