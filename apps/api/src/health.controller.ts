import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { HealthResponse } from '@seneve/shared';

import { ReadinessService } from './readiness.service.js';

@ApiTags('foundation')
@Controller()
export class HealthController {
  constructor(private readonly readinessService: ReadinessService) {}

  @Get('health')
  @ApiOkResponse({ description: 'API liveness status.' })
  health(): HealthResponse {
    return {
      status: 'ok',
      service: 'seneve-api',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  @ApiOkResponse({ description: 'API readiness status.' })
  async ready(): Promise<HealthResponse> {
    const ready = await this.readinessService.check();

    return {
      status: ready ? 'ok' : 'degraded',
      service: 'seneve-api',
      timestamp: new Date().toISOString(),
    };
  }
}
