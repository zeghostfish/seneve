'use client';

import * as React from 'react';

import { CandidateForm } from '../../../../../../components/candidates/candidate-form';
import { CandidateLifecycleActions } from '../../../../../../components/candidates/candidate-lifecycle-actions';
import { CandidateStatusBadge } from '../../../../../../components/campaigns/campaign-badge';
import { StatusMessage } from '../../../../../../components/feedback/status-message';
import { candidateApi } from '../../../../../../lib/api/candidate-api';
import type { CandidateSummary } from '../../../../../../lib/api/types';
import { useAuth } from '../../../../../../providers/auth-provider';
import { useOrganizations } from '../../../../../../providers/organization-provider';

export default function CandidateDetailPage({
  params,
}: Readonly<{ params: Promise<{ campaignId: string; candidateId: string }> }>) {
  const { campaignId, candidateId } = React.use(params);
  const { accessToken } = useAuth();
  const { currentOrganization } = useOrganizations();
  const [candidate, setCandidate] = React.useState<CandidateSummary | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    if (!accessToken || !currentOrganization) {
      return;
    }

    try {
      const response = await candidateApi.get(
        accessToken,
        currentOrganization.id,
        campaignId,
        candidateId,
      );
      setCandidate(response.candidate);
      setMessage(null);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Could not load candidate.');
    }
  }, [accessToken, campaignId, candidateId, currentOrganization]);

  React.useEffect(() => {
    void load();
  }, [load]);

  if (message) {
    return <StatusMessage tone="warning">{message}</StatusMessage>;
  }

  if (!candidate) {
    return <p className="text-slate-600">Loading candidate...</p>;
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-md border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">{candidate.displayName}</h1>
          <CandidateStatusBadge status={candidate.status} />
        </div>
        <p className="mt-2 text-slate-600">
          {candidate.shortDescription || 'No short description.'}
        </p>
      </section>
      <CandidateForm campaignId={campaignId} candidate={candidate} />
      <CandidateLifecycleActions campaignId={campaignId} candidate={candidate} onChanged={load} />
    </div>
  );
}
