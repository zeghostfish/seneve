'use client';

import * as React from 'react';

import { campaignApi } from '../../lib/api/campaign-api';
import type { CampaignSummary } from '../../lib/api/types';
import { useAuth } from '../../providers/auth-provider';
import { useOrganizations } from '../../providers/organization-provider';
import { StatusMessage } from '../feedback/status-message';

const actions = [
  { action: 'activate', label: 'Activate', confirm: false },
  { action: 'pause', label: 'Pause', confirm: false },
  { action: 'complete', label: 'Complete', confirm: true },
  { action: 'cancel', label: 'Cancel', confirm: true },
  { action: 'archive', label: 'Archive', confirm: true },
] as const;

export function CampaignLifecycleActions({
  campaign,
  onChanged,
}: Readonly<{ campaign: CampaignSummary; onChanged: () => Promise<void> }>) {
  const { accessToken } = useAuth();
  const { currentOrganization } = useOrganizations();
  const [message, setMessage] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState<string | null>(null);

  async function run(action: (typeof actions)[number]['action'], confirmRequired: boolean) {
    if (!accessToken || !currentOrganization) {
      setMessage('Session expired. Log in again.');
      return;
    }

    if (
      confirmRequired &&
      !window.confirm(`Confirm ${action}. This lifecycle action may restrict future edits.`)
    ) {
      return;
    }

    setLoading(action);
    setMessage(null);

    try {
      await campaignApi.transition(accessToken, currentOrganization.id, campaign.id, action, {
        expectedVersion: campaign.version,
      });
      await onChanged();
      setMessage(`Campaign ${action} completed.`);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Campaign action failed.');
      await onChanged();
    } finally {
      setLoading(null);
    }
  }

  return (
    <section className="grid gap-3 rounded-md border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-semibold">Lifecycle actions</h2>
      {message ? <StatusMessage tone="warning">{message}</StatusMessage> : null}
      <div className="flex flex-wrap gap-2">
        {actions.map((item) => (
          <button
            key={item.action}
            type="button"
            disabled={loading !== null}
            onClick={() => void run(item.action, item.confirm)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60"
          >
            {loading === item.action ? 'Working...' : item.label}
          </button>
        ))}
      </div>
    </section>
  );
}
