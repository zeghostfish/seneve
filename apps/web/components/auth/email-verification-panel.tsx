'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { authApi } from '../../lib/api/auth-api';
import { useAuth } from '../../providers/auth-provider';
import { StatusMessage } from '../feedback/status-message';

type VerificationState = 'pending' | 'processing' | 'completed' | 'invalid' | 'expired' | 'resent';

export function EmailVerificationPanel() {
  const router = useRouter();
  const params = useSearchParams();
  const { accessToken } = useAuth();
  const [state, setState] = React.useState<VerificationState>(
    params.get('status') === 'pending' ? 'pending' : 'processing',
  );
  const [message, setMessage] = React.useState('Checking verification token.');

  React.useEffect(() => {
    const token = params.get('token');

    if (!token) {
      setState('pending');
      setMessage('Check your inbox for the verification link.');
      return;
    }

    void authApi
      .completeEmailVerification({ token })
      .then(() => {
        setState('completed');
        setMessage('Email verified. You can continue to Seneve.');
        router.replace('/verify-email?status=completed');
      })
      .catch((caught) => {
        const text = caught instanceof Error ? caught.message : 'Verification failed.';
        setState(text.toLowerCase().includes('expired') ? 'expired' : 'invalid');
        setMessage(text);
        router.replace('/verify-email?status=invalid');
      });
  }, [params, router]);

  async function resend() {
    if (!accessToken) {
      setMessage('Log in again to request a new verification email.');
      setState('invalid');
      return;
    }

    try {
      await authApi.resendEmailVerification(accessToken);
      setState('resent');
      setMessage('A new verification email has been requested.');
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Verification resend failed.');
    }
  }

  const tone =
    state === 'completed' || state === 'resent'
      ? 'success'
      : state === 'pending'
        ? 'neutral'
        : 'warning';

  return (
    <div className="grid gap-4">
      <StatusMessage tone={tone}>{message}</StatusMessage>
      <button
        type="button"
        onClick={resend}
        className="h-11 rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-950 transition hover:bg-slate-50"
      >
        Resend verification email
      </button>
    </div>
  );
}
