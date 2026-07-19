'use client';

import * as React from 'react';
import Link from 'next/link';

import { CandidateReorderList } from '../../../../../components/candidates/candidate-reorder-list';
import { CandidateStatusBadge } from '../../../../../components/campaigns/campaign-badge';
import { StatusMessage } from '../../../../../components/feedback/status-message';
import { candidateApi } from '../../../../../lib/api/candidate-api';
import type { CandidateStatus, CandidateSummary } from '../../../../../lib/api/types';
import { useAuth } from '../../../../../providers/auth-provider';
import { useOrganizations } from '../../../../../providers/organization-provider';

export default function CandidatesPage({
  params,
}: Readonly<{ params: Promise<{ campaignId: string }> }>) {
  const { campaignId } = React.use(params);
  const { accessToken } = useAuth();
  const { currentOrganization } = useOrganizations();
  const [candidates, setCandidates] = React.useState<readonly CandidateSummary[]>([]);
  const [status, setStatus] = React.useState<CandidateStatus | undefined>();
  const [search, setSearch] = React.useState('');
  const [message, setMessage] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!accessToken || !currentOrganization) {
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await candidateApi.list(accessToken, currentOrganization.id, campaignId, {
        status,
        search,
        limit: 500,
      });
      setCandidates(response.candidates);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Could not load candidates.');
    } finally {
      setLoading(false);
    }
  }, [accessToken, campaignId, currentOrganization, search, status]);

  React.useEffect(() => {
    void load();
  }, [load]);

  if (!currentOrganization) {
    return (
      <StatusMessage tone="warning">
        Select an organization before managing candidates.
      </StatusMessage>
    );
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-md border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Candidates</h1>
            <p className="mt-2 text-slate-600">Manage private candidate setup for this campaign.</p>
          </div>
          <Link
            href={`/campaigns/${campaignId}/candidates/new`}
            className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
          >
            New candidate
          </Link>
        </div>
      </section>
      <section className="grid gap-3 rounded-md border border-slate-200 bg-white p-5 md:grid-cols-3">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search candidates"
          className="h-10 rounded-md border border-slate-300 px-3"
        />
        <select
          value={status ?? ''}
          onChange={(event) =>
            setStatus((event.target.value || undefined) as CandidateStatus | undefined)
          }
          className="h-10 rounded-md border border-slate-300 px-3"
        >
          <option value="">All statuses</option>
          {['DRAFT', 'ELIGIBLE', 'SUSPENDED', 'WITHDRAWN', 'DISQUALIFIED', 'ARCHIVED'].map(
            (item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ),
          )}
        </select>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-md border border-slate-300 px-3 text-sm font-semibold hover:bg-slate-50"
        >
          Apply filters
        </button>
      </section>
      {message ? <StatusMessage tone="warning">{message}</StatusMessage> : null}
      {loading && candidates.length === 0 ? (
        <p className="text-slate-600">Loading candidates...</p>
      ) : null}
      {!loading && candidates.length === 0 ? (
        <StatusMessage>No candidates match the current filters.</StatusMessage>
      ) : null}
      <section className="grid gap-3">
        {candidates.map((candidate) => (
          <Link
            key={candidate.id}
            href={`/campaigns/${campaignId}/candidates/${candidate.id}`}
            className="rounded-md border border-slate-200 bg-white p-4 hover:border-slate-400"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold">
                    {candidate.position}. {candidate.displayName}
                  </h2>
                  <CandidateStatusBadge status={candidate.status} />
                </div>
                <p className="mt-1 text-sm text-slate-600">{candidate.slug}</p>
                <p className="mt-1 text-sm text-slate-600">
                  {candidate.shortDescription || 'No short description.'}
                </p>
              </div>
              <span className="text-sm text-slate-500">Position {candidate.position}</span>
            </div>
          </Link>
        ))}
      </section>
      <CandidateReorderList campaignId={campaignId} candidates={candidates} onChanged={load} />
    </div>
  );
}
