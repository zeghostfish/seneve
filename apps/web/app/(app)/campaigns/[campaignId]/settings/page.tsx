'use client';

import * as React from 'react';

import { CampaignForm } from '../../../../../components/campaigns/campaign-form';
import { CampaignRulesForm } from '../../../../../components/campaigns/campaign-rules-form';
import { StatusMessage } from '../../../../../components/feedback/status-message';
import { campaignApi } from '../../../../../lib/api/campaign-api';
import type { CampaignSummary } from '../../../../../lib/api/types';
import { useAuth } from '../../../../../providers/auth-provider';
import { useOrganizations } from '../../../../../providers/organization-provider';

export default function CampaignSettingsPage({
  params,
}: Readonly<{ params: Promise<{ campaignId: string }> }>) {
  const { campaignId } = React.use(params);
  const { accessToken } = useAuth();
  const { currentOrganization } = useOrganizations();
  const [campaign, setCampaign] = React.useState<CampaignSummary | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    if (!accessToken || !currentOrganization) {
      return;
    }

    try {
      const response = await campaignApi.get(accessToken, currentOrganization.id, campaignId);
      setCampaign(response.campaign);
      setMessage(null);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Could not load campaign settings.');
    }
  }, [accessToken, campaignId, currentOrganization]);

  React.useEffect(() => {
    void load();
  }, [load]);

  if (message) {
    return <StatusMessage tone="warning">{message}</StatusMessage>;
  }

  if (!campaign) {
    return <p className="text-slate-600">Loading settings...</p>;
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-md border border-slate-200 bg-white p-5">
        <h1 className="text-2xl font-semibold">Campaign settings</h1>
        <p className="mt-2 text-slate-600">
          Edit mutable campaign details and Phase 16 rule configuration.
        </p>
      </section>
      <CampaignForm mode="edit" campaign={campaign} />
      <CampaignRulesForm campaign={campaign} onChanged={load} />
    </div>
  );
}
