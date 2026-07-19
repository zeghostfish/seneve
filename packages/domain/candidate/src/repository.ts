import type { CandidateStatus } from './value-objects.js';
import type { CandidateSnapshot } from './candidate.js';

export interface CandidateListFilters {
  readonly status?: CandidateStatus;
  readonly search?: string;
  readonly createdFrom?: Date;
  readonly createdTo?: Date;
  readonly eligibleOnly?: boolean;
  readonly limit: number;
  readonly cursor?: string | null;
}

export interface CandidateListResult {
  readonly candidates: readonly CandidateSnapshot[];
  readonly nextCursor: string | null;
}

export type CandidateMutationResult =
  | { readonly outcome: 'UPDATED' }
  | { readonly outcome: 'NOT_FOUND' }
  | { readonly outcome: 'CONFLICT' };

export interface CandidateRepository {
  createCandidate(input: CandidateSnapshot): Promise<void>;
  countCandidates(input: {
    readonly organizationId: string;
    readonly campaignId: string;
  }): Promise<number>;
  findCandidateById(input: {
    readonly organizationId: string;
    readonly campaignId: string;
    readonly candidateId: string;
  }): Promise<CandidateSnapshot | null>;
  listCandidates(input: {
    readonly organizationId: string;
    readonly campaignId: string;
    readonly filters: CandidateListFilters;
  }): Promise<CandidateListResult>;
  updateCandidate(
    input: CandidateSnapshot & { readonly expectedVersion: number },
  ): Promise<CandidateMutationResult>;
  reorderCandidates(input: {
    readonly organizationId: string;
    readonly campaignId: string;
    readonly candidateIds: readonly string[];
    readonly updatedAt: Date;
  }): Promise<CandidateMutationResult>;
}

export interface CandidatePersistenceRepositories {
  readonly candidates: CandidateRepository;
}

export interface CandidateUnitOfWork {
  transaction<T>(work: (repositories: CandidatePersistenceRepositories) => Promise<T>): Promise<T>;
}
