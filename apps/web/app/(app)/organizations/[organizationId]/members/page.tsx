'use client';

import * as React from 'react';

import { organizationApi } from '../../../../../lib/api/organization-api';
import type { MembershipSummary } from '../../../../../lib/api/types';
import { ORGANIZATION_ROLES, isOrganizationRole } from '../../../../../lib/validation/forms';
import { useAuth } from '../../../../../providers/auth-provider';
import { StatusMessage } from '../../../../../components/feedback/status-message';

export default function MembersPage({
  params,
}: Readonly<{ params: Promise<{ organizationId: string }> }>) {
  const resolved = React.use(params);
  const { accessToken } = useAuth();
  const [memberships, setMemberships] = React.useState<readonly MembershipSummary[]>([]);
  const [message, setMessage] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    if (!accessToken) {
      return;
    }

    const response = await organizationApi.listMemberships(accessToken, resolved.organizationId);
    setMemberships(response.memberships);
  }, [accessToken, resolved.organizationId]);

  React.useEffect(() => {
    void load().catch((caught) =>
      setMessage(caught instanceof Error ? caught.message : 'Could not load members.'),
    );
  }, [load]);

  async function suspend(membershipId: string) {
    if (!accessToken) {
      return;
    }

    try {
      await organizationApi.suspendMembership(accessToken, resolved.organizationId, membershipId);
      await load();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Could not suspend member.');
    }
  }

  async function updateRole(membershipId: string, role: string) {
    if (!accessToken) {
      return;
    }

    if (!isOrganizationRole(role)) {
      setMessage('Select a valid role.');
      return;
    }

    try {
      await organizationApi.updateMembershipRole(
        accessToken,
        resolved.organizationId,
        membershipId,
        role,
      );
      await load();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Could not update member role.');
    }
  }

  async function remove(membershipId: string) {
    if (!accessToken) {
      return;
    }

    try {
      await organizationApi.removeMembership(accessToken, resolved.organizationId, membershipId);
      await load();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Could not remove member.');
    }
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-md border border-slate-200 bg-white p-5">
        <h1 className="text-2xl font-semibold">Members</h1>
        <p className="mt-2 text-slate-600">
          Backend permissions and domain invariants remain authoritative.
        </p>
      </section>
      {message ? <StatusMessage tone="warning">{message}</StatusMessage> : null}
      <div className="grid gap-3">
        {memberships.map((membership) => (
          <article key={membership.id} className="rounded-md border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">{membership.identityId}</h2>
                <p className="text-sm text-slate-600">
                  {membership.role} - {membership.status}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <label className="sr-only" htmlFor={`role-${membership.id}`}>
                  Role for {membership.identityId}
                </label>
                <select
                  id={`role-${membership.id}`}
                  defaultValue={membership.role}
                  onChange={(event) => void updateRole(membership.id, event.currentTarget.value)}
                  className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
                >
                  {ORGANIZATION_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => void suspend(membership.id)}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50"
                >
                  Suspend
                </button>
                <button
                  type="button"
                  onClick={() => void remove(membership.id)}
                  className="rounded-md border border-red-300 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
                >
                  Remove
                </button>
              </div>
            </div>
          </article>
        ))}
        {memberships.length === 0 ? <p className="text-slate-600">No members found.</p> : null}
      </div>
    </div>
  );
}
