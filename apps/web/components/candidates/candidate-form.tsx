'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { candidateApi } from '../../lib/api/candidate-api';
import type { CandidateSummary } from '../../lib/api/types';
import {
  validateCandidateDisplayName,
  validateCandidateSlug,
  validatePlainText,
} from '../../lib/validation/forms';
import { useAuth } from '../../providers/auth-provider';
import { useOrganizations } from '../../providers/organization-provider';
import { StatusMessage } from '../feedback/status-message';
import { FormField, SubmitButton } from '../ui/form-field';

export function CandidateForm({
  campaignId,
  candidate,
}: Readonly<{ campaignId: string; candidate?: CandidateSummary }>) {
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
    const displayName = String(data.get('displayName') ?? '');
    const slug = String(data.get('slug') ?? '');
    const shortDescription = optional(data.get('shortDescription'));
    const description = optional(data.get('description'));
    const validationError =
      validateCandidateDisplayName(displayName) ??
      validateCandidateSlug(slug) ??
      validatePlainText(shortDescription ?? '', 280) ??
      validatePlainText(description ?? '', 4000);

    if (validationError) {
      setMessage(validationError);
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const payload = {
        displayName: displayName.trim(),
        slug: slug.trim(),
        shortDescription,
        description,
        imageAssetId: optional(data.get('imageAssetId')),
        externalReference: optional(data.get('externalReference')),
      };
      const response = candidate
        ? await candidateApi.update(accessToken, currentOrganization.id, campaignId, candidate.id, {
            ...payload,
            expectedVersion: candidate.version,
          })
        : await candidateApi.create(accessToken, currentOrganization.id, campaignId, payload);

      router.push(`/campaigns/${campaignId}/candidates/${response.candidate.id}`);
      router.refresh();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Candidate request failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      className="grid gap-4 rounded-md border border-slate-200 bg-white p-5"
      onSubmit={onSubmit}
    >
      {message ? <StatusMessage tone="warning">{message}</StatusMessage> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <FormField
          label="Display name"
          name="displayName"
          required
          maxLength={160}
          defaultValue={candidate?.displayName}
        />
        <FormField
          label="Slug"
          name="slug"
          required
          maxLength={63}
          defaultValue={candidate?.slug}
        />
      </div>
      <FormField
        label="Short description"
        name="shortDescription"
        maxLength={280}
        defaultValue={candidate?.shortDescription ?? ''}
      />
      <label className="grid gap-2 text-sm font-medium text-slate-800">
        Description
        <textarea
          name="description"
          defaultValue={candidate?.description ?? ''}
          maxLength={4000}
          className="min-h-28 rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-950 outline-none focus:border-slate-950 focus:ring-2 focus:ring-slate-200"
        />
      </label>
      <div className="grid gap-4 md:grid-cols-2">
        <FormField
          label="Image asset reference"
          name="imageAssetId"
          maxLength={256}
          defaultValue={candidate?.imageAssetId ?? ''}
        />
        <FormField
          label="External reference"
          name="externalReference"
          maxLength={256}
          defaultValue={candidate?.externalReference ?? ''}
        />
      </div>
      <SubmitButton loading={loading}>
        {candidate ? 'Save candidate' : 'Create candidate'}
      </SubmitButton>
    </form>
  );
}

function optional(value: FormDataEntryValue | null): string | null {
  const text = String(value ?? '').trim();
  return text.length > 0 ? text : null;
}
