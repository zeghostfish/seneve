import type { CampaignRulesSnapshot, CampaignStatus, CampaignVisibility } from './value-objects.js';

export interface PersistedCampaignReadModel {
  readonly id: string;
  readonly organizationId: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly status: CampaignStatus;
  readonly visibility: CampaignVisibility;
  readonly timezone: string;
  readonly locale: string;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly rules: CampaignRulesSnapshot;
  readonly createdBy: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly archivedAt: Date | null;
  readonly cancelledAt: Date | null;
  readonly version: number;
}

export interface CampaignListFilters {
  readonly status?: CampaignStatus;
  readonly visibility?: CampaignVisibility;
  readonly search?: string;
  readonly createdFrom?: Date;
  readonly createdTo?: Date;
  readonly startsFrom?: Date;
  readonly startsTo?: Date;
  readonly limit: number;
  readonly cursor?: string | null;
}

export interface CampaignListResult {
  readonly campaigns: readonly PersistedCampaignReadModel[];
  readonly nextCursor: string | null;
}

export interface PersistedCampaignCreate {
  readonly id: string;
  readonly organizationId: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly status: CampaignStatus;
  readonly visibility: CampaignVisibility;
  readonly timezone: string;
  readonly locale: string;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly rules: CampaignRulesSnapshot;
  readonly createdBy: string;
  readonly createdAt: Date;
  readonly version: number;
}

export interface PersistedCampaignUpdate {
  readonly id: string;
  readonly organizationId: string;
  readonly expectedVersion: number;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly visibility: CampaignVisibility;
  readonly updatedAt: Date;
}

export interface PersistedCampaignRulesUpdate {
  readonly id: string;
  readonly organizationId: string;
  readonly expectedVersion: number;
  readonly rules: CampaignRulesSnapshot;
  readonly updatedAt: Date;
}

export interface PersistedCampaignScheduleUpdate {
  readonly id: string;
  readonly organizationId: string;
  readonly expectedVersion: number;
  readonly status: CampaignStatus;
  readonly timezone: string;
  readonly locale: string;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly updatedAt: Date;
}

export interface PersistedCampaignStatusUpdate {
  readonly id: string;
  readonly organizationId: string;
  readonly expectedVersion: number;
  readonly status: CampaignStatus;
  readonly updatedAt: Date;
  readonly archivedAt?: Date | null;
  readonly cancelledAt?: Date | null;
}

export type CampaignMutationResult =
  | { readonly outcome: 'UPDATED' }
  | { readonly outcome: 'NOT_FOUND' }
  | { readonly outcome: 'CONFLICT' };

export interface CampaignRepository {
  createCampaign(input: PersistedCampaignCreate): Promise<void>;
  findCampaignById(input: {
    readonly organizationId: string;
    readonly campaignId: string;
  }): Promise<PersistedCampaignReadModel | null>;
  listCampaigns(input: {
    readonly organizationId: string;
    readonly filters: CampaignListFilters;
  }): Promise<CampaignListResult>;
  updateCampaign(input: PersistedCampaignUpdate): Promise<CampaignMutationResult>;
  updateCampaignRules(input: PersistedCampaignRulesUpdate): Promise<CampaignMutationResult>;
  updateCampaignSchedule(input: PersistedCampaignScheduleUpdate): Promise<CampaignMutationResult>;
  updateCampaignStatus(input: PersistedCampaignStatusUpdate): Promise<CampaignMutationResult>;
}

export interface CampaignPersistenceRepositories {
  readonly campaigns: CampaignRepository;
}

export interface CampaignUnitOfWork {
  transaction<T>(work: (repositories: CampaignPersistenceRepositories) => Promise<T>): Promise<T>;
}
