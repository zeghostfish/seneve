'use client';

import * as React from 'react';
import Link from 'next/link';

import { CandidateStatusBadge } from '../../../../../components/campaigns/campaign-badge';
import { StatusMessage } from '../../../../../components/feedback/status-message';
import { votingApi } from '../../../../../lib/api/voting-api';
import type { PrivateVotingResults } from '../../../../../lib/api/types';
import { formatDateTime } from '../../../../../lib/campaigns/status';
import { useAuth } from '../../../../../providers/auth-provider';
import { useOrganizations } from '../../../../../providers/organization-provider';

export default function PrivateResultsPage({
  params,
}: Readonly<{ params: Promise<{ campaignId: string }> }>) {
  const { campaignId } = React.use(params);
  const { accessToken } = useAuth();
  const { currentOrganization } = useOrganizations();
  const [results, setResults] = React.useState<PrivateVotingResults | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    setResults(null);
    setMessage(null);
    if (!accessToken || !currentOrganization) {
      return;
    }

    let active = true;
    void votingApi
      .getPrivateResults(accessToken, currentOrganization.id, campaignId)
      .then((response) => {
        if (active) {
          setResults(response.results);
        }
      })
      .catch((caught) => {
        if (active) {
          setMessage(
            caught instanceof Error ? caught.message : 'Private results could not be loaded.',
          );
        }
      });

    return () => {
      active = false;
    };
  }, [accessToken, campaignId, currentOrganization]);

  if (!currentOrganization) {
    return <StatusMessage tone="warning">Select an organization to view results.</StatusMessage>;
  }

  if (message) {
    return <StatusMessage tone="warning">{message}</StatusMessage>;
  }

  if (!results) {
    return <p className="text-slate-600">Loading private results...</p>;
  }

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[#b20000]">Private results</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-950">{results.campaign.name}</h1>
          <p className="mt-2 text-sm text-slate-600">
            Aggregated from confirmed votes. No voter-level data is displayed.
          </p>
        </div>
        <Link
          href={`/campaigns/${campaignId}`}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50"
        >
          Campaign overview
        </Link>
      </header>

      <section className="grid gap-3 sm:grid-cols-2">
        <Metric label="Confirmed votes" value={results.totals.confirmedVotes} />
        <Metric label="Distinct voters" value={results.totals.distinctVoters} />
      </section>

      <section aria-labelledby="candidate-results-heading" className="grid gap-3">
        <div>
          <h2 id="candidate-results-heading" className="text-lg font-semibold text-slate-950">
            Candidate totals
          </h2>
          <p className="text-sm text-slate-600">
            Campaign order is preserved; no rank or winner is inferred.
          </p>
        </div>
        {results.candidates.length === 0 ? (
          <StatusMessage>No candidates are configured for this campaign.</StatusMessage>
        ) : null}
        {results.candidates.map((candidate) => (
          <article
            key={candidate.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 bg-white p-4"
          >
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-slate-500">{candidate.position}</span>
              <div>
                <h3 className="font-semibold text-slate-950">{candidate.displayName}</h3>
                <CandidateStatusBadge status={candidate.status} />
              </div>
            </div>
            <p className="text-right">
              <span className="block text-xl font-semibold text-slate-950">
                {candidate.confirmedVotes}
              </span>
              <span className="text-xs text-slate-500">confirmed votes</span>
            </p>
          </article>
        ))}
      </section>

      <p className="text-xs text-slate-500">
        Generated {formatDateTime(results.generatedAt, currentOrganization.timezone)} | Public
        visibility: {results.campaign.resultsVisibility}
      </p>
    </div>
  );
}

function Metric({ label, value }: Readonly<{ label: string; value: number }>) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-5">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}
