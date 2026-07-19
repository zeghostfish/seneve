'use client';

import * as React from 'react';
import Link from 'next/link';

import { CampaignStatusBadge } from '../../../components/campaigns/campaign-badge';
import { StatusMessage } from '../../../components/feedback/status-message';
import { campaignApi } from '../../../lib/api/campaign-api';
import type { CampaignStatus, CampaignSummary, CampaignVisibility } from '../../../lib/api/types';
import { formatDateTime } from '../../../lib/campaigns/status';
import { useAuth } from '../../../providers/auth-provider';
import { useOrganizations } from '../../../providers/organization-provider';

export default function CampaignsPage() {
  const { accessToken } = useAuth();
  const { currentOrganization } = useOrganizations();
  const [campaigns, setCampaigns] = React.useState<readonly CampaignSummary[]>([]);
  const [nextCursor, setNextCursor] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<CampaignStatus | undefined>();
  const [visibility, setVisibility] = React.useState<CampaignVisibility | undefined>();
  const [search, setSearch] = React.useState('');
  const [message, setMessage] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(
    async (cursor?: string | null) => {
      if (!accessToken || !currentOrganization) {
        return;
      }

      setLoading(true);
      setMessage(null);

      try {
        const response = await campaignApi.list(accessToken, currentOrganization.id, {
          status,
          visibility,
          search,
          cursor,
          limit: 20,
        });
        setCampaigns((current) =>
          cursor ? [...current, ...response.campaigns] : response.campaigns,
        );
        setNextCursor(response.nextCursor);
      } catch (caught) {
        setMessage(caught instanceof Error ? caught.message : 'Could not load campaigns.');
      } finally {
        setLoading(false);
      }
    },
    [accessToken, currentOrganization, search, status, visibility],
  );

  React.useEffect(() => {
    void load(null);
  }, [load]);

  if (!currentOrganization) {
    return (
      <StatusMessage tone="warning">
        Select or create an organization before managing campaigns.
      </StatusMessage>
    );
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-md border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Campaigns</h1>
            <p className="mt-2 text-slate-600">
              Manage private campaign configuration for {currentOrganization.displayName}.
            </p>
          </div>
          <Link
            href="/campaigns/new"
            className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
          >
            New campaign
          </Link>
        </div>
      </section>
      <section className="grid gap-3 rounded-md border border-slate-200 bg-white p-5">
        <div className="grid gap-3 md:grid-cols-4">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search campaigns"
            className="h-10 rounded-md border border-slate-300 px-3"
          />
          <select
            value={status ?? ''}
            onChange={(event) =>
              setStatus((event.target.value || undefined) as CampaignStatus | undefined)
            }
            className="h-10 rounded-md border border-slate-300 px-3"
          >
            <option value="">All statuses</option>
            {['DRAFT', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED', 'ARCHIVED'].map(
              (item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ),
            )}
          </select>
          <select
            value={visibility ?? ''}
            onChange={(event) =>
              setVisibility((event.target.value || undefined) as CampaignVisibility | undefined)
            }
            className="h-10 rounded-md border border-slate-300 px-3"
          >
            <option value="">All visibility</option>
            {['PRIVATE', 'UNLISTED', 'PUBLIC'].map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void load(null)}
            className="rounded-md border border-slate-300 px-3 text-sm font-semibold hover:bg-slate-50"
          >
            Apply filters
          </button>
        </div>
      </section>
      {message ? <StatusMessage tone="warning">{message}</StatusMessage> : null}
      <section className="grid gap-3">
        {loading && campaigns.length === 0 ? (
          <p className="text-slate-600">Loading campaigns...</p>
        ) : null}
        {!loading && campaigns.length === 0 ? (
          <StatusMessage>No campaigns match the current filters.</StatusMessage>
        ) : null}
        {campaigns.map((campaign) => (
          <Link
            key={campaign.id}
            href={`/campaigns/${campaign.id}`}
            className="rounded-md border border-slate-200 bg-white p-4 hover:border-slate-400"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold">{campaign.name}</h2>
                  <CampaignStatusBadge status={campaign.status} />
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  {campaign.slug} - {campaign.visibility}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {formatDateTime(campaign.startsAt, campaign.timezone)} to{' '}
                  {formatDateTime(campaign.endsAt, campaign.timezone)}
                </p>
              </div>
              <span className="text-sm text-slate-500">
                Created {formatDateTime(campaign.createdAt, campaign.timezone)}
              </span>
            </div>
          </Link>
        ))}
        {nextCursor ? (
          <button
            type="button"
            onClick={() => void load(nextCursor)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold"
          >
            Load more
          </button>
        ) : null}
      </section>
    </div>
  );
}
