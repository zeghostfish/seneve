import { Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { AppendAuditRecordService, CampaignAuditEventRecorder } from '@seneve/audit-application';
import { PrismaAuditRepository } from '@seneve/audit-persistence';
import { PermissionEvaluationService } from '@seneve/authorization-application';
import { CampaignApplicationService } from '@seneve/campaign-application';
import {
  PrismaCampaignRepository,
  PrismaCampaignRlsUnitOfWork,
} from '@seneve/campaign-persistence';
import { NodeOpaqueTokenGenerator } from '@seneve/identity-crypto';
import { PrismaIdentityRepository } from '@seneve/identity-persistence';
import {
  PrismaOrganizationRepository,
  PrismaTenantRlsTransactionBoundary,
} from '@seneve/organization-persistence';
import { tenantContextProvider, TenantExecutionContext } from '@seneve/tenant-context';

import { AuthModule } from '../auth/auth.module.js';
import { CampaignController } from './campaign.controller.js';
import { CAMPAIGN_APPLICATION_SERVICE } from './campaign.tokens.js';

const CAMPAIGN_PRISMA = Symbol('CAMPAIGN_PRISMA');

@Module({
  imports: [AuthModule],
  controllers: [CampaignController],
  providers: [
    {
      provide: CAMPAIGN_PRISMA,
      useFactory: () => new PrismaClient(),
    },
    {
      provide: TenantExecutionContext,
      useFactory: () => new TenantExecutionContext(tenantContextProvider),
    },
    {
      provide: CAMPAIGN_APPLICATION_SERVICE,
      inject: [CAMPAIGN_PRISMA, TenantExecutionContext],
      useFactory: (prisma: PrismaClient, executionContext: TenantExecutionContext) => {
        const ids = new NodeOpaqueTokenGenerator();

        return new CampaignApplicationService({
          unitOfWork: new PrismaCampaignRlsUnitOfWork(
            new PrismaTenantRlsTransactionBoundary(prisma, executionContext),
          ),
          campaigns: new PrismaCampaignRepository(prisma),
          organizations: new PrismaOrganizationRepository(prisma),
          identities: new PrismaIdentityRepository(prisma),
          permissions: new PermissionEvaluationService(),
          executionContext,
          auditEvents: new CampaignAuditEventRecorder(
            new AppendAuditRecordService({
              repository: new PrismaAuditRepository(prisma),
              executionContext,
              ids,
              now: () => new Date(),
            }),
          ),
          ids,
          clock: {
            now: () => new Date(),
          },
        });
      },
    },
  ],
})
export class CampaignModule {}
