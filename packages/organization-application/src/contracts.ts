import type { OrganizationAuditEventRecorder } from '@seneve/audit-application';
import type { PermissionEvaluationService, PermissionId } from '@seneve/authorization-application';
import type { IdentityRepository } from '@seneve/domain-identity';
import type {
  OrganizationRepository,
  OrganizationPersistenceRepositories,
  OrganizationUnitOfWork,
  PersistedOrganizationInvitationReadModel,
  PersistedOrganizationReadModel,
} from '@seneve/domain-organization';
import type { TokenGenerator, TokenHasher } from '@seneve/identity-application';
import type { TenantExecutionContext } from '@seneve/tenant-context';

export interface Clock {
  now(): Date;
}

export interface OrganizationIdGenerator {
  uuid(): string;
}

export type OrganizationInvitationTokenGenerator = TokenGenerator;

export interface OrganizationApplicationDependencies {
  readonly unitOfWork: OrganizationTransactionalUnitOfWork;
  readonly organizations: OrganizationRepository;
  readonly identities: IdentityRepository;
  readonly permissions: PermissionEvaluationService;
  readonly executionContext: TenantExecutionContext;
  readonly auditEvents: OrganizationAuditEventRecorder;
  readonly ids: OrganizationIdGenerator;
  readonly invitationTokens: OrganizationInvitationTokenGenerator;
  readonly tokenHasher: TokenHasher;
  readonly clock: Clock;
  readonly invitationTtlSeconds: number;
}

export interface InvitationDeliveryCommand {
  readonly recipientEmail: string;
  readonly template: 'organization.invitation';
  readonly organizationId: string;
  readonly invitationId: string;
  readonly rawInvitationToken: string;
  readonly invitationTokenId: string;
  readonly expiresAt: Date;
  readonly correlationId: string;
}

export interface OrganizationCommandResult {
  readonly organization: PersistedOrganizationReadModel;
}

export interface InvitationCommandResult {
  readonly invitation: PersistedOrganizationInvitationReadModel;
  readonly notification: InvitationDeliveryCommand;
}

export type OrganizationPermission = PermissionId;

export interface OrganizationTransactionalUnitOfWork extends OrganizationUnitOfWork {
  transaction<T>(
    work: (repositories: OrganizationPersistenceRepositories) => Promise<T>,
    options?: { readonly operation?: string; readonly tenantId?: string },
  ): Promise<T>;
}
