'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { StatusMessage } from '../feedback/status-message';
import { FormField, SubmitButton } from '../ui/form-field';
import { useAuth } from '../../providers/auth-provider';
import { normalizeEmailInput, validateEmailInput } from '../../lib/validation/forms';

export function LoginForm() {
  const router = useRouter();
  const { login } = useAuth();
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const data = new FormData(event.currentTarget);
    const email = normalizeEmailInput(String(data.get('email') ?? ''));
    const emailError = validateEmailInput(email);

    if (emailError) {
      setError(emailError);
      return;
    }

    setLoading(true);

    try {
      await login({
        email,
        password: String(data.get('password') ?? ''),
      });
      router.push('/dashboard');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Login failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="grid gap-4" onSubmit={onSubmit}>
      {error ? <StatusMessage tone="danger">{error}</StatusMessage> : null}
      <FormField label="Email" name="email" type="email" autoComplete="email" required />
      <FormField
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
      />
      <SubmitButton loading={loading}>Log in</SubmitButton>
      <div className="flex flex-wrap justify-between gap-3 text-sm text-slate-600">
        <Link
          href="/forgot-password"
          className="font-medium text-slate-950 underline-offset-4 hover:underline"
        >
          Forgot password?
        </Link>
        <Link
          href="/register"
          className="font-medium text-slate-950 underline-offset-4 hover:underline"
        >
          Create account
        </Link>
      </div>
    </form>
  );
}
