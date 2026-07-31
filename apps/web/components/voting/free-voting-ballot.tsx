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
  const [candidateIds, setCandidateIds] = React.useState<readonly string[]>([]);
  const [message, setMessage] = React.useState<string | null>(null);
  const [confirmedCount, setConfirmedCount] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const requestIds = React.useRef(new Map<string, string>());

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
    if (!accessToken || candidateIds.length === 0) {
      setMessage('Select at least one candidate before confirming your ballot.');
      return;
    }

    setLoading(true);
    setMessage(null);
    const selections = candidateIds.map((candidateId) => {
      const requestId = requestIds.current.get(candidateId) ?? crypto.randomUUID();
      requestIds.current.set(candidateId, requestId);
      return { candidateId, requestId };
    });

    try {
      if (ballot?.campaign.allowMultipleCandidates) {
        await votingApi.submitFreeBallot(accessToken, organizationId, campaignId, selections);
      } else {
        const selection = selections[0];
        if (!selection) {
          return;
        }
        await votingApi.submitFreeVote(
          accessToken,
          organizationId,
          campaignId,
          selection.candidateId,
          selection.requestId,
        );
      }
      requestIds.current.clear();
      setCandidateIds([]);
      setConfirmedCount(selections.length);
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-[#b20000]">Official ballot</p>
          <Link
            href={`/vote/${organizationId}/history`}
            className="text-sm font-semibold text-slate-700 underline underline-offset-4"
          >
            My voting receipts
          </Link>
        </div>
        <h1 className="mt-2 text-3xl font-semibold text-slate-950">{ballot.campaign.name}</h1>
        {ballot.campaign.description ? (
          <p className="mt-3 max-w-3xl text-slate-600">{ballot.campaign.description}</p>
        ) : null}
        <p className="mt-3 text-sm text-slate-500">
          {ballot.remainingVotes} of {ballot.campaign.votesPerVoter} votes remaining
        </p>
      </header>

      {confirmedCount > 0 ? (
        <StatusMessage tone="success">
          {confirmedCount === 1
            ? 'Your vote was confirmed and recorded.'
            : `${confirmedCount} votes were confirmed and recorded atomically.`}
        </StatusMessage>
      ) : null}
      {message ? <StatusMessage tone="warning">{message}</StatusMessage> : null}

      <fieldset className="grid gap-3">
        <legend className="mb-2 text-lg font-semibold text-slate-950">
          {ballot.campaign.allowMultipleCandidates
            ? `Choose up to ${ballot.remainingVotes} candidates`
            : 'Choose a candidate'}
        </legend>
        {ballot.candidates.length === 0 ? (
          <StatusMessage>No eligible candidates are available.</StatusMessage>
        ) : null}
        {ballot.candidates.map((candidate) => (
          <label
            key={candidate.id}
            className={`grid cursor-pointer grid-cols-[auto_1fr] gap-3 rounded-md border p-4 transition ${
              candidateIds.includes(candidate.id)
                ? 'border-[#b20000] bg-red-50'
                : 'border-slate-200 bg-white hover:border-slate-400'
            }`}
          >
            <input
              type={ballot.campaign.allowMultipleCandidates ? 'checkbox' : 'radio'}
              name="candidate"
              value={candidate.id}
              checked={candidateIds.includes(candidate.id)}
              disabled={
                ballot.campaign.allowMultipleCandidates &&
                !candidateIds.includes(candidate.id) &&
                candidateIds.length >= ballot.remainingVotes
              }
              onChange={() => {
                setCandidateIds((current) =>
                  ballot.campaign.allowMultipleCandidates
                    ? current.includes(candidate.id)
                      ? current.filter((id) => id !== candidate.id)
                      : [...current, candidate.id]
                    : [candidate.id],
                );
                setConfirmedCount(0);
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
        disabled={loading || candidateIds.length === 0 || ballot.remainingVotes === 0}
        className="h-11 w-full rounded-md bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        {loading
          ? 'Confirming...'
          : ballot.campaign.allowMultipleCandidates
            ? 'Confirm ballot'
            : 'Confirm vote'}
      </button>
    </form>
  );
}
