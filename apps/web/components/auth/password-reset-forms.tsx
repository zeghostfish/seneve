'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

import { authApi } from '../../lib/api/auth-api';
import {
  normalizeEmailInput,
  validateEmailInput,
  validatePasswordConfirmation,
  validatePasswordInput,
} from '../../lib/validation/forms';
import { StatusMessage } from '../feedback/status-message';
import { FormField, SubmitButton } from '../ui/form-field';

export function PasswordResetRequestForm() {
  const [message, setMessage] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = normalizeEmailInput(String(data.get('email') ?? ''));
    const emailError = validateEmailInput(email);

    if (emailError) {
      setMessage(emailError);
      return;
    }

    setLoading(true);

    try {
      await authApi.requestPasswordReset({ email });
      setMessage('If an eligible account exists, recovery instructions will be sent.');
    } catch {
      setMessage('If an eligible account exists, recovery instructions will be sent.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="grid gap-4" onSubmit={onSubmit}>
      {message ? <StatusMessage tone="success">{message}</StatusMessage> : null}
      <FormField label="Email" name="email" type="email" autoComplete="email" required />
      <SubmitButton loading={loading}>Request reset link</SubmitButton>
      <Link
        href="/login"
        className="text-sm font-medium text-slate-950 underline-offset-4 hover:underline"
      >
        Back to login
      </Link>
    </form>
  );
}

export function PasswordResetCompletionForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const token = params.get('token');
    const data = new FormData(event.currentTarget);
    const password = String(data.get('password') ?? '');
    const confirmPassword = String(data.get('confirmPassword') ?? '');

    if (!token) {
      setError('Reset token is missing.');
      return;
    }

    const validationError =
      validatePasswordInput(password) ?? validatePasswordConfirmation(password, confirmPassword);

    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      await authApi.completePasswordReset({ token, password });
      setDone(true);
      router.replace('/reset-password?status=completed');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Password reset failed.');
      router.replace('/reset-password?status=invalid');
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="grid gap-4">
        <StatusMessage tone="success">
          Password reset complete. Log in with your new password.
        </StatusMessage>
        <Link
          href="/login"
          className="text-sm font-semibold text-slate-950 underline-offset-4 hover:underline"
        >
          Go to login
        </Link>
      </div>
    );
  }

  return (
    <form className="grid gap-4" onSubmit={onSubmit}>
      {error ? <StatusMessage tone="danger">{error}</StatusMessage> : null}
      <FormField
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={12}
        maxLength={128}
      />
      <FormField
        label="Confirm new password"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        required
        minLength={12}
        maxLength={128}
      />
      <SubmitButton loading={loading}>Reset password</SubmitButton>
    </form>
  );
}
