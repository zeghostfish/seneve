import {
  anonymousTenantContext,
  organizationTenantContext,
  platformAdminTenantContext,
} from '@seneve/tenant-context';
import { describe, expect, it } from 'vitest';

import { allPermissions, type PermissionId } from './permission-catalogue.js';
import {
  type AuthorizationMembership,
  type PermissionEvaluationInput,
  PermissionEvaluationService,
} from './permission-evaluation-service.js';

const service = new PermissionEvaluationService();

const actor = {
  identityId: 'identity-owner',
  identityStatus: 'ACTIVE' as const,
  emailVerified: true,
};
const organization = { id: 'organization-1', status: 'ACTIVE' as const };
const ownerMembershipId = 'membership-owner';
const ownerMembership: AuthorizationMembership = {
  organizationId: organization.id,
  identityId: actor.identityId,
  role: 'OWNER' as const,
  status: 'ACTIVE' as const,
};
const adminMembership: AuthorizationMembership = {
  ...ownerMembership,
  role: 'ADMINISTRATOR' as const,
};
const viewerMembership: AuthorizationMembership = {
  ...ownerMembership,
  role: 'VIEWER' as const,
};
const financeMembership: AuthorizationMembership = {
  ...ownerMembership,
  role: 'FINANCE_MANAGER' as const,
};

describe('PermissionEvaluationService', () => {
  it.each(allPermissions)(
    'allows and denies %s through explicit catalogue and policies',
    (permission) => {
      const allowedDecision = service.evaluate(allowedInput(permission));
      const deniedDecision = service.evaluate(deniedInput(permission));

      expect(allowedDecision).toMatchObject({
        allowed: true,
        reasonCode: 'ALLOWED',
        permission,
      });
      expect(allowedDecision.evaluatedConditions.length).toBeGreaterThan(0);
      expect(deniedDecision).toMatchObject({
        allowed: false,
        permission,
      });
      expect(deniedDecision.reasonCode).not.toBe('ALLOWED');
    },
  );

  it('returns structured denial for cross-tenant operations', () => {
    const decision = service.evaluate({
      ...allowedInput('invitation:create'),
      tenant: organizationContext('organization-2'),
    });

    expect(decision).toMatchObject({
      allowed: false,
      reasonCode: 'CROSS_TENANT_DENIED',
      policy: 'tenant.scope',
    });
    expect(decision.evaluatedConditions).toContainEqual(
      expect.objectContaining({
        condition: 'IsSameTenant',
        passed: false,
      }),
    );
  });

  it('denies organization-scoped permissions when tenant context is missing', () => {
    const decision = service.evaluate({
      ...allowedInput('membership:create'),
      tenant: anonymousContext('correlation-missing-tenant'),
    });

    expect(decision).toMatchObject({
      allowed: false,
      reasonCode: 'TENANT_REQUIRED',
    });
  });

  it('denies suspended and archived organization operations through policy conditions', () => {
    expect(
      service.evaluate({
        ...allowedInput('invitation:create'),
        organization: { id: organization.id, status: 'SUSPENDED' },
      }),
    ).toMatchObject({
      allowed: false,
      reasonCode: 'ORGANIZATION_INACTIVE',
    });

    expect(
      service.evaluate({
        ...allowedInput('organization:read'),
        organization: { id: organization.id, status: 'ARCHIVED' },
      }),
    ).toMatchObject({
      allowed: false,
      reasonCode: 'ORGANIZATION_INACTIVE',
    });
  });

  it('applies explicit deny before role permission for last-owner operations', () => {
    const decision = service.evaluate({
      ...allowedInput('membership:remove'),
      resource: {
        organizationId: organization.id,
        targetMembership: ownerMembership,
        isLastOwnerTarget: true,
      },
    });

    expect(decision).toMatchObject({
      allowed: false,
      reasonCode: 'EXPLICIT_DENY',
      policy: 'explicit.deny.precedence',
    });
  });

  it('requires ownership for ownership transfer', () => {
    const decision = service.evaluate({
      ...allowedInput('ownership:transfer'),
      membership: adminMembership,
    });

    expect(decision).toMatchObject({
      allowed: false,
      reasonCode: 'PERMISSION_DENIED',
    });
  });

  it('supports self-service membership reads without broad membership-read permission', () => {
    const decision = service.evaluate({
      actor,
      tenant: organizationContext(organization.id),
      permission: 'membership:read',
      organization,
      membership: viewerMembership,
      resource: {
        organizationId: organization.id,
        targetIdentityId: actor.identityId,
      },
    });

    expect(decision).toMatchObject({
      allowed: true,
      reasonCode: 'ALLOWED',
    });
    expect(decision.evaluatedConditions).toContainEqual(
      expect.objectContaining({
        condition: 'IsSelfOperation',
        passed: true,
      }),
    );
  });

  it('allows platform administrators through an exceptional structured override', () => {
    const decision = service.evaluate({
      actor: {
        identityId: 'platform-admin',
        platformRoles: ['PLATFORM_SUPER_ADMINISTRATOR'],
      },
      tenant: platformContext(organization.id),
      permission: 'organization:suspend',
      organization,
    });

    expect(decision).toMatchObject({
      allowed: true,
      policy: 'platform.administrator.override',
      role: 'PLATFORM_SUPER_ADMINISTRATOR',
    });
  });
});

