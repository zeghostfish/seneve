import { Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import {
  AppendAuditRecordService,
  OrganizationAuditEventRecorder,
} from '@seneve/audit-application';
import { PrismaAuditRepository } from '@seneve/audit-persistence';
import { PermissionEvaluationService } from '@seneve/authorization-application';
import { loadFoundationConfig } from '@seneve/config';
import { HmacSha256TokenHasher, NodeOpaqueTokenGenerator } from '@seneve/identity-crypto';
import { PrismaIdentityRepository } from '@seneve/identity-persistence';
import { OrganizationApplicationService } from '@seneve/organization-application';
import {
  PrismaOrganizationRepository,
  PrismaOrganizationRlsUnitOfWork,
  PrismaTenantRlsTransactionBoundary,
} from '@seneve/organization-persistence';
import { tenantContextProvider, TenantExecutionContext } from '@seneve/tenant-context';

import { AuthModule } from '../auth/auth.module.js';
import {
  InvitationAcceptanceController,
  OrganizationController,
} from './organization.controller.js';
import {
  ORGANIZATION_APPLICATION_SERVICE,
  ORGANIZATION_NOTIFICATION_SINK,
} from './organization.tokens.js';
import { NoopOrganizationNotificationSink } from './providers/organization-notification-sink.js';

const ORGANIZATION_PRISMA = Symbol('ORGANIZATION_PRISMA');

@Module({
  imports: [AuthModule],
  controllers: [OrganizationController, InvitationAcceptanceController],
  providers: [
    {
      provide: ORGANIZATION_PRISMA,
      useFactory: () => new PrismaClient(),
    },
    {
      provide: TenantExecutionContext,
      useFactory: () => new TenantExecutionContext(tenantContextProvider),
    },
    {
      provide: ORGANIZATION_NOTIFICATION_SINK,
      useClass: NoopOrganizationNotificationSink,
    },
    {
      provide: ORGANIZATION_APPLICATION_SERVICE,
      inject: [ORGANIZATION_PRISMA, TenantExecutionContext],
      useFactory: (prisma: PrismaClient, executionContext: TenantExecutionContext) => {
        const tokenGenerator = new NodeOpaqueTokenGenerator();

        return new OrganizationApplicationService({
          unitOfWork: new PrismaOrganizationRlsUnitOfWork(
            new PrismaTenantRlsTransactionBoundary(prisma, executionContext),
          ),
          organizations: new PrismaOrganizationRepository(prisma),
          identities: new PrismaIdentityRepository(prisma),
          permissions: new PermissionEvaluationService(),
          executionContext,
          auditEvents: new OrganizationAuditEventRecorder(
            new AppendAuditRecordService({
              repository: new PrismaAuditRepository(prisma),
              executionContext,
              ids: tokenGenerator,
              now: () => new Date(),
            }),
          ),
          ids: tokenGenerator,
          invitationTokens: tokenGenerator,
          tokenHasher: new HmacSha256TokenHasher(loadFoundationConfig().refreshTokenSecret),
          clock: {
            now: () => new Date(),
          },
          invitationTtlSeconds: 7 * 24 * 60 * 60,
        });
      },
    },
  ],
})
export class OrganizationModule {}
