import type { TenantContext } from '@seneve/tenant-context';

import {
  type OrganizationRole,
  type PermissionId,
  type PlatformRole,
  organizationRolePermissions,
  permissionCatalogue,
  platformRolePermissions,
} from './permission-catalogue.js';

export type AuthorizationOrganizationStatus =
  'DRAFT' | 'ACTIVE' | 'SUSPENDED' | 'CLOSED' | 'ARCHIVED';
export type AuthorizationMembershipStatus = 'ACTIVE' | 'SUSPENDED' | 'REMOVED';
export type AuthorizationInvitationStatus = 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';

export type AuthorizationDecisionReason =
  | 'ALLOWED'
  | 'PERMISSION_DENIED'
  | 'POLICY_VIOLATION'
  | 'ROLE_NOT_ASSIGNED'
  | 'TENANT_REQUIRED'
  | 'INVALID_MEMBERSHIP'
  | 'ORGANIZATION_INACTIVE'
  | 'OWNERSHIP_REQUIRED'
  | 'EXPLICIT_DENY'
  | 'CROSS_TENANT_DENIED';

export type AuthorizationConditionName =
  | 'PermissionExists'
  | 'IsActorActive'
  | 'IsActorEmailVerified'
  | 'TenantRequired'
  | 'IsSameTenant'
  | 'IsPlatformAdministrator'
  | 'HasAssignedRole'
  | 'RoleGrantsPermission'
  | 'IsMembershipActive'
  | 'IsOrganizationActive'
  | 'IsOrganizationReadable'
  | 'IsOrganizationMutable'
  | 'IsOrganizationArchivable'
  | 'IsOrganizationOwner'
  | 'IsSelfOperation'
  | 'IsInvitationPending'
  | 'ExplicitDenyAbsent';

export interface AuthorizationActor {
  readonly identityId: string;
  readonly identityStatus?: 'ACTIVE' | 'SUSPENDED' | 'CLOSED' | 'PENDING_EMAIL_VERIFICATION';
  readonly emailVerified?: boolean;
  readonly platformRoles?: readonly PlatformRole[];
}

export interface AuthorizationMembership {
  readonly organizationId: string;
  readonly identityId: string;
  readonly role: OrganizationRole;
  readonly status: AuthorizationMembershipStatus;
}

export interface AuthorizationOrganization {
  readonly id: string;
  readonly status: AuthorizationOrganizationStatus;
}

export interface AuthorizationResource {
  readonly organizationId?: string | null;
  readonly targetIdentityId?: string | null;
  readonly targetMembership?: AuthorizationMembership | null;
  readonly invitationStatus?: AuthorizationInvitationStatus | null;
  readonly isLastOwnerTarget?: boolean;
}

export interface PermissionEvaluationInput {
  readonly actor: AuthorizationActor;
  readonly tenant: TenantContext;
  readonly permission: PermissionId;
  readonly organization?: AuthorizationOrganization | null;
  readonly membership?: AuthorizationMembership | null;
  readonly resource?: AuthorizationResource | null;
}

export interface EvaluatedCondition {
  readonly condition: AuthorizationConditionName;
  readonly passed: boolean;
  readonly reasonCode?: AuthorizationDecisionReason;
}

export interface AuthorizationDecision {
  readonly allowed: boolean;
  readonly reasonCode: AuthorizationDecisionReason;
  readonly permission: PermissionId;
  readonly policy: string;
  readonly evaluatedConditions: readonly EvaluatedCondition[];
  readonly role?: OrganizationRole | PlatformRole;
}

type PolicyEvaluation = {
  readonly policy: string;
  readonly conditions: readonly EvaluatedCondition[];
};

export class PermissionEvaluationService {
  evaluate(input: PermissionEvaluationInput): AuthorizationDecision {
    const permission = permissionCatalogue.find((candidate) => candidate.id === input.permission);
    const permissionCondition = condition(
      'PermissionExists',
      Boolean(permission),
      'PERMISSION_DENIED',
    );

    if (!permission) {
      return denied(input.permission, 'permission.catalogue', [permissionCondition]);
    }

    const platform = this.evaluatePlatformAdministrator(input, permission.scope);

    if (platform.conditions.every((item) => item.passed)) {
      return allowed(
        input.permission,
        platform.policy,
        platform.conditions,
        'PLATFORM_SUPER_ADMINISTRATOR',
      );
    }

    const explicitDeny = evaluateExplicitDeny(input);

    if (!explicitDeny.conditions.every((item) => item.passed)) {
      return denied(
        input.permission,
        explicitDeny.policy,
        explicitDeny.conditions,
        input.membership?.role,
      );
    }

    if (permission.scope === 'global') {
      return this.evaluateGlobalPermission(input, [permissionCondition]);
    }

    const tenant = evaluateTenant(input);

    if (!tenant.conditions.every((item) => item.passed)) {
      return denied(input.permission, tenant.policy, tenant.conditions, input.membership?.role);
    }

    const role = evaluateRolePermission(input);

    if (!role.conditions.every((item) => item.passed)) {
      return denied(input.permission, role.policy, role.conditions, input.membership?.role);
    }

    const policy = evaluatePermissionPolicy(input);

    if (!policy.conditions.every((item) => item.passed)) {
      return denied(input.permission, policy.policy, policy.conditions, input.membership?.role);
    }

    return allowed(
      input.permission,
      policy.policy,
      [permissionCondition, ...tenant.conditions, ...role.conditions, ...policy.conditions],
      input.membership?.role,
    );
  }

