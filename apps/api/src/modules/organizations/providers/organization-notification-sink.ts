import type { InvitationDeliveryCommand } from '@seneve/organization-application';

export interface OrganizationNotificationSink {
  invitationRequested(command: InvitationDeliveryCommand): Promise<void>;
}

export class NoopOrganizationNotificationSink implements OrganizationNotificationSink {
  async invitationRequested(): Promise<void> {
    return undefined;
  }
}
