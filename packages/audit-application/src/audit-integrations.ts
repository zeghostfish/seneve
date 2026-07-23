import type { OrganizationDomainEvent } from '@seneve/domain-organization';
import type { CampaignDomainEvent } from '@seneve/domain-campaign';
import type { CandidateDomainEvent } from '@seneve/domain-candidate';
import type { VoteAttemptDomainEvent } from '@seneve/domain-voting';
import type { SecurityEventInput, SecurityEventRecorder } from '@seneve/identity-application';

import type { AuditAppendResult } from './audit-contracts.js';
import { AppendAuditRecordService } from './audit-service.js';
import {
  mapIdentitySecurityEventToAudit,
  mapCampaignDomainEventToAudit,
  mapCandidateDomainEventToAudit,
  mapOrganizationDomainEventToAudit,
  mapVoteDomainEventToAudit,
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

export class CampaignAuditEventRecorder {
  constructor(private readonly audit: AppendAuditRecordService) {}

  async record(event: CampaignDomainEvent): Promise<AuditAppendResult> {
    return this.audit.append(mapCampaignDomainEventToAudit(event));
  }
}

export class CandidateAuditEventRecorder {
  constructor(private readonly audit: AppendAuditRecordService) {}

  async record(event: CandidateDomainEvent): Promise<AuditAppendResult> {
    return this.audit.append(mapCandidateDomainEventToAudit(event));
  }
}

export class VoteAuditEventRecorder {
  constructor(private readonly audit: AppendAuditRecordService) {}

  async record(event: VoteAttemptDomainEvent): Promise<AuditAppendResult> {
    return this.audit.append(mapVoteDomainEventToAudit(event));
  }
}
