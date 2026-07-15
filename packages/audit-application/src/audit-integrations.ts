import type { OrganizationDomainEvent } from '@seneve/domain-organization';
import type { SecurityEventInput, SecurityEventRecorder } from '@seneve/identity-application';

import type { AuditAppendResult } from './audit-contracts.js';
import { AppendAuditRecordService } from './audit-service.js';
import {
  mapIdentitySecurityEventToAudit,
  mapOrganizationDomainEventToAudit,
} from './event-mappers.js';

export class AuditingSecurityEventRecorder implements SecurityEventRecorder {
  constructor(
    private readonly delegate: SecurityEventRecorder,
    private readonly audit: AppendAuditRecordService,
    private readonly options: {
      readonly mandatoryAuditEvents: readonly SecurityEventInput['eventType'][];
    },
  ) {}

  async record(input: SecurityEventInput): Promise<void> {
    await this.delegate.record(input);

    try {
      await this.audit.append(mapIdentitySecurityEventToAudit(input));
    } catch (error) {
      if (this.options.mandatoryAuditEvents.includes(input.eventType)) {
        throw error;
      }
    }
  }
}

export class OrganizationAuditEventRecorder {
  constructor(private readonly audit: AppendAuditRecordService) {}

  async record(event: OrganizationDomainEvent): Promise<AuditAppendResult> {
    return this.audit.append(mapOrganizationDomainEventToAudit(event));
  }
}
