import { Module } from '@nestjs/common';

import { HealthController } from './health.controller.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { OrganizationModule } from './modules/organizations/organization.module.js';
import { ReadinessService } from './readiness.service.js';

@Module({
  imports: [AuthModule, OrganizationModule],
  controllers: [HealthController],
  providers: [ReadinessService],
})
export class AppModule {}
