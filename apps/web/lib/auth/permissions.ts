export type SenevePermission =
  | 'organization:create'
  | 'organization:read'
  | 'organization:update'
  | 'membership:read'
  | 'membership:update'
  | 'membership:suspend'
  | 'membership:remove'
  | 'invitation:read'
  | 'invitation:create'
  | 'invitation:revoke'
  | 'ownership:transfer'
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
  | 'voting:results:read';

export interface FrontendPermissionDecision {
  readonly allowed: boolean;
  readonly permission: SenevePermission;
  readonly reason: 'backend_enforced' | 'no_organization_selected';
}
