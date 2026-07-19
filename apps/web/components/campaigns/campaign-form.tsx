'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { campaignApi } from '../../lib/api/campaign-api';
import type { CampaignSummary } from '../../lib/api/types';
import {
  validateCampaignName,
  validateCampaignSchedule,
  validateCampaignSlug,
  validateLocale,
  validateResultVisibility,
  validateTimezone,
  validateVotesPerVoter,
} from '../../lib/validation/forms';
import { useAuth } from '../../providers/auth-provider';
import { useOrganizations } from '../../providers/organization-provider';
import { StatusMessage } from '../feedback/status-message';
import { FormField, SubmitButton } from '../ui/form-field';

export function CampaignForm({
  mode,
  campaign,
}: Readonly<{ mode: 'create' | 'edit'; campaign?: CampaignSummary }>) {
  const router = useRouter();
  const { accessToken } = useAuth();
  const { currentOrganization } = useOrganizations();
  const [message, setMessage] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!accessToken || !currentOrganization) {
      setMessage('Select an organization and sign in again.');
      return;
    }

    const data = new FormData(event.currentTarget);
    const name = String(data.get('name') ?? '');
    const slug = String(data.get('slug') ?? '');
    const description = optional(data.get('description'));
    const visibility = String(data.get('visibility') ?? 'PRIVATE') as CampaignSummary['visibility'];
    const startsAt = String(data.get('startsAt') ?? '');
    const endsAt = String(data.get('endsAt') ?? '');
    const timezone = String(data.get('timezone') ?? currentOrganization.timezone);
    const locale = String(data.get('locale') ?? currentOrganization.defaultLocale);
    const votesPerVoter = Number(data.get('votesPerVoter') ?? 1);
    const resultsVisibility = String(data.get('resultsVisibility') ?? 'AFTER_CAMPAIGN') as
      'HIDDEN' | 'LIVE' | 'AFTER_CAMPAIGN' | 'SCHEDULED';
    const resultRevealAt = optional(data.get('resultRevealAt'));
    const validationError =
      validateCampaignName(name) ??
      validateCampaignSlug(slug) ??
      validateCampaignSchedule(startsAt, endsAt) ??
      validateTimezone(timezone) ??
      validateLocale(locale) ??
      validateVotesPerVoter(votesPerVoter) ??
      validateResultVisibility(resultsVisibility, resultRevealAt);

    if (validationError) {
      setMessage(validationError);
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const payload = {
        name: name.trim(),
        slug: slug.trim(),
        description,
        visibility,
        startsAt,
        endsAt,
        timezone: timezone.trim(),
        locale: locale.trim(),
        votingMode: String(data.get('votingMode') ?? 'FREE') as 'FREE' | 'PAID' | 'HYBRID',
        votesPerVoter,
        allowMultipleCandidates: data.get('allowMultipleCandidates') === 'on',
        requiresEmailVerification: data.get('requiresEmailVerification') === 'on',
        resultsVisibility,
        resultRevealAt,
      };
      const response =
        mode === 'create'
          ? await campaignApi.create(accessToken, currentOrganization.id, payload)
          : await campaignApi.update(accessToken, currentOrganization.id, campaign!.id, {
              expectedVersion: campaign!.version,
              name: payload.name,
              slug: payload.slug,
              description: payload.description,
              visibility: payload.visibility,
            });

      router.push(`/campaigns/${response.campaign.id}`);
      router.refresh();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Campaign request failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      className="grid gap-5 rounded-md border border-slate-200 bg-white p-5"
      onSubmit={onSubmit}
    >
      {message ? <StatusMessage tone="warning">{message}</StatusMessage> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <FormField
          label="Campaign name"
          name="name"
          required
          maxLength={160}
          defaultValue={campaign?.name}
        />
        <FormField label="Slug" name="slug" required maxLength={63} defaultValue={campaign?.slug} />
      </div>
      <label className="grid gap-2 text-sm font-medium text-slate-800">
        Description
        <textarea
          name="description"
          defaultValue={campaign?.description ?? ''}
          maxLength={2000}
          className="min-h-24 rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-950 outline-none focus:border-slate-950 focus:ring-2 focus:ring-slate-200"
        />
      </label>
      <div className="grid gap-4 md:grid-cols-2">
        <FormField
          label="Starts at"
          name="startsAt"
          type="datetime-local"
          required
          defaultValue={localDate(campaign?.startsAt)}
        />
        <FormField
          label="Ends at"
          name="endsAt"
          type="datetime-local"
          required
          defaultValue={localDate(campaign?.endsAt)}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Select
          label="Visibility"
          name="visibility"
          defaultValue={campaign?.visibility ?? 'PRIVATE'}
          options={['PRIVATE', 'UNLISTED', 'PUBLIC']}
        />
        <FormField
          label="Locale"
          name="locale"
          required
          maxLength={12}
          defaultValue={campaign?.locale ?? currentOrganization?.defaultLocale ?? 'en'}
        />
        <FormField
          label="Timezone"
          name="timezone"
          required
          maxLength={64}
          defaultValue={campaign?.timezone ?? currentOrganization?.timezone ?? 'Africa/Lome'}
        />
      </div>
      {mode === 'create' ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Select
              label="Voting mode"
              name="votingMode"
              defaultValue="FREE"
              options={['FREE', 'PAID', 'HYBRID']}
            />
            <FormField
              label="Votes per voter"
              name="votesPerVoter"
              type="number"
              required
              defaultValue="1"
            />
            <Select
              label="Results visibility"
              name="resultsVisibility"
              defaultValue="AFTER_CAMPAIGN"
              options={['HIDDEN', 'LIVE', 'AFTER_CAMPAIGN', 'SCHEDULED']}
            />
          </div>
          <FormField label="Result reveal date" name="resultRevealAt" type="datetime-local" />
          <label className="flex items-center gap-2 text-sm text-slate-800">
            <input name="allowMultipleCandidates" type="checkbox" className="h-4 w-4" /> Allow
            multiple candidates
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-800">
            <input
              name="requiresEmailVerification"
              type="checkbox"
              className="h-4 w-4"
              defaultChecked
            />{' '}
            Require email verification
          </label>
        </>
      ) : null}
      <SubmitButton loading={loading}>
        {mode === 'create' ? 'Create campaign' : 'Save campaign'}
      </SubmitButton>
    </form>
  );
}

function Select({
  label,
  name,
  defaultValue,
  options,
}: Readonly<{ label: string; name: string; defaultValue: string; options: readonly string[] }>) {
  return (
    <label className="grid gap-2 text-sm font-medium text-slate-800">
      {label}
      <select
        name={name}
        defaultValue={defaultValue}
        className="h-11 rounded-md border border-slate-300 bg-white px-3"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function optional(value: FormDataEntryValue | null): string | null {
  const text = String(value ?? '').trim();
  return text.length > 0 ? text : null;
}

function localDate(value?: string | null): string | undefined {
  if (!value) {
    return undefined;
  }

  return value.slice(0, 16);
}
