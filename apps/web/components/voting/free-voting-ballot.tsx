'use client';

import * as React from 'react';
import Link from 'next/link';

import { votingApi } from '../../lib/api/voting-api';
import type { VotingBallot } from '../../lib/api/types';
import { useAuth } from '../../providers/auth-provider';
import { StatusMessage } from '../feedback/status-message';

export function FreeVotingBallot({
  organizationId,
  campaignId,
}: Readonly<{ organizationId: string; campaignId: string }>) {
  const { accessToken, status } = useAuth();
  const [ballot, setBallot] = React.useState<VotingBallot | null>(null);
  const [candidateId, setCandidateId] = React.useState('');
  const [message, setMessage] = React.useState<string | null>(null);
  const [confirmed, setConfirmed] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const requestId = React.useRef<string | null>(null);

  const load = React.useCallback(async () => {
    if (!accessToken) {
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      const response = await votingApi.getBallot(accessToken, organizationId, campaignId);
      setBallot(response.ballot);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'The ballot could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [accessToken, campaignId, organizationId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken || !candidateId) {
      setMessage('Select a candidate before confirming your vote.');
      return;
    }

    setLoading(true);
    setMessage(null);
    requestId.current ??= crypto.randomUUID();

    try {
      await votingApi.submitFreeVote(
        accessToken,
        organizationId,
        campaignId,
        candidateId,
        requestId.current,
      );
      requestId.current = null;
      setCandidateId('');
      setConfirmed(true);
      await load();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'The vote could not be confirmed.');
    } finally {
      setLoading(false);
    }
  }

  if (status === 'loading' || status === 'refreshing' || (loading && !ballot)) {
    return <p className="text-slate-600">Loading ballot...</p>;
  }

  if (!accessToken) {
    return (
      <div className="grid gap-4">
        <StatusMessage tone="warning">
          Sign in with a verified account before opening this ballot.
        </StatusMessage>
        <Link
          href="/login"
          className="w-fit rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
        >
          Sign in
        </Link>
      </div>
    );
  }

  if (message && !ballot) {
    return <StatusMessage tone="warning">{message}</StatusMessage>;
  }

  if (!ballot) {
    return <StatusMessage>This ballot is not available.</StatusMessage>;
  }

  return (
    <form className="grid gap-6" onSubmit={submit}>
      <header className="border-b border-slate-200 pb-5">
        <p className="text-sm font-semibold text-[#b20000]">Official ballot</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-950">{ballot.campaign.name}</h1>
        {ballot.campaign.description ? (
          <p className="mt-3 max-w-3xl text-slate-600">{ballot.campaign.description}</p>
        ) : null}
        <p className="mt-3 text-sm text-slate-500">
          {ballot.remainingVotes} of {ballot.campaign.votesPerVoter} votes remaining
        </p>
      </header>

      {confirmed ? (
        <StatusMessage tone="success">Your vote was confirmed and recorded.</StatusMessage>
      ) : null}
      {message ? <StatusMessage tone="warning">{message}</StatusMessage> : null}

      <fieldset className="grid gap-3">
        <legend className="mb-2 text-lg font-semibold text-slate-950">Choose a candidate</legend>
        {ballot.candidates.length === 0 ? (
          <StatusMessage>No eligible candidates are available.</StatusMessage>
        ) : null}
        {ballot.candidates.map((candidate) => (
          <label
            key={candidate.id}
            className={`grid cursor-pointer grid-cols-[auto_1fr] gap-3 rounded-md border p-4 transition ${
              candidateId === candidate.id
                ? 'border-[#b20000] bg-red-50'
                : 'border-slate-200 bg-white hover:border-slate-400'
            }`}
          >
            <input
              type="radio"
              name="candidate"
              value={candidate.id}
              checked={candidateId === candidate.id}
              onChange={() => {
                setCandidateId(candidate.id);
                setConfirmed(false);
                requestId.current = null;
              }}
              className="mt-1 h-4 w-4 accent-[#b20000]"
            />
            <span>
              <span className="block font-semibold text-slate-950">{candidate.displayName}</span>
              {candidate.shortDescription ? (
                <span className="mt-1 block text-sm text-slate-600">
                  {candidate.shortDescription}
                </span>
              ) : null}
            </span>
          </label>
        ))}
      </fieldset>

      <button
        type="submit"
        disabled={loading || !candidateId || ballot.remainingVotes === 0}
        className="h-11 w-full rounded-md bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        {loading ? 'Confirming...' : 'Confirm vote'}
      </button>
    </form>
  );
}
