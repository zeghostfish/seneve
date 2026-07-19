'use client';

import * as React from 'react';

import { InviteMemberForm } from '../../../../../components/organizations/invite-member-form';
import { StatusMessage } from '../../../../../components/feedback/status-message';
import { organizationApi } from '../../../../../lib/api/organization-api';
import type { InvitationSummary } from '../../../../../lib/api/types';
import { useAuth } from '../../../../../providers/auth-provider';

export default function InvitationsPage({
  params,
}: Readonly<{ params: Promise<{ organizationId: string }> }>) {
  const resolved = React.use(params);
  const { accessToken } = useAuth();
  const [invitations, setInvitations] = React.useState<readonly InvitationSummary[]>([]);
  const [message, setMessage] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    if (!accessToken) {
      return;
    }

    const response = await organizationApi.listInvitations(accessToken, resolved.organizationId);
    setInvitations(response.invitations);
  }, [accessToken, resolved.organizationId]);

  React.useEffect(() => {
    void load().catch((caught) =>
      setMessage(caught instanceof Error ? caught.message : 'Could not load invitations.'),
    );
  }, [load]);

  async function revoke(invitationId: string) {
    if (!accessToken) {
      return;
    }

    try {
      await organizationApi.revokeInvitation(accessToken, resolved.organizationId, invitationId);
      await load();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Could not revoke invitation.');
    }
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-md border border-slate-200 bg-white p-5">
        <h1 className="text-2xl font-semibold">Invitations</h1>
        <p className="mt-2 text-slate-600">Create and revoke pending organization invitations.</p>
      </section>
      {message ? <StatusMessage tone="warning">{message}</StatusMessage> : null}
      <InviteMemberForm organizationId={resolved.organizationId} onCreated={load} />
      <div className="grid gap-3">
        {invitations.map((invitation) => (
          <article key={invitation.id} className="rounded-md border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">{invitation.normalizedRecipientEmail}</h2>
                <p className="text-sm text-slate-600">
                  {invitation.intendedRole} - {invitation.status} - expires {invitation.expiresAt}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void revoke(invitation.id)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50"
              >
                Revoke
              </button>
            </div>
          </article>
        ))}
        {invitations.length === 0 ? <p className="text-slate-600">No invitations found.</p> : null}
      </div>
    </div>
  );
}
