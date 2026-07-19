import type { PermissionEvaluationService } from '@seneve/authorization-application';
import type {
  CampaignDomainEvent,
  CampaignRepository,
  CampaignUnitOfWork,
  PersistedCampaignReadModel,
} from '@seneve/domain-campaign';
import type { IdentityRepository } from '@seneve/domain-identity';
import type { OrganizationRepository } from '@seneve/domain-organization';
import type { TenantExecutionContext } from '@seneve/tenant-context';

export interface Clock {
  now(): Date;
}

export interface CampaignIdGenerator {
  uuid(): string;
}

export interface CampaignAuditEventRecorder {
  record(event: CampaignDomainEvent): Promise<unknown>;
}

export interface CampaignApplicationDependencies {
  readonly unitOfWork: CampaignUnitOfWork;
  readonly campaigns: CampaignRepository;
  readonly organizations: OrganizationRepository;
  readonly identities: IdentityRepository;
  readonly permissions: PermissionEvaluationService;
  readonly executionContext: TenantExecutionContext;
  readonly auditEvents: CampaignAuditEventRecorder;
  readonly ids: CampaignIdGenerator;
  readonly clock: Clock;
}

export interface CampaignCommandResult {
  readonly campaign: PersistedCampaignReadModel;
}