  private evaluatePlatformAdministrator(
    input: PermissionEvaluationInput,
    permissionScope: 'global' | 'organization',
  ): PolicyEvaluation {
    const isAdmin = Boolean(input.actor.platformRoles?.includes('PLATFORM_SUPER_ADMINISTRATOR'));
    const sameTenant =
      permissionScope === 'global' ||
      !input.tenant.tenantId ||
      !input.organization ||
      input.tenant.tenantId === input.organization.id;

    return {
      policy: 'platform.administrator.override',
      conditions: [
        condition('IsPlatformAdministrator', isAdmin, 'PERMISSION_DENIED'),
        condition('IsSameTenant', sameTenant, 'CROSS_TENANT_DENIED'),
      ],
    };
  }

  private evaluateGlobalPermission(
    input: PermissionEvaluationInput,
    baseConditions: readonly EvaluatedCondition[],
  ): AuthorizationDecision {
    if (input.permission === 'organization:create') {
      const conditions = [
        ...baseConditions,
        condition('IsActorActive', input.actor.identityStatus === 'ACTIVE', 'POLICY_VIOLATION'),
        condition('IsActorEmailVerified', input.actor.emailVerified === true, 'POLICY_VIOLATION'),
      ];

      if (conditions.every((item) => item.passed)) {
        return allowed(input.permission, 'organization.create.verified_actor', conditions);
      }

      return denied(input.permission, 'organization.create.verified_actor', conditions);
    }

    const platformPermissions = resolvePlatformPermissions(input.actor.platformRoles ?? []);
    const grantsPermission = platformPermissions.includes(input.permission);
    const conditions = [
      ...baseConditions,
      condition('RoleGrantsPermission', grantsPermission, 'PERMISSION_DENIED'),
    ];

    if (conditions.every((item) => item.passed)) {
      return allowed(
        input.permission,
        'global.permission',
        conditions,
        input.actor.platformRoles?.[0],
      );
    }

    return denied(input.permission, 'global.permission', conditions);
  }
}

function evaluateExplicitDeny(input: PermissionEvaluationInput): PolicyEvaluation {
  const target = input.resource?.targetMembership;
  const lastOwnerOperation =
    input.resource?.isLastOwnerTarget === true &&
    target?.role === 'OWNER' &&
    target.status === 'ACTIVE' &&
    ['membership:suspend', 'membership:remove'].includes(input.permission);
  const downgradeLastOwner =
    input.resource?.isLastOwnerTarget === true &&
    target?.role === 'OWNER' &&
    input.permission === 'membership:update';

  return {
    policy: 'explicit.deny.precedence',
    conditions: [
      condition('ExplicitDenyAbsent', !lastOwnerOperation && !downgradeLastOwner, 'EXPLICIT_DENY'),
    ],
  };
}

function evaluateTenant(input: PermissionEvaluationInput): PolicyEvaluation {
  const tenantRequired = Boolean(input.tenant.tenantId);
  const organizationMatches = Boolean(
    input.organization &&
    input.tenant.tenantId &&
    input.organization.id === input.tenant.tenantId &&
    (!input.resource?.organizationId || input.resource.organizationId === input.tenant.tenantId),
  );

  return {
    policy: 'tenant.scope',
    conditions: [
      condition('TenantRequired', tenantRequired, 'TENANT_REQUIRED'),
      condition('IsSameTenant', organizationMatches, 'CROSS_TENANT_DENIED'),
    ],
  };
}

function evaluateRolePermission(input: PermissionEvaluationInput): PolicyEvaluation {
  const membership = input.membership;
  const activeMembership = Boolean(
    membership &&
    membership.status === 'ACTIVE' &&
    membership.identityId === input.actor.identityId &&
    membership.organizationId === input.tenant.tenantId,
  );
  const rolePermissions = membership ? organizationRolePermissions[membership.role] : [];
  const selfMembershipRead =
    input.permission === 'membership:read' &&
    input.resource?.targetIdentityId === input.actor.identityId;
  const roleGrantsPermission = rolePermissions.includes(input.permission) || selfMembershipRead;
  const conditions: EvaluatedCondition[] = [
    condition('HasAssignedRole', Boolean(membership), 'ROLE_NOT_ASSIGNED'),
    condition('IsMembershipActive', activeMembership, 'INVALID_MEMBERSHIP'),
  ];

  if (selfMembershipRead) {
    conditions.push(condition('IsSelfOperation', true));
  }

  conditions.push(condition('RoleGrantsPermission', roleGrantsPermission, 'PERMISSION_DENIED'));

  return {
    policy: 'role.permission',
    conditions,
  };
}

