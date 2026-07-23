import { Module } from '@nestjs/common';

import { HealthController } from './health.controller.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { CampaignModule } from './modules/campaigns/campaign.module.js';
import { CandidateModule } from './modules/candidates/candidate.module.js';
import { OrganizationModule } from './modules/organizations/organization.module.js';
import { VotingModule } from './modules/voting/voting.module.js';
import { ReadinessService } from './readiness.service.js';

@Module({
  imports: [AuthModule, OrganizationModule, CampaignModule, CandidateModule, VotingModule],
  controllers: [HealthController],
  providers: [ReadinessService],
})
export class AppModule {}
