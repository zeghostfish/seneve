import type { Prisma, PrismaClient } from '@prisma/client';
import {
  calculateAuditRecordHash,
  type AuditQuery,
  type AuditRepository,
  type PreparedAuditRecordAppend,
} from '@seneve/audit-application';
import type { AuditRecord, AuditStreamType } from '@seneve/domain-audit';

type PrismaExecutor = PrismaClient | Prisma.TransactionClient;
type AuditRecordRow = Prisma.AuditRecordGetPayload<Record<string, never>>;

export class PrismaAuditRepository implements AuditRepository {
  constructor(private readonly prisma: PrismaExecutor) {}

  async append(input: PreparedAuditRecordAppend): Promise<AuditRecord> {
    return inTransaction(this.prisma, async (tx) => {
      await lockAuditStream(tx, input.streamType, input.streamId);
      const previous = await latestInStream(tx, input.streamType, input.streamId);
      const sequenceNumber = (previous?.sequenceNumber ?? 0) + 1;
      const previousRecordHash = previous?.recordHash ?? null;
      const recordHash = calculateAuditRecordHash({
        canonicalPayload: input.canonicalPayload,
        previousRecordHash,
      });

      const created = await tx.auditRecord.create({
        data: {
          id: input.draft.id,
          tenantId: input.draft.tenantId,
          streamType: input.streamType,
          streamId: input.streamId,
          sequenceNumber,
          eventName: input.draft.eventName,
          eventVersion: input.draft.eventVersion,
          occurredAt: input.draft.occurredAt,
          actorType: input.draft.actor.actorType,
          actorIdentityId: input.draft.actor.actorIdentityId,
          actorMembershipId: input.draft.actor.actorMembershipId,
          executionMode: input.draft.executionMode,
          executionSource: input.draft.executionSource,
          resourceType: input.draft.resource.resourceType,
          resourceId: input.draft.resource.resourceId,
          action: input.draft.action,
          outcome: input.draft.outcome,
          reasonCode: input.draft.reasonCode,
          correlationId: input.draft.correlation.correlationId,
          requestId: input.draft.correlation.requestId,
          jobId: input.draft.correlation.jobId,
          privileged: input.draft.privileged,
          privilegedReason: input.draft.privilegedReason,
          retentionCategory: input.draft.retentionCategory,
          metadataJson: input.draft.metadata as Prisma.InputJsonObject,
          previousRecordHash,
          recordHash,
        },
      });

      return toAuditRecord(created);
    });
  }

  async findLatestInStream(input: {
    readonly streamType: AuditStreamType;
    readonly streamId: string;
  }): Promise<AuditRecord | null> {
    const latest = await latestInStream(this.prisma, input.streamType, input.streamId);

    return latest ? toAuditRecord(latest) : null;
  }

  async findByQuery(query: AuditQuery): Promise<readonly AuditRecord[]> {
    const rows = await this.prisma.auditRecord.findMany({
      where: {
        tenantId: query.tenantId === undefined ? undefined : query.tenantId,
        eventName: query.eventName,
        actorIdentityId: query.actorIdentityId,
        resourceType: query.resourceType,
        resourceId: query.resourceId,
        outcome: query.outcome,
        correlationId: query.correlationId,
        privileged: query.privileged,
        occurredAt: {
          gte: query.occurredFrom,
          lte: query.occurredTo,
        },
        sequenceNumber: query.cursorSequenceNumber
          ? {
              lt: query.cursorSequenceNumber,
            }
          : undefined,
      },
      orderBy: [
        {
          occurredAt: 'desc',
        },
        {
          sequenceNumber: 'desc',
        },
      ],
      take: Math.min(query.limit, 100),
    });

    return rows.map(toAuditRecord);
  }
}

async function latestInStream(
  prisma: PrismaExecutor,
  streamType: AuditStreamType,
  streamId: string,
): Promise<AuditRecordRow | null> {
  return prisma.auditRecord.findFirst({
    where: {
      streamType,
      streamId,
    },
    orderBy: {
      sequenceNumber: 'desc',
    },
  });
}

async function lockAuditStream(
  tx: Prisma.TransactionClient,
  streamType: AuditStreamType,
  streamId: string,
): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${streamType}:${streamId}`}))`;
}

function toAuditRecord(row: AuditRecordRow): AuditRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    streamType: row.streamType as AuditRecord['streamType'],
    streamId: row.streamId,
    sequenceNumber: row.sequenceNumber,
    eventName: row.eventName as AuditRecord['eventName'],
    eventVersion: row.eventVersion as 1,
    occurredAt: row.occurredAt,
    actor: {
      actorType: row.actorType as AuditRecord['actor']['actorType'],
      actorIdentityId: row.actorIdentityId,
      actorMembershipId: row.actorMembershipId,
    },
    executionMode: row.executionMode,
    executionSource: row.executionSource,
    resource: {
      resourceType: row.resourceType,
      resourceId: row.resourceId,
    },
    action: row.action,
    outcome: row.outcome as AuditRecord['outcome'],
    reasonCode: row.reasonCode,
    correlation: {
      correlationId: row.correlationId,
      requestId: row.requestId,
      jobId: row.jobId,
    },
    privileged: row.privileged,
    privilegedReason: row.privilegedReason,
    retentionCategory: row.retentionCategory as AuditRecord['retentionCategory'],
    metadata: row.metadataJson as Record<string, unknown>,
    previousRecordHash: row.previousRecordHash,
    recordHash: row.recordHash,
    createdAt: row.createdAt,
  };
}

async function inTransaction<T>(
  prisma: PrismaExecutor,
  work: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  if ('$transaction' in prisma) {
    return prisma.$transaction((tx) => work(tx));
  }

  return work(prisma);
}