function evaluatePermissionPolicy(input: PermissionEvaluationInput): PolicyEvaluation {
  if (input.permission === 'organization:read') {
    return {
      policy: 'organization.readable',
      conditions: [
        condition(
          'IsOrganizationReadable',
          isOrganizationReadable(input.organization),
          'ORGANIZATION_INACTIVE',
        ),
      ],
    };
  }

  if (input.permission === 'organization:archive') {
    return {
      policy: 'organization.archivable',
      conditions: [
        condition(
          'IsOrganizationArchivable',
          input.organization?.status === 'CLOSED',
          'POLICY_VIOLATION',
        ),
      ],
    };
  }

  if (input.permission === 'organization:suspend') {
    return {
      policy: 'organization.suspend.platform_only',
      conditions: [condition('IsPlatformAdministrator', false, 'PERMISSION_DENIED')],
    };
  }

  if (input.permission === 'ownership:transfer') {
    return {
      policy: 'ownership.owner_required',
      conditions: [
        condition(
          'IsOrganizationActive',
          input.organization?.status === 'ACTIVE',
          'ORGANIZATION_INACTIVE',
        ),
        condition('IsOrganizationOwner', input.membership?.role === 'OWNER', 'OWNERSHIP_REQUIRED'),
        condition(
          'IsMembershipActive',
          input.resource?.targetMembership?.status === 'ACTIVE',
          'INVALID_MEMBERSHIP',
        ),
      ],
    };
  }

  if (input.permission.startsWith('membership:')) {
    return {
      policy: 'membership.active_organization',
      conditions: [
        condition(
          'IsOrganizationActive',
          input.organization?.status === 'ACTIVE',
          'ORGANIZATION_INACTIVE',
        ),
      ],
    };
  }

  if (input.permission.startsWith('invitation:')) {
    const conditions: EvaluatedCondition[] = [
      condition(
        'IsOrganizationActive',
        input.organization?.status === 'ACTIVE',
        'ORGANIZATION_INACTIVE',
      ),
    ];

    if (input.permission === 'invitation:revoke') {
      conditions.push(
        condition(
          'IsInvitationPending',
          input.resource?.invitationStatus === 'PENDING',
          'POLICY_VIOLATION',
        ),
      );
    }

    return {
      policy: 'invitation.active_organization',
      conditions,
    };
  }

  if (['event:create', 'campaign:create', 'candidate:create'].includes(input.permission)) {
    return {
      policy: 'business_operations.active_organization',
      conditions: [
        condition(
          'IsOrganizationActive',
          input.organization?.status === 'ACTIVE',
          'ORGANIZATION_INACTIVE',
        ),
      ],
    };
  }

  if (input.permission.startsWith('billing:')) {
    return {
      policy: 'billing.active_organization',
      conditions: [
        condition(
          'IsOrganizationReadable',
          isOrganizationReadable(input.organization),
          'ORGANIZATION_INACTIVE',
        ),
      ],
    };
  }

  if (input.permission === 'organization:update' || input.permission === 'organization:close') {
    return {
      policy: 'organization.mutable',
      conditions: [
        condition(
          'IsOrganizationMutable',
          input.organization?.status === 'ACTIVE',
          'ORGANIZATION_INACTIVE',
        ),
      ],
    };
  }

  return {
    policy: 'permission.default',
    conditions: [],
  };
}

function isOrganizationReadable(
  organization: AuthorizationOrganization | null | undefined,
): boolean {
  return Boolean(organization && organization.status !== 'ARCHIVED');
}

function resolvePlatformPermissions(
  platformRoles: readonly PlatformRole[],
): readonly PermissionId[] {
  return [...new Set(platformRoles.flatMap((role) => platformRolePermissions[role]))];
}

function condition(
  conditionName: AuthorizationConditionName,
  passed: boolean,
  reasonCode?: AuthorizationDecisionReason,
): EvaluatedCondition {
  return {
    condition: conditionName,
    passed,
    reasonCode: passed ? undefined : reasonCode,
  };
}

function allowed(
  permission: PermissionId,
  policy: string,
  evaluatedConditions: readonly EvaluatedCondition[],
  role?: OrganizationRole | PlatformRole,
): AuthorizationDecision {
  return {
    allowed: true,
    reasonCode: 'ALLOWED',
    permission,
    policy,
    evaluatedConditions,
    role,
  };
}

function denied(
  permission: PermissionId,
  policy: string,
  evaluatedConditions: readonly EvaluatedCondition[],
  role?: OrganizationRole | PlatformRole,
): AuthorizationDecision {
  const failed = evaluatedConditions.find((item) => !item.passed);

  return {
    allowed: false,
    reasonCode: failed?.reasonCode ?? 'PERMISSION_DENIED',
    permission,
    policy,
    evaluatedConditions,
    role,
  };
}
