import { CampaignDomainError } from './domain-error.js';
import {
  type CampaignDomainEvent,
  type CampaignEventMetadata,
  campaignEvent,
  campaignUpdatedPayload,
  lifecyclePayload,
  rulesPayload,
} from './domain-event.js';
import {
  CampaignId,
  CampaignRules,
  type CampaignRulesSnapshot,
  CampaignSchedule,
  type CampaignScheduleSnapshot,
  CampaignSlug,
  type CampaignStatus,
  type CampaignVisibility,
  IdentityRef,
  OrganizationId,
  assertCampaignName,
} from './value-objects.js';

export interface CampaignSnapshot {
  readonly id: string;
  readonly organizationId: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly status: CampaignStatus;
  readonly visibility: CampaignVisibility;
  readonly schedule: CampaignScheduleSnapshot;
  readonly rules: CampaignRulesSnapshot;
  readonly createdBy: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly archivedAt: Date | null;
  readonly cancelledAt: Date | null;
  readonly version: number;
}

export class Campaign {
  private pendingEvents: CampaignDomainEvent[] = [];

  private constructor(private readonly snapshot: CampaignSnapshot) {}

  static create(input: {
    readonly id: CampaignId;
    readonly organizationId: OrganizationId;
    readonly name: string;
    readonly slug: string;
    readonly description?: string | null;
    readonly visibility: CampaignVisibility;
    readonly schedule: CampaignSchedule;
    readonly rules: CampaignRules;
    readonly createdBy: IdentityRef;
    readonly createdAt: Date;
    readonly metadata: CampaignEventMetadata;
  }): Campaign {
    const campaign = new Campaign({
      id: input.id.value,
      organizationId: input.organizationId.value,
      name: assertCampaignName(input.name),
      slug: CampaignSlug.from(input.slug).value,
      description: normalizeDescription(input.description),
      status: 'DRAFT',
      visibility: input.visibility,
      schedule: input.schedule.toSnapshot(),
      rules: input.rules.toSnapshot(),
      createdBy: input.createdBy.value,
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
      archivedAt: null,
      cancelledAt: null,
      version: 1,
    });

    campaign.record('CampaignCreated', input.metadata, {
      name: campaign.snapshot.name,
      slug: campaign.snapshot.slug,
      visibility: campaign.snapshot.visibility,
    });
    return campaign;
  }

  static rehydrate(snapshot: CampaignSnapshot): Campaign {
    return new Campaign({
      ...snapshot,
      schedule: { ...snapshot.schedule },
      rules: {
        ...snapshot.rules,
        results: { ...snapshot.rules.results },
      },
    });
  }

  updateDetails(input: {
    readonly name: string;
    readonly slug: string;
    readonly description?: string | null;
    readonly visibility: CampaignVisibility;
    readonly updatedAt: Date;
    readonly metadata: CampaignEventMetadata;
  }): Campaign {
    this.assertMutable();
    this.assertFoundationalChangesAllowed();

    const next = this.copy({
      name: assertCampaignName(input.name),
      slug: CampaignSlug.from(input.slug).value,
      description: normalizeDescription(input.description),
      visibility: input.visibility,
      updatedAt: input.updatedAt,
      version: this.snapshot.version + 1,
    });
    next.record(
      'CampaignUpdated',
      input.metadata,
      campaignUpdatedPayload({
        name: next.snapshot.name,
        slug: next.snapshot.slug,
        visibility: next.snapshot.visibility,
      }),
    );
    return next;
  }

  updateRules(input: {
    readonly rules: CampaignRules;
    readonly updatedAt: Date;
    readonly metadata: CampaignEventMetadata;
  }): Campaign {
    this.assertMutable();
    this.assertFoundationalChangesAllowed();

    const next = this.copy({
      rules: input.rules.toSnapshot(),
      updatedAt: input.updatedAt,
      version: this.snapshot.version + 1,
    });
    next.record('CampaignRulesUpdated', input.metadata, rulesPayload(next.snapshot.rules));
    return next;
  }

  schedule(input: {
    readonly schedule: CampaignSchedule;
    readonly metadata: CampaignEventMetadata;
    readonly updatedAt: Date;
  }): Campaign {
    this.assertTransition('SCHEDULED');
    const next = this.copy({
      schedule: input.schedule.toSnapshot(),
      status: 'SCHEDULED',
      updatedAt: input.updatedAt,
      version: this.snapshot.version + 1,
    });
    next.record('CampaignScheduled', input.metadata, lifecyclePayload('SCHEDULED'));
    return next;
  }

