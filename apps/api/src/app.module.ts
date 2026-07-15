import { Module } from '@nestjs/common';

import { HealthController } from './health.controller.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { ReadinessService } from './readiness.service.js';

@Module({
  imports: [AuthModule],
  controllers: [HealthController],
  providers: [ReadinessService],
})
export class AppModule {}
