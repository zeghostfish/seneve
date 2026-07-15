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
  | 'candidate:create'
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
  { id: 'campaign:create', description: 'Create future campaigns.', scope: 'organization' },
  { id: 'candidate:create', description: 'Create future candidates.', scope: 'organization' },
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
    'candidate:create',
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
    'candidate:create',
  ],
  EVENT_MANAGER: ['organization:read', 'event:create', 'campaign:create', 'candidate:create'],
  FINANCE_MANAGER: ['organization:read', 'billing:view', 'billing:update'],
  CONTENT_MANAGER: ['organization:read', 'candidate:create'],
  VIEWER: ['organization:read'],
  AUDITOR: ['organization:read', 'membership:read', 'invitation:read', 'billing:view'],
};

export const platformRolePermissions: Readonly<Record<PlatformRole, readonly PermissionId[]>> = {
  PLATFORM_SUPER_ADMINISTRATOR: allPermissions,
};
