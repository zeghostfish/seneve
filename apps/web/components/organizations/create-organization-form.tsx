'use client';

import * as React from 'react';

import { organizationApi } from '../../lib/api/organization-api';
import {
  validateLocale,
  validateOrganizationName,
  validateOrganizationSlug,
  validateTimezone,
} from '../../lib/validation/forms';
import { useAuth } from '../../providers/auth-provider';
import { useOrganizations } from '../../providers/organization-provider';
import { StatusMessage } from '../feedback/status-message';
import { FormField, SubmitButton } from '../ui/form-field';

export function CreateOrganizationForm() {
  const { accessToken } = useAuth();
  const { reload, selectOrganization } = useOrganizations();
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken) {
      setError('Session expired. Log in again.');
      return;
    }

    const data = new FormData(event.currentTarget);
    const displayName = String(data.get('displayName') ?? '');
    const slug = String(data.get('slug') ?? '');
    const defaultLocale = String(data.get('defaultLocale') ?? 'en');
    const timezone = String(data.get('timezone') ?? 'UTC');
    const validationError =
      validateOrganizationName(displayName) ??
      validateOrganizationSlug(slug) ??
      validateLocale(defaultLocale) ??
      validateTimezone(timezone);

    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await organizationApi.create(accessToken, {
        displayName: displayName.trim(),
        slug: slug.trim(),
        defaultLocale: defaultLocale.trim(),
        timezone: timezone.trim(),
      });
      await reload();
      selectOrganization(response.organization.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Organization creation failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      className="grid gap-4 rounded-md border border-slate-200 bg-white p-5"
      onSubmit={onSubmit}
    >
      <h2 className="text-lg font-semibold">Create organization</h2>
      {error ? <StatusMessage tone="danger">{error}</StatusMessage> : null}
      <FormField label="Organization name" name="displayName" required maxLength={120} />
      <FormField label="Slug" name="slug" required maxLength={63} placeholder="seneve-awards" />
      <FormField label="Locale" name="defaultLocale" defaultValue="en" required maxLength={12} />
      <FormField
        label="Timezone"
        name="timezone"
        defaultValue="Africa/Lome"
        required
        maxLength={64}
      />
      <SubmitButton loading={loading}>Create organization</SubmitButton>
    </form>
  );
}
