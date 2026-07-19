'use client';

import * as React from 'react';

import { StatusMessage } from '../../../../../components/feedback/status-message';
import { FormField, SubmitButton } from '../../../../../components/ui/form-field';
import { organizationApi } from '../../../../../lib/api/organization-api';
import type { MembershipSummary } from '../../../../../lib/api/types';
import { useAuth } from '../../../../../providers/auth-provider';

export default function OwnershipTransferPage({
  params,
}: Readonly<{ params: Promise<{ organizationId: string }> }>) {
  const resolved = React.use(params);
  const { accessToken } = useAuth();
  const [memberships, setMemberships] = React.useState<readonly MembershipSummary[]>([]);
  const [message, setMessage] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!accessToken) {
      return;
    }

    void organizationApi
      .listMemberships(accessToken, resolved.organizationId)
      .then((response) => setMemberships(response.memberships))
      .catch((caught) =>
        setMessage(caught instanceof Error ? caught.message : 'Could not load eligible members.'),
      );
  }, [accessToken, resolved.organizationId]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!accessToken) {
      setMessage('Session expired. Log in again.');
      return;
    }

    const data = new FormData(event.currentTarget);
    const targetMembershipId = String(data.get('targetMembershipId') ?? '');
    const confirmation = String(data.get('confirmation') ?? '');

    if (!targetMembershipId) {
      setMessage('Select the future owner.');
      return;
    }

    if (confirmation !== 'TRANSFER') {
      setMessage('Type TRANSFER to confirm this ownership change.');
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      await organizationApi.transferOwnership(accessToken, resolved.organizationId, {
        targetMembershipId,
        previousOwnerRole: 'ADMINISTRATOR',
      });
      setMessage('Ownership transfer requested.');
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Ownership transfer failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-md border border-slate-200 bg-white p-5">
        <h1 className="text-2xl font-semibold">Ownership transfer</h1>
        <p className="mt-2 text-slate-600">
          This governance action changes who controls the organization. The backend enforces
          permission, membership state and last-owner rules.
        </p>
      </section>
      {message ? <StatusMessage tone="warning">{message}</StatusMessage> : null}
      <form
        className="grid gap-4 rounded-md border border-slate-200 bg-white p-5"
        onSubmit={onSubmit}
      >
        <label className="grid gap-2 text-sm font-medium text-slate-800">
          Future owner
          <select
            name="targetMembershipId"
            className="h-11 rounded-md border border-slate-300 bg-white px-3"
          >
            <option value="">Select member</option>
            {memberships
              .filter((membership) => membership.status === 'ACTIVE')
              .map((membership) => (
                <option key={membership.id} value={membership.id}>
                  {membership.identityId} - {membership.role}
                </option>
              ))}
          </select>
        </label>
        <FormField label="Type TRANSFER to confirm" name="confirmation" required />
        <SubmitButton loading={loading}>Transfer ownership</SubmitButton>
      </form>
    </div>
  );
}
