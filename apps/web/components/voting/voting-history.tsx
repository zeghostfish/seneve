'use client';

import Link from 'next/link';
import * as React from 'react';

import { votingApi } from '../../lib/api/voting-api';
import type { VotingHistoryReceipt } from '../../lib/api/types';
import { useAuth } from '../../providers/auth-provider';
import { StatusMessage } from '../feedback/status-message';

export function VotingHistory({
  organizationId,
}: Readonly<{
  organizationId: string;
}>) {
  const { accessToken, status } = useAuth();
  const [receipts, setReceipts] = React.useState<readonly VotingHistoryReceipt[]>([]);
  const [nextCursor, setNextCursor] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(
    async (cursor: string | null = null) => {
      if (!accessToken) {
        return;
      }

      setLoading(true);
      setMessage(null);
      try {
        const response = await votingApi.listOwnVotes(accessToken, organizationId, { cursor });
        setReceipts((current) => (cursor ? [...current, ...response.receipts] : response.receipts));
        setNextCursor(response.nextCursor);
      } catch (caught) {
        setMessage(
          caught instanceof Error ? caught.message : 'Your voting history could not load.',
        );
      } finally {
        setLoading(false);
      }
    },
    [accessToken, organizationId],
  );

  React.useEffect(() => {
    setReceipts([]);
    setNextCursor(null);
    void load();
  }, [load]);

  if (status === 'loading' || status === 'refreshing' || (loading && receipts.length === 0)) {
    return <p className="text-slate-600">Loading voting history...</p>;
  }

  if (!accessToken) {
    return (
      <div className="grid gap-4">
        <StatusMessage tone="warning">Sign in to review your confirmed votes.</StatusMessage>
        <Link
          href="/login"
          className="w-fit rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <section className="grid gap-6" aria-labelledby="voting-history-title">
      <header className="border-b border-slate-200 pb-5">
        <p className="text-sm font-semibold text-[#b20000]">Voting receipts</p>
        <h1 id="voting-history-title" className="mt-2 text-3xl font-semibold text-slate-950">
          My votes
        </h1>
        <p className="mt-3 max-w-2xl text-slate-600">
          Confirmed votes recorded for your account in this organization.
        </p>
      </header>

      {message ? <StatusMessage tone="warning">{message}</StatusMessage> : null}

      {receipts.length === 0 && !message ? (
        <StatusMessage>You do not have a confirmed vote in this organization yet.</StatusMessage>
      ) : (
        <ol className="grid gap-3">
          {receipts.map((receipt) => (
            <li key={receipt.id} className="rounded-md border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-950">{receipt.campaignName}</p>
                  <p className="mt-1 text-sm text-slate-600">
                    Candidate: {receipt.candidateDisplayName}
                  </p>
                </div>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                  Confirmed
                </span>
              </div>
              <dl className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                <div>
                  <dt className="font-medium text-slate-950">Confirmed at</dt>
                  <dd>{formatReceiptDate(receipt.confirmedAt)}</dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-950">Receipt ID</dt>
                  <dd className="break-all font-mono text-xs">{receipt.id}</dd>
                </div>
              </dl>
              <Link
                href={`/vote/${organizationId}/${receipt.campaignId}`}
                className="mt-4 inline-block text-sm font-semibold text-slate-950 underline underline-offset-4"
              >
                Return to ballot
              </Link>
            </li>
          ))}
        </ol>
      )}

      {nextCursor ? (
        <button
          type="button"
          disabled={loading}
          onClick={() => void load(nextCursor)}
          className="h-11 w-full rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-950 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          {loading ? 'Loading...' : 'Load more'}
        </button>
      ) : null}
    </section>
  );
}

export function formatReceiptDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