  activate(input: {
    readonly metadata: CampaignEventMetadata;
    readonly updatedAt: Date;
  }): Campaign {
    return this.transition('ACTIVE', 'CampaignActivated', input.updatedAt, input.metadata);
  }

  pause(input: { readonly metadata: CampaignEventMetadata; readonly updatedAt: Date }): Campaign {
    return this.transition('PAUSED', 'CampaignPaused', input.updatedAt, input.metadata);
  }

  complete(input: {
    readonly metadata: CampaignEventMetadata;
    readonly updatedAt: Date;
  }): Campaign {
    return this.transition('COMPLETED', 'CampaignCompleted', input.updatedAt, input.metadata);
  }

  cancel(input: { readonly metadata: CampaignEventMetadata; readonly updatedAt: Date }): Campaign {
    const next = this.transition('CANCELLED', 'CampaignCancelled', input.updatedAt, input.metadata);
    return next.copy({ cancelledAt: input.updatedAt });
  }

  archive(input: { readonly metadata: CampaignEventMetadata; readonly updatedAt: Date }): Campaign {
    const next = this.transition('ARCHIVED', 'CampaignArchived', input.updatedAt, input.metadata);
    return next.copy({ archivedAt: input.updatedAt });
  }

  toSnapshot(): CampaignSnapshot {
    return {
      ...this.snapshot,
      schedule: { ...this.snapshot.schedule },
      rules: {
        ...this.snapshot.rules,
        results: { ...this.snapshot.rules.results },
      },
    };
  }

  pullDomainEvents(): readonly CampaignDomainEvent[] {
    const events = this.pendingEvents;
    this.pendingEvents = [];
    return events;
  }

  private transition(
    target: CampaignStatus,
    eventName: CampaignDomainEvent['name'],
    updatedAt: Date,
    metadata: CampaignEventMetadata,
  ): Campaign {
    this.assertTransition(target);
    const next = this.copy({
      status: target,
      updatedAt,
      version: this.snapshot.version + 1,
    });
    next.record(eventName, metadata, lifecyclePayload(target));
    return next;
  }

  private assertTransition(target: CampaignStatus): void {
    if (!allowedTransitions[this.snapshot.status].includes(target)) {
      throw new CampaignDomainError(
        'CAMPAIGN_INVALID_STATUS_TRANSITION',
        `Campaign cannot transition from ${this.snapshot.status} to ${target}.`,
      );
    }
  }

  private assertMutable(): void {
    if (this.snapshot.status === 'ARCHIVED') {
      throw new CampaignDomainError('CAMPAIGN_IMMUTABLE', 'Archived campaigns are immutable.');
    }
  }

  private assertFoundationalChangesAllowed(): void {
    if (['ACTIVE', 'COMPLETED', 'CANCELLED', 'ARCHIVED'].includes(this.snapshot.status)) {
      throw new CampaignDomainError(
        'CAMPAIGN_RULE_CHANGE_NOT_ALLOWED',
        'Foundational campaign configuration cannot change in this state.',
      );
    }
  }

  private copy(patch: Partial<CampaignSnapshot>): Campaign {
    const next = Campaign.rehydrate({
      ...this.snapshot,
      ...patch,
    });
    next.pendingEvents = [...this.pendingEvents];
    return next;
  }

  private record(
    name: CampaignDomainEvent['name'],
    metadata: CampaignEventMetadata,
    payload: Record<string, unknown>,
  ): void {
    this.pendingEvents.push(
      campaignEvent({
        name,
        campaignId: this.snapshot.id,
        organizationId: this.snapshot.organizationId,
        metadata,
        payload,
      }),
    );
  }
}

const allowedTransitions: Readonly<Record<CampaignStatus, readonly CampaignStatus[]>> = {
  DRAFT: ['SCHEDULED', 'CANCELLED'],
  SCHEDULED: ['DRAFT', 'ACTIVE', 'CANCELLED'],
  ACTIVE: ['PAUSED', 'COMPLETED', 'CANCELLED'],
  PAUSED: ['ACTIVE', 'COMPLETED', 'CANCELLED'],
  COMPLETED: ['ARCHIVED'],
  CANCELLED: ['ARCHIVED'],
  ARCHIVED: [],
};

function normalizeDescription(value?: string | null): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}
