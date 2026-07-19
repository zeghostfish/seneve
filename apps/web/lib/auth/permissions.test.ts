import { describe, expect, it } from 'vitest';

import type { SenevePermission } from './permissions';

const organizationPermissions: readonly SenevePermission[] = [
  'organization:create',
  'organization:read',
  'organization:update',
  'membership:read',
  'membership:update',
  'membership:suspend',
  'membership:remove',
  'invitation:create',
  'invitation:read',
  'invitation:revoke',
  'ownership:transfer',
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
];

describe('frontend permission catalogue', () => {
  it('contains only immutable backend permission identifiers', () => {
    expect(organizationPermissions).toContain('membership:update');
    expect(organizationPermissions).toContain('ownership:transfer');
    expect(organizationPermissions).toContain('campaign:create');
    expect(organizationPermissions).toContain('candidate:reorder');
    expect(organizationPermissions).not.toContain('OWNER' as SenevePermission);
  });
});
