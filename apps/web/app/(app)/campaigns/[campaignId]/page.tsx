'use client';

import * as React from 'react';
import Link from 'next/link';

import { CampaignLifecycleActions } from '../../../../components/campaigns/campaign-lifecycle-actions';
import { CampaignStatusBadge } from '../../../../components/campaigns/campaign-badge';
import { StatusMessage } from '../../../../components/feedback/status-message';
import { Can } from '../../../../components/navigation/can';
import { campaignApi } from '../../../../lib/api/campaign-api';
import { candidateApi } from '../../../../lib/api/candidate-api';
import type { CampaignSummary, CandidateSummary } from '../../../../lib/api/types';
import { formatDateTime } from '../../../../lib/campaigns/status';
import { useAuth } from '../../../../providers/auth-provider';
import { useOrganizations } from '../../../../providers/organization-provider';

export default function CampaignDetailPage({
  params,
}: Readonly<{ params: Promise<{ campaignId: string }> }>) {
  const { campaignId } = React.use(params);
  const { accessToken } = useAuth();
  const { currentOrganization } = useOrganizations();
  const [campaign, setCampaign] = React.useState<CampaignSummary | null>(null);
  const [candidates, setCandidates] = React.useState<readonly CandidateSummary[]>([]);
  const [message, setMessage] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    if (!accessToken || !currentOrganization) {
      return;
    }

    try {
      const [campaignResponse, candidateResponse] = await Promise.all([
        campaignApi.get(accessToken, currentOrganization.id, campaignId),
        candidateApi.list(accessToken, currentOrganization.id, campaignId, { limit: 500 }),
      ]);
      setCampaign(campaignResponse.campaign);
      setCandidates(candidateResponse.candidates);
      setMessage(null);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Could not load campaign.');
    }
  }, [accessToken, campaignId, currentOrganization]);

  React.useEffect(() => {
    void load();
  }, [load]);

  if (!currentOrganization) {
    return (
      <StatusMessage tone="warning">
        Select an organization before opening a campaign.
      </StatusMessage>
    );
  }

  if (message) {
    return <StatusMessage tone="warning">{message}</StatusMessage>;
  }

  if (!campaign) {
    return <p className="text-slate-600">Loading campaign...</p>;
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-md border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold">{campaign.name}</h1>
              <CampaignStatusBadge status={campaign.status} />
            </div>
            <p className="mt-2 text-slate-600">
              {campaign.description || 'No description provided.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Can permission="voting:results:read">
              <Link
                href={`/campaigns/${campaign.id}/results`}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50"
              >
                Private results
              </Link>
            </Can>
            {campaign.status === 'ACTIVE' && campaign.visibility !== 'PRIVATE' ? (
              <Link
                href={`/vote/${currentOrganization.id}/${campaign.id}`}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50"
              >
                Open ballot
              </Link>
            ) : null}
            <Link
              href={`/campaigns/${campaign.id}/settings`}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50"
            >
              Settings
            </Link>
            <Link
              href={`/campaigns/${campaign.id}/candidates`}
              className="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white"
            >
              Candidates
            </Link>
          </div>
        </div>
      </section>
      <section className="grid gap-4 rounded-md border border-slate-200 bg-white p-5 md:grid-cols-2">
        <Info label="Slug" value={campaign.slug} />
        <Info label="Visibility" value={campaign.visibility} />
        <Info
          label="Schedule"
          value={`${formatDateTime(campaign.startsAt, campaign.timezone)} to ${formatDateTime(campaign.endsAt, campaign.timezone)}`}
        />
        <Info label="Timezone" value={campaign.timezone} />
        <Info label="Voting mode" value={campaign.rules.votingMode} />
        <Info label="Votes per voter" value={String(campaign.rules.votesPerVoter)} />
        <Info label="Results" value={campaign.rules.results.visibility} />
        <Info label="Candidates" value={String(candidates.length)} />
      </section>
      <CampaignLifecycleActions campaign={campaign} onChanged={load} />
      <section className="rounded-md border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Candidate summary</h2>
            <p className="text-sm text-slate-600">Candidates are managed inside this campaign.</p>
          </div>
          <Link
            href={`/campaigns/${campaign.id}/candidates/new`}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50"
          >
            Add candidate
          </Link>
        </div>
      </section>
    </div>
  );
}

function Info({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div>
      <dt className="text-sm font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm text-slate-950">{value}</dd>
    </div>
  );
}
