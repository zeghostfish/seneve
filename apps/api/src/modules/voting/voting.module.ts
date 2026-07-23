import { Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { AppendAuditRecordService, VoteAuditEventRecorder } from '@seneve/audit-application';
import { PrismaAuditRepository } from '@seneve/audit-persistence';
import { NodeOpaqueTokenGenerator } from '@seneve/identity-crypto';
import { PrismaIdentityRepository } from '@seneve/identity-persistence';
import { PrismaTenantRlsTransactionBoundary } from '@seneve/organization-persistence';
import { tenantContextProvider, TenantExecutionContext } from '@seneve/tenant-context';
import { VotingApplicationService } from '@seneve/voting-application';
import { PrismaVotingRlsUnitOfWork } from '@seneve/voting-persistence';

import { AuthModule } from '../auth/auth.module.js';
import { VotingController } from './voting.controller.js';
import { VOTING_APPLICATION_SERVICE } from './voting.tokens.js';

const VOTING_PRISMA = Symbol('VOTING_PRISMA');

@Module({
  imports: [AuthModule],
  controllers: [VotingController],
  providers: [
    { provide: VOTING_PRISMA, useFactory: () => new PrismaClient() },
    {
      provide: TenantExecutionContext,
      useFactory: () => new TenantExecutionContext(tenantContextProvider),
    },
    {
      provide: VOTING_APPLICATION_SERVICE,
      inject: [VOTING_PRISMA, TenantExecutionContext],
      useFactory: (prisma: PrismaClient, executionContext: TenantExecutionContext) => {
        const ids = new NodeOpaqueTokenGenerator();
        return new VotingApplicationService({
          unitOfWork: new PrismaVotingRlsUnitOfWork(
            new PrismaTenantRlsTransactionBoundary(prisma, executionContext),
            (tx) =>
              new VoteAuditEventRecorder(
                new AppendAuditRecordService({
                  repository: new PrismaAuditRepository(tx),
                  executionContext,
                  ids,
                  now: () => new Date(),
                }),
              ),
          ),
          identities: new PrismaIdentityRepository(prisma),
          executionContext,
          ids,
          clock: { now: () => new Date() },
        });
      },
    },
  ],
})
export class VotingModule {}
