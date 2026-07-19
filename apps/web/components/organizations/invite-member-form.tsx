'use client';

import * as React from 'react';

import { organizationApi } from '../../lib/api/organization-api';
import {
  ORGANIZATION_ROLES,
  isOrganizationRole,
  normalizeEmailInput,
  validateEmailInput,
} from '../../lib/validation/forms';
import { useAuth } from '../../providers/auth-provider';
import { StatusMessage } from '../feedback/status-message';
import { FormField, SubmitButton } from '../ui/form-field';

export function InviteMemberForm({
  organizationId,
  onCreated,
}: Readonly<{ organizationId: string; onCreated: () => Promise<void> }>) {
  const { accessToken } = useAuth();
  const [message, setMessage] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken) {
      setMessage('Session expired. Log in again.');
      return;
    }

    const data = new FormData(event.currentTarget);
    const email = normalizeEmailInput(String(data.get('email') ?? ''));
    const role = String(data.get('role') ?? 'VIEWER');
    const emailError = validateEmailInput(email);

    if (emailError) {
      setMessage(emailError);
      return;
    }

    if (!isOrganizationRole(role) || role === 'OWNER') {
      setMessage('Select an invitation role.');
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      await organizationApi.invite(accessToken, organizationId, {
        email,
        role,
      });
      event.currentTarget.reset();
      setMessage('Invitation created.');
      await onCreated();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Invitation failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      className="grid gap-4 rounded-md border border-slate-200 bg-white p-5"
      onSubmit={onSubmit}
    >
      <h2 className="text-lg font-semibold">Invite member</h2>
      {message ? <StatusMessage tone="warning">{message}</StatusMessage> : null}
      <FormField label="Recipient email" name="email" type="email" required maxLength={254} />
      <label className="grid gap-2 text-sm font-medium text-slate-800">
        Role
        <select name="role" className="h-11 rounded-md border border-slate-300 bg-white px-3">
          {ORGANIZATION_ROLES.filter((role) => role !== 'OWNER').map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
      </label>
      <SubmitButton loading={loading}>Create invitation</SubmitButton>
    </form>
  );
}
