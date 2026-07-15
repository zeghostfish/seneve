import type { Prisma, PrismaClient } from '@prisma/client';
import type { SecurityEventInput, SecurityEventRecorder } from '@seneve/identity-application';

export class PrismaSecurityEventRecorder implements SecurityEventRecorder {
  constructor(private readonly prisma: PrismaClient) {}

  async record(input: SecurityEventInput): Promise<void> {
    if (!input.identityId) {
      return;
    }

    await this.prisma.identitySecurityEvent.create({
      data: {
        identityId: input.identityId,
        eventType: input.eventType,
        occurredAt: input.occurredAt,
        correlationId: input.correlationId,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonObject,
      },
    });
  }
}
