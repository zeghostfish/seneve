'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { StatusMessage } from '../../../components/feedback/status-message';
import { FormField, SubmitButton } from '../../../components/ui/form-field';
import { organizationApi } from '../../../lib/api/organization-api';
import { normalizeEmailInput, validateEmailInput } from '../../../lib/validation/forms';
import { useAuth } from '../../../providers/auth-provider';
import { useOrganizations } from '../../../providers/organization-provider';

export default function AcceptInvitationPage() {
  const params = useSearchParams();
  const router = useRouter();
  const { accessToken, status } = useAuth();
  const { reload, selectOrganization } = useOrganizations();
  const [message, setMessage] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!accessToken) {
      setMessage('Log in before accepting an invitation.');
      return;
    }

    const data = new FormData(event.currentTarget);
    const tokenId = String(data.get('tokenId') ?? params.get('tokenId') ?? '');
    const token = String(data.get('token') ?? params.get('token') ?? '');
    const recipientEmail = normalizeEmailInput(String(data.get('recipientEmail') ?? ''));
    const emailError = validateEmailInput(recipientEmail);

    if (!tokenId || !token) {
      setMessage('Invitation link is missing required information.');
      return;
    }

    if (emailError) {
      setMessage(emailError);
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await organizationApi.acceptInvitation(accessToken, {
        tokenId,
        token,
        recipientEmail,
      });
      await reload();
      selectOrganization(response.organization.id);
      window.history.replaceState(null, '', '/dashboard');
      router.replace(`/organizations/${response.organization.id}`);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Invitation could not be accepted.');
      window.history.replaceState(null, '', '/invitation/accept');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto grid min-h-screen max-w-xl content-center gap-6 px-6 py-12">
      <section className="rounded-md border border-slate-200 bg-white p-6">
        <h1 className="text-2xl font-semibold">Accept invitation</h1>
        <p className="mt-2 text-slate-600">
          Confirm the email address that received this invitation. The backend validates the token,
          recipient and organization membership before access is granted.
        </p>
      </section>
      {status === 'unauthenticated' ? (
        <StatusMessage tone="warning">Log in or create an account before accepting.</StatusMessage>
      ) : null}
      {message ? <StatusMessage tone="warning">{message}</StatusMessage> : null}
      <form
        className="grid gap-4 rounded-md border border-slate-200 bg-white p-6"
        onSubmit={onSubmit}
      >
        <input type="hidden" name="tokenId" value={params.get('tokenId') ?? ''} />
        <input type="hidden" name="token" value={params.get('token') ?? ''} />
        <FormField
          label="Recipient email"
          name="recipientEmail"
          type="email"
          required
          maxLength={254}
        />
        <SubmitButton loading={loading}>Accept invitation</SubmitButton>
      </form>
    </main>
  );
}
