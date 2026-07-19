'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { StatusMessage } from '../feedback/status-message';
import { FormField, SubmitButton } from '../ui/form-field';
import { useAuth } from '../../providers/auth-provider';
import {
  normalizeEmailInput,
  validateEmailInput,
  validatePasswordConfirmation,
  validatePasswordInput,
} from '../../lib/validation/forms';

export function RegisterForm() {
  const router = useRouter();
  const { register } = useAuth();
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const data = new FormData(event.currentTarget);
    const email = normalizeEmailInput(String(data.get('email') ?? ''));
    const password = String(data.get('password') ?? '');
    const confirmPassword = String(data.get('confirmPassword') ?? '');
    const validationError =
      validateEmailInput(email) ??
      validatePasswordInput(password) ??
      validatePasswordConfirmation(password, confirmPassword);

    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      await register({
        email,
        password,
        displayName: String(data.get('displayName') ?? ''),
      });
      router.push('/verify-email?status=pending');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Registration failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="grid gap-4" onSubmit={onSubmit}>
      {error ? <StatusMessage tone="danger">{error}</StatusMessage> : null}
      <FormField label="Name" name="displayName" autoComplete="name" required maxLength={120} />
      <FormField label="Email" name="email" type="email" autoComplete="email" required />
      <FormField
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={12}
        maxLength={128}
      />
      <FormField
        label="Confirm password"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        required
        minLength={12}
        maxLength={128}
      />
      <SubmitButton loading={loading}>Create account</SubmitButton>
      <Link
        href="/login"
        className="text-sm font-medium text-slate-950 underline-offset-4 hover:underline"
      >
        Already have an account?
      </Link>
    </form>
  );
}
