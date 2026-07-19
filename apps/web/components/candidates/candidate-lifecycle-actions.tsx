'use client';

import * as React from 'react';

import { candidateApi } from '../../lib/api/candidate-api';
import type { CandidateSummary } from '../../lib/api/types';
import { useAuth } from '../../providers/auth-provider';
import { useOrganizations } from '../../providers/organization-provider';
import { StatusMessage } from '../feedback/status-message';

const actions = [
  { action: 'eligible', label: 'Mark eligible', reason: false, confirm: false },
  { action: 'suspend', label: 'Suspend', reason: true, confirm: false },
  { action: 'reactivate', label: 'Reactivate', reason: false, confirm: false },
  { action: 'withdraw', label: 'Withdraw', reason: true, confirm: true },
  { action: 'disqualify', label: 'Disqualify', reason: true, confirm: true },
  { action: 'archive', label: 'Archive', reason: false, confirm: true },
] as const;

export function CandidateLifecycleActions({
  campaignId,
  candidate,
  onChanged,
}: Readonly<{ campaignId: string; candidate: CandidateSummary; onChanged: () => Promise<void> }>) {
  const { accessToken } = useAuth();
  const { currentOrganization } = useOrganizations();
  const [message, setMessage] = React.useState<string | null>(null);
  const [reason, setReason] = React.useState('');
  const [loading, setLoading] = React.useState<string | null>(null);

  async function run(item: (typeof actions)[number]) {
    if (!accessToken || !currentOrganization) {
      setMessage('Session expired. Log in again.');
      return;
    }

    if (item.reason && reason.trim().length === 0) {
      setMessage('Enter a reason for this action.');
      return;
    }

    if (item.confirm && !window.confirm(`Confirm ${item.label.toLowerCase()}.`)) {
      return;
    }

    setLoading(item.action);
    setMessage(null);

    try {
      await candidateApi.transition(
        accessToken,
        currentOrganization.id,
        campaignId,
        candidate.id,
        item.action,
        item.reason
          ? { expectedVersion: candidate.version, reason: reason.trim() }
          : { expectedVersion: candidate.version },
      );
      setReason('');
      await onChanged();
      setMessage(`${item.label} completed.`);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Candidate action failed.');
      await onChanged();
    } finally {
      setLoading(null);
    }
  }

  return (
    <section className="grid gap-3 rounded-md border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-semibold">Candidate status</h2>
      {message ? <StatusMessage tone="warning">{message}</StatusMessage> : null}
      <label className="grid gap-2 text-sm font-medium text-slate-800">
        Reason for suspension, withdrawal or disqualification
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={500}
          className="min-h-20 rounded-md border border-slate-300 px-3 py-2"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        {actions.map((item) => (
          <button
            key={item.action}
            type="button"
            disabled={loading !== null}
            onClick={() => void run(item)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60"
          >
            {loading === item.action ? 'Working...' : item.label}
          </button>
        ))}
      </div>
    </section>
  );
}
