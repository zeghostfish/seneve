'use client';

import { useOrganizations } from '../../providers/organization-provider';
import type { FrontendPermissionDecision, SenevePermission } from './permissions';

export function usePermission(permission: SenevePermission): FrontendPermissionDecision {
  const { currentOrganization } = useOrganizations();

  if (permission !== 'organization:create' && !currentOrganization) {
    return {
      allowed: false,
      permission,
      reason: 'no_organization_selected',
    };
  }

  return {
    allowed: true,
    permission,
    reason: 'backend_enforced',
  };
}
