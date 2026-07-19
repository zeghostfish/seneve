'use client';

import * as React from 'react';

import { campaignApi } from '../../lib/api/campaign-api';
import type { CampaignSummary } from '../../lib/api/types';
import { validateResultVisibility, validateVotesPerVoter } from '../../lib/validation/forms';
import { useAuth } from '../../providers/auth-provider';
import { useOrganizations } from '../../providers/organization-provider';
import { StatusMessage } from '../feedback/status-message';
import { FormField, SubmitButton } from '../ui/form-field';

export function CampaignRulesForm({
  campaign,
  onChanged,
}: Readonly<{ campaign: CampaignSummary; onChanged: () => Promise<void> }>) {
  const { accessToken } = useAuth();
  const { currentOrganization } = useOrganizations();
  const [message, setMessage] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken || !currentOrganization) {
      setMessage('Session expired. Log in again.');
      return;
    }

    const data = new FormData(event.currentTarget);
    const votesPerVoter = Number(data.get('votesPerVoter') ?? 1);
    const resultsVisibility = String(data.get('resultsVisibility') ?? 'AFTER_CAMPAIGN') as
      'HIDDEN' | 'LIVE' | 'AFTER_CAMPAIGN' | 'SCHEDULED';
    const resultRevealAt = optional(data.get('resultRevealAt'));
    const validationError =
      validateVotesPerVoter(votesPerVoter) ??
      validateResultVisibility(resultsVisibility, resultRevealAt);

    if (validationError) {
      setMessage(validationError);
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      await campaignApi.updateRules(accessToken, currentOrganization.id, campaign.id, {
        expectedVersion: campaign.version,
        votingMode: String(data.get('votingMode') ?? 'FREE') as 'FREE' | 'PAID' | 'HYBRID',
        votesPerVoter,
        allowMultipleCandidates: data.get('allowMultipleCandidates') === 'on',
        requiresEmailVerification: data.get('requiresEmailVerification') === 'on',
        resultsVisibility,
        resultRevealAt,
      });
      await onChanged();
      setMessage('Campaign rules updated.');
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Rules update failed.');
      await onChanged();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      className="grid gap-4 rounded-md border border-slate-200 bg-white p-5"
      onSubmit={onSubmit}
    >
      <h2 className="text-lg font-semibold">Voting configuration</h2>
      {message ? <StatusMessage tone="warning">{message}</StatusMessage> : null}
      <div className="grid gap-4 md:grid-cols-3">
        <Select
          label="Voting mode"
          name="votingMode"
          defaultValue={campaign.rules.votingMode}
          options={['FREE', 'PAID', 'HYBRID']}
        />
        <FormField
          label="Votes per voter"
          name="votesPerVoter"
          type="number"
          defaultValue={String(campaign.rules.votesPerVoter)}
          required
        />
        <Select
          label="Results visibility"
          name="resultsVisibility"
          defaultValue={campaign.rules.results.visibility}
          options={['HIDDEN', 'LIVE', 'AFTER_CAMPAIGN', 'SCHEDULED']}
        />
      </div>
      <FormField
        label="Result reveal date"
        name="resultRevealAt"
        type="datetime-local"
        defaultValue={campaign.rules.results.revealAt?.slice(0, 16)}
      />
      <label className="flex items-center gap-2 text-sm text-slate-800">
        <input
          name="allowMultipleCandidates"
          type="checkbox"
          defaultChecked={campaign.rules.allowMultipleCandidates}
        />{' '}
        Allow multiple candidates
      </label>
      <label className="flex items-center gap-2 text-sm text-slate-800">
        <input
          name="requiresEmailVerification"
          type="checkbox"
          defaultChecked={campaign.rules.requiresEmailVerification}
        />{' '}
        Require email verification
      </label>
      <SubmitButton loading={loading}>Save rules</SubmitButton>
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
