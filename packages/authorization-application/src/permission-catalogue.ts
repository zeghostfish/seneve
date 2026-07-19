export type PlatformRole = 'PLATFORM_SUPER_ADMINISTRATOR';

export type OrganizationRole =
  | 'OWNER'
  | 'ADMINISTRATOR'
  | 'EVENT_MANAGER'
  | 'FINANCE_MANAGER'
  | 'CONTENT_MANAGER'
  | 'VIEWER'
  | 'AUDITOR';

export type PermissionId =
  | 'organization:create'
  | 'organization:read'
  | 'organization:update'
  | 'organization:suspend'
  | 'organization:close'
  | 'organization:archive'
  | 'membership:read'
  | 'membership:create'
  | 'membership:update'
  | 'membership:suspend'
  | 'membership:remove'
  | 'invitation:read'
  | 'invitation:create'
  | 'invitation:revoke'
  | 'ownership:transfer'
  | 'event:create'
  | 'campaign:create'
  | 'campaign:read'
  | 'campaign:update'
  | 'campaign:schedule'
  | 'campaign:activate'
  | 'campaign:pause'
  | 'campaign:complete'
  | 'campaign:cancel'
  | 'campaign:archive'
  | 'campaign:manage-rules'
  | 'candidate:create'
  | 'candidate:read'
  | 'candidate:update'
  | 'candidate:manage-status'
  | 'candidate:reorder'
  | 'candidate:withdraw'
  | 'candidate:disqualify'
  | 'candidate:archive'
  | 'billing:view'
  | 'billing:update'
  | 'system:admin';

export interface PermissionDefinition {
  readonly id: PermissionId;
  readonly description: string;
  readonly scope: 'global' | 'organization';
}

export const permissionCatalogue: readonly PermissionDefinition[] = [
  { id: 'organization:create', description: 'Create an organization.', scope: 'global' },
  { id: 'organization:read', description: 'Read organization details.', scope: 'organization' },
  {
    id: 'organization:update',
    description: 'Update organization profile and settings.',
    scope: 'organization',
  },
  { id: 'organization:suspend', description: 'Suspend an organization.', scope: 'organization' },
  { id: 'organization:close', description: 'Close an organization.', scope: 'organization' },
  { id: 'organization:archive', description: 'Archive an organization.', scope: 'organization' },
  { id: 'membership:read', description: 'Read organization memberships.', scope: 'organization' },
  {
    id: 'membership:create',
    description: 'Create organization memberships.',
    scope: 'organization',
  },
  {
    id: 'membership:update',
    description: 'Update organization membership roles.',
    scope: 'organization',
  },
  {
    id: 'membership:suspend',
    description: 'Suspend organization memberships.',
    scope: 'organization',
  },
  {
    id: 'membership:remove',
    description: 'Remove organization memberships.',
    scope: 'organization',
  },
  { id: 'invitation:read', description: 'Read organization invitations.', scope: 'organization' },
  {
    id: 'invitation:create',
    description: 'Create organization invitations.',
    scope: 'organization',
  },
  {
    id: 'invitation:revoke',
    description: 'Revoke organization invitations.',
    scope: 'organization',
  },
  {
    id: 'ownership:transfer',
    description: 'Transfer organization ownership.',
    scope: 'organization',
  },
  { id: 'event:create', description: 'Create future events.', scope: 'organization' },
  { id: 'campaign:create', description: 'Create campaigns.', scope: 'organization' },
  { id: 'campaign:read', description: 'Read campaigns.', scope: 'organization' },
  { id: 'campaign:update', description: 'Update campaign details.', scope: 'organization' },
  { id: 'campaign:schedule', description: 'Schedule campaigns.', scope: 'organization' },
  { id: 'campaign:activate', description: 'Activate campaigns.', scope: 'organization' },
  { id: 'campaign:pause', description: 'Pause campaigns.', scope: 'organization' },
  { id: 'campaign:complete', description: 'Complete campaigns.', scope: 'organization' },
  { id: 'campaign:cancel', description: 'Cancel campaigns.', scope: 'organization' },
  { id: 'campaign:archive', description: 'Archive campaigns.', scope: 'organization' },
  {
    id: 'campaign:manage-rules',
    description: 'Manage campaign voting and result-visibility rules.',
    scope: 'organization',
  },
  { id: 'candidate:create', description: 'Create campaign candidates.', scope: 'organization' },
  { id: 'candidate:read', description: 'Read campaign candidates.', scope: 'organization' },
  {
    id: 'candidate:update',
    description: 'Update candidate presentation data.',
    scope: 'organization',
  },
  {
    id: 'candidate:manage-status',
    description: 'Manage candidate eligibility and suspension.',
    scope: 'organization',
  },
  { id: 'candidate:reorder', description: 'Reorder campaign candidates.', scope: 'organization' },
  { id: 'candidate:withdraw', description: 'Withdraw campaign candidates.', scope: 'organization' },
  {
    id: 'candidate:disqualify',
    description: 'Disqualify campaign candidates.',
    scope: 'organization',
  },
  { id: 'candidate:archive', description: 'Archive campaign candidates.', scope: 'organization' },
  { id: 'billing:view', description: 'View billing information.', scope: 'organization' },
  { id: 'billing:update', description: 'Update billing information.', scope: 'organization' },
  {
    id: 'system:admin',
    description: 'Perform privileged platform administration.',
    scope: 'global',
  },
];