function allowedInput(permission: PermissionId): PermissionEvaluationInput {
  if (permission === 'organization:create') {
    return {
      actor,
      tenant: anonymousContext('correlation-organization-create'),
      permission,
    };
  }

  if (permission === 'system:admin' || permission === 'organization:suspend') {
    return {
      actor: {
        identityId: 'platform-admin',
        platformRoles: ['PLATFORM_SUPER_ADMINISTRATOR'],
      },
      tenant:
        permission === 'system:admin'
          ? platformAdminTenantContext({
              identityId: 'platform-admin',
              correlationId: 'correlation-system-admin',
              executionSource: 'INTERNAL_WORKFLOW',
            })
          : platformContext(organization.id),
      permission,
      organization: permission === 'system:admin' ? null : organization,
    };
  }

  if (permission === 'organization:archive') {
    return {
      actor,
      tenant: organizationContext(organization.id),
      permission,
      organization: { id: organization.id, status: 'CLOSED' },
      membership: ownerMembership,
    };
  }

  if (permission === 'ownership:transfer') {
    return {
      actor,
      tenant: organizationContext(organization.id),
      permission,
      organization,
      membership: ownerMembership,
      resource: {
        organizationId: organization.id,
        targetMembership: {
          organizationId: organization.id,
          identityId: 'identity-target',
          role: 'ADMINISTRATOR',
          status: 'ACTIVE',
        },
      },
    };
  }

  if (permission === 'invitation:revoke') {
    return organizationInput(permission, adminMembership, {
      organizationId: organization.id,
      invitationStatus: 'PENDING',
    });
  }

  if (permission.startsWith('billing:')) {
    return organizationInput(permission, financeMembership);
  }

  return organizationInput(permission, ownerMembership);
}

function deniedInput(permission: PermissionId): PermissionEvaluationInput {
  if (permission === 'organization:create') {
    return {
      actor: {
        identityId: actor.identityId,
        identityStatus: 'PENDING_EMAIL_VERIFICATION',
        emailVerified: false,
      },
      tenant: anonymousContext('correlation-denied-create'),
      permission,
    };
  }

  if (permission === 'system:admin') {
    return {
      actor,
      tenant: anonymousContext('correlation-denied-system'),
      permission,
    };
  }

  if (permission === 'organization:suspend') {
    return {
      actor,
      tenant: organizationContext(organization.id),
      permission,
      organization,
      membership: ownerMembership,
    };
  }

  return {
    ...allowedInput(permission),
    membership: {
      ...viewerMembership,
      status: 'SUSPENDED',
    },
  };
}

function organizationInput(
  permission: PermissionId,
  membership = ownerMembership,
  resource: PermissionEvaluationInput['resource'] = { organizationId: organization.id },
): PermissionEvaluationInput {
  return {
    actor,
    tenant: organizationContext(organization.id),
    permission,
    organization,
    membership,
    resource,
  };
}

function anonymousContext(correlationId: string) {
  return anonymousTenantContext({
    correlationId,
    executionSource: 'INTERNAL_WORKFLOW',
  });
}

function organizationContext(tenantId: string) {
  return organizationTenantContext({
    tenantId,
    identityId: actor.identityId,
    membershipId: ownerMembershipId,
    role: 'OWNER',
    correlationId: `correlation-${tenantId}`,
    executionSource: 'INTERNAL_WORKFLOW',
  });
}

function platformContext(tenantId: string) {
  return organizationTenantContext({
    tenantId,
    identityId: 'platform-admin',
    membershipId: 'platform-context-membership',
    role: 'OWNER',
    correlationId: `correlation-platform-${tenantId}`,
    executionSource: 'INTERNAL_WORKFLOW',
  });
}
