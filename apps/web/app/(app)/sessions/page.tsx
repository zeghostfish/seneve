'use client';

import * as React from 'react';

import { StatusMessage } from '../../../components/feedback/status-message';
import { sessionApi } from '../../../lib/api/session-api';
import type { SessionSummary } from '../../../lib/api/types';
import { useAuth } from '../../../providers/auth-provider';

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString() : 'Not available';
}

export default function SessionsPage() {
  const { accessToken, logoutAll } = useAuth();
  const [sessions, setSessions] = React.useState<readonly SessionSummary[]>([]);
  const [message, setMessage] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    if (!accessToken) {
      return;
    }

    const response = await sessionApi.list(accessToken);
    setSessions(response.sessions);
  }, [accessToken]);

  React.useEffect(() => {
    void load().catch((caught) =>
      setMessage(caught instanceof Error ? caught.message : 'Could not load sessions.'),
    );
  }, [load]);

  async function revoke(sessionId: string) {
    if (!accessToken) {
      return;
    }

    try {
      await sessionApi.revoke(accessToken, sessionId);
      await load();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Could not revoke session.');
    }
  }

  async function revokeOthers() {
    if (!accessToken) {
      return;
    }

    try {
      await sessionApi.revokeAllExceptCurrent(accessToken);
      await load();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Could not revoke other sessions.');
    }
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-md border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Sessions</h1>
            <p className="mt-2 text-slate-600">
              Review recognized devices and revoke sessions you no longer use.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void revokeOthers()}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50"
            >
              Revoke others
            </button>
            <button
              type="button"
              onClick={() => void logoutAll()}
              className="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Logout all
            </button>
          </div>
        </div>
      </section>
      {message ? <StatusMessage tone="warning">{message}</StatusMessage> : null}
      <div className="grid gap-3">
        {sessions.map((session) => (
          <article
            key={session.sessionId}
            className="rounded-md border border-slate-200 bg-white p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">
                  {session.deviceDisplayName ?? 'Recognized device'}
                  {session.current ? ' - current' : ''}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Created {formatDate(session.createdAt)}. Last activity{' '}
                  {formatDate(session.lastActivityAt)}.
                </p>
                <p className="text-sm text-slate-600">Expires {formatDate(session.expiresAt)}.</p>
              </div>
              <button
                type="button"
                onClick={() => void revoke(session.sessionId)}
                disabled={session.current}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Revoke
              </button>
            </div>
          </article>
        ))}
        {sessions.length === 0 ? <p className="text-slate-600">No active sessions found.</p> : null}
      </div>
    </div>
  );
}