export const allPermissions = permissionCatalogue.map((permission) => permission.id);

export const organizationRolePermissions: Readonly<
  Record<OrganizationRole, readonly PermissionId[]>
> = {
  OWNER: [
    'organization:read',
    'organization:update',
    'organization:close',
    'organization:archive',
    'membership:read',
    'membership:create',
    'membership:update',
    'membership:suspend',
    'membership:remove',
    'invitation:read',
    'invitation:create',
    'invitation:revoke',
    'ownership:transfer',
    'event:create',
    'campaign:create',
    'campaign:read',
    'campaign:update',
    'campaign:schedule',
    'campaign:activate',
    'campaign:pause',
    'campaign:complete',
    'campaign:cancel',
    'campaign:archive',
    'campaign:manage-rules',
    'candidate:create',
    'candidate:read',
    'candidate:update',
    'candidate:manage-status',
    'candidate:reorder',
    'candidate:withdraw',
    'candidate:disqualify',
    'candidate:archive',
    'billing:view',
    'billing:update',
  ],
  ADMINISTRATOR: [
    'organization:read',
    'organization:update',
    'membership:read',
    'membership:create',
    'membership:update',
    'membership:suspend',
    'membership:remove',
    'invitation:read',
    'invitation:create',
    'invitation:revoke',
    'event:create',
    'campaign:create',
    'campaign:read',
    'campaign:update',
    'campaign:schedule',
    'campaign:activate',
    'campaign:pause',
    'campaign:complete',
    'campaign:cancel',
    'campaign:archive',
    'campaign:manage-rules',
    'candidate:create',
    'candidate:read',
    'candidate:update',
    'candidate:manage-status',
    'candidate:reorder',
    'candidate:withdraw',
    'candidate:disqualify',
    'candidate:archive',
  ],
  EVENT_MANAGER: [
    'organization:read',
    'event:create',
    'campaign:create',
    'campaign:read',
    'campaign:update',
    'campaign:schedule',
    'campaign:activate',
    'campaign:pause',
    'campaign:complete',
    'campaign:cancel',
    'campaign:archive',
    'campaign:manage-rules',
    'candidate:create',
    'candidate:read',
    'candidate:update',
    'candidate:manage-status',
    'candidate:reorder',
    'candidate:withdraw',
    'candidate:disqualify',
    'candidate:archive',
  ],
  FINANCE_MANAGER: ['organization:read', 'billing:view', 'billing:update'],
  CONTENT_MANAGER: [
    'organization:read',
    'campaign:read',
    'campaign:update',
    'candidate:create',
    'candidate:read',
    'candidate:update',
    'candidate:reorder',
  ],
  VIEWER: ['organization:read', 'campaign:read', 'candidate:read'],
  AUDITOR: [
    'organization:read',
    'membership:read',
    'invitation:read',
    'campaign:read',
    'candidate:read',
    'billing:view',
  ],
};

export const platformRolePermissions: Readonly<Record<PlatformRole, readonly PermissionId[]>> = {
  PLATFORM_SUPER_ADMINISTRATOR: allPermissions,
};
