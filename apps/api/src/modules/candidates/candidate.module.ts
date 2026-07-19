import { Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { AppendAuditRecordService, CandidateAuditEventRecorder } from '@seneve/audit-application';
import { PrismaAuditRepository } from '@seneve/audit-persistence';
import { PermissionEvaluationService } from '@seneve/authorization-application';
import { CandidateApplicationService } from '@seneve/candidate-application';
import {
  PrismaCandidateRepository,
  PrismaCandidateRlsUnitOfWork,
} from '@seneve/candidate-persistence';
import { PrismaCampaignRepository } from '@seneve/campaign-persistence';
import { NodeOpaqueTokenGenerator } from '@seneve/identity-crypto';
import { PrismaIdentityRepository } from '@seneve/identity-persistence';
import {
  PrismaOrganizationRepository,
  PrismaTenantRlsTransactionBoundary,
} from '@seneve/organization-persistence';
import { tenantContextProvider, TenantExecutionContext } from '@seneve/tenant-context';

import { AuthModule } from '../auth/auth.module.js';
import { CandidateController } from './candidate.controller.js';
import { CANDIDATE_APPLICATION_SERVICE } from './candidate.tokens.js';

const CANDIDATE_PRISMA = Symbol('CANDIDATE_PRISMA');

@Module({
  imports: [AuthModule],
  controllers: [CandidateController],
  providers: [
    {
      provide: CANDIDATE_PRISMA,
      useFactory: () => new PrismaClient(),
    },
    {
      provide: TenantExecutionContext,
      useFactory: () => new TenantExecutionContext(tenantContextProvider),
    },
    {
      provide: CANDIDATE_APPLICATION_SERVICE,
      inject: [CANDIDATE_PRISMA, TenantExecutionContext],
      useFactory: (prisma: PrismaClient, executionContext: TenantExecutionContext) => {
        const ids = new NodeOpaqueTokenGenerator();

        return new CandidateApplicationService({
          unitOfWork: new PrismaCandidateRlsUnitOfWork(
            new PrismaTenantRlsTransactionBoundary(prisma, executionContext),
          ),
          candidates: new PrismaCandidateRepository(prisma),
          campaigns: new PrismaCampaignRepository(prisma),
          organizations: new PrismaOrganizationRepository(prisma),
          identities: new PrismaIdentityRepository(prisma),
          permissions: new PermissionEvaluationService(),
          executionContext,
          auditEvents: new CandidateAuditEventRecorder(
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
          maxCandidatesPerCampaign: 500,
        });
      },
    },
  ],
})
export class CandidateModule {}
