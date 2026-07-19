'use client';

import * as React from 'react';

import { candidateApi } from '../../lib/api/candidate-api';
import type { CandidateSummary } from '../../lib/api/types';
import { useAuth } from '../../providers/auth-provider';
import { useOrganizations } from '../../providers/organization-provider';
import { StatusMessage } from '../feedback/status-message';
import { CandidateStatusBadge } from '../campaigns/campaign-badge';

export function CandidateReorderList({
  campaignId,
  candidates,
  onChanged,
}: Readonly<{
  campaignId: string;
  candidates: readonly CandidateSummary[];
  onChanged: () => Promise<void>;
}>) {
  const { accessToken } = useAuth();
  const { currentOrganization } = useOrganizations();
  const [ordered, setOrdered] = React.useState<readonly CandidateSummary[]>(candidates);
  const [message, setMessage] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    setOrdered(candidates);
  }, [candidates]);

  function move(index: number, direction: -1 | 1) {
    const next = [...ordered];
    const target = index + direction;

    if (target < 0 || target >= next.length) {
      return;
    }

    const current = next[index];
    next[index] = next[target]!;
    next[target] = current!;
    setOrdered(next);
  }

  async function save() {
    if (!accessToken || !currentOrganization) {
      setMessage('Session expired. Log in again.');
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      await candidateApi.reorder(
        accessToken,
        currentOrganization.id,
        campaignId,
        ordered.map((candidate) => candidate.id),
      );
      await onChanged();
      setMessage('Candidate order saved.');
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Candidate reorder failed.');
      await onChanged();
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="grid gap-3 rounded-md border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Candidate order</h2>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || ordered.length === 0}
          className="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {saving ? 'Saving...' : 'Save order'}
        </button>
      </div>
      {message ? <StatusMessage tone="warning">{message}</StatusMessage> : null}
      <ol className="grid gap-2">
        {ordered.map((candidate, index) => (
          <li
            key={candidate.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 p-3"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold">
                  {index + 1}. {candidate.displayName}
                </span>
                <CandidateStatusBadge status={candidate.status} />
              </div>
              <p className="text-sm text-slate-600">{candidate.slug}</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => move(index, -1)}
                className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                aria-label={`Move ${candidate.displayName} up`}
              >
                Up
              </button>
              <button
                type="button"
                onClick={() => move(index, 1)}
                className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                aria-label={`Move ${candidate.displayName} down`}
              >
                Down
              </button>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
