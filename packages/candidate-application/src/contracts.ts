import type { PermissionEvaluationService } from '@seneve/authorization-application';
import type { CampaignRepository, PersistedCampaignReadModel } from '@seneve/domain-campaign';
import type {
  CandidateDomainEvent,
  CandidateRepository,
  CandidateSnapshot,
  CandidateUnitOfWork,
} from '@seneve/domain-candidate';
import type { IdentityRepository } from '@seneve/domain-identity';
import type { OrganizationRepository } from '@seneve/domain-organization';
import type { TenantExecutionContext } from '@seneve/tenant-context';

export interface Clock {
  now(): Date;
}

export interface CandidateIdGenerator {
  uuid(): string;
}

export interface CandidateAuditEventRecorder {
  record(event: CandidateDomainEvent): Promise<unknown>;
}

export interface CandidateApplicationDependencies {
  readonly unitOfWork: CandidateUnitOfWork;
  readonly candidates: CandidateRepository;
  readonly campaigns: CampaignRepository;
  readonly organizations: OrganizationRepository;
  readonly identities: IdentityRepository;
  readonly permissions: PermissionEvaluationService;
  readonly executionContext: TenantExecutionContext;
  readonly auditEvents: CandidateAuditEventRecorder;
  readonly ids: CandidateIdGenerator;
  readonly clock: Clock;
  readonly maxCandidatesPerCampaign: number;
}

export interface CandidateCommandResult {
  readonly candidate: CandidateSnapshot;
}

export interface CampaignCandidateContext {
  readonly campaign: PersistedCampaignReadModel;
}
