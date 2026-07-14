import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

import { HealthController } from './health.controller.js';
import { ReadinessService } from './readiness.service.js';

describe('HealthController', () => {
  it('returns liveness status', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: ReadinessService,
          useValue: { check: async () => true },
        },
      ],
    }).compile();

    const controller = moduleRef.get(HealthController);

    expect(controller.health().status).toBe('ok');
  });
});
