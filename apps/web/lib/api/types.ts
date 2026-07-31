export interface ApiErrorBody {
  readonly code: string;
  readonly message: string;
  readonly correlationId?: string;
  readonly fieldErrors?: Record<string, readonly string[]>;
}

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiErrorBody,
  ) {
    super(body.message);
    this.name = 'ApiRequestError';
  }
}

export interface RequestOptions<TBody = unknown> {
  readonly method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  readonly body?: TBody;
  readonly accessToken?: string | null;
  readonly signal?: AbortSignal;
  readonly idempotent?: boolean;
}

export interface AccessTokenResponse {
  readonly accessToken: string;
  readonly expiresAt?: string;
}

export interface AuthenticatedResponse extends AccessTokenResponse {
  readonly identityId?: string;
  readonly sessionId?: string;
}

export interface SessionSummary {
  readonly sessionId: string;
  readonly deviceDisplayName?: string | null;
  readonly firstSeenAt?: string | null;
  readonly lastActivityAt?: string | null;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly current?: boolean;
  readonly revoked?: boolean;
}

export interface OrganizationSummary {
  readonly id: string;
  readonly publicId?: string | null;
  readonly displayName: string;
  readonly slug: string;
  readonly status: string;
  readonly defaultLocale: string;
  readonly timezone: string;
  readonly createdAt: string;
  readonly updatedAt?: string;
  readonly version: number;
}

export interface MembershipSummary {
  readonly id: string;
  readonly identityId: string;
  readonly role: string;
  readonly status: string;
  readonly activatedAt?: string | null;
  readonly suspendedAt?: string | null;
  readonly createdAt: string;
}

export interface InvitationSummary {
  readonly id: string;
  readonly normalizedRecipientEmail: string;
  readonly intendedRole: string;
  readonly status: string;
  readonly expiresAt: string;
  readonly createdAt: string;
}

export type CampaignStatus =
  'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED' | 'ARCHIVED';

export type CampaignVisibility = 'PRIVATE' | 'UNLISTED' | 'PUBLIC';
export type CampaignVotingMode = 'FREE' | 'PAID' | 'HYBRID';
export type CampaignResultsVisibility = 'HIDDEN' | 'LIVE' | 'AFTER_CAMPAIGN' | 'SCHEDULED';

export interface CampaignSummary {
  readonly id: string;
  readonly organizationId: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly status: CampaignStatus;
  readonly visibility: CampaignVisibility;
  readonly timezone: string;
  readonly locale: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly rules: {
    readonly votingMode: CampaignVotingMode;
    readonly votesPerVoter: number;
    readonly allowMultipleCandidates: boolean;
    readonly requiresEmailVerification: boolean;
    readonly results: {
      readonly visibility: CampaignResultsVisibility;
      readonly revealAt: string | null;
    };
  };
  readonly createdBy: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly archivedAt: string | null;
  readonly cancelledAt: string | null;
  readonly version: number;
}

export type CandidateStatus =
  'DRAFT' | 'ELIGIBLE' | 'SUSPENDED' | 'WITHDRAWN' | 'DISQUALIFIED' | 'ARCHIVED';

export interface CandidateSummary {
  readonly id: string;
  readonly organizationId: string;
  readonly campaignId: string;
  readonly displayName: string;
  readonly slug: string;
  readonly shortDescription: string | null;
  readonly description: string | null;
  readonly status: CandidateStatus;
  readonly position: number;
  readonly imageAssetId: string | null;
  readonly externalReference: string | null;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly statusReason: string | null;
  readonly archivedAt: string | null;
  readonly version: number;
}

export interface VotingBallot {
  readonly campaign: {
    readonly id: string;
    readonly organizationId: string;
    readonly name: string;
    readonly description: string | null;
    readonly visibility: 'UNLISTED' | 'PUBLIC';
    readonly timezone: string;
    readonly locale: string;
    readonly startsAt: string;
    readonly endsAt: string;
    readonly votesPerVoter: number;
    readonly allowMultipleCandidates: boolean;
  };
  readonly candidates: readonly VotingBallotCandidate[];
  readonly confirmedVoteCount: number;
  readonly remainingVotes: number;
}

export interface VotingBallotCandidate {
  readonly id: string;
  readonly displayName: string;
  readonly slug: string;
  readonly shortDescription: string | null;
  readonly imageAssetId: string | null;
  readonly position: number;
}

export interface VotingReceipt {
  readonly id: string;
  readonly organizationId: string;
  readonly campaignId: string;
  readonly candidateId: string;
  readonly status: 'PENDING' | 'CONFIRMED' | 'REJECTED';
  readonly rejectionCode: string | null;
  readonly createdAt: string;
  readonly confirmedAt: string | null;
  readonly rejectedAt: string | null;
  readonly version: number;
}
