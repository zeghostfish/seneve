import * as React from 'react';
import Link from 'next/link';

import { SeneveLogo } from '../components/seneve-logo';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <SeneveLogo variant="transparent" size="md" priority />
          <nav className="flex items-center gap-3 text-sm font-medium">
            <Link href="/login" className="text-slate-700 hover:text-slate-950">
              Log in
            </Link>
            <Link
              href="/register"
              className="rounded-md bg-slate-950 px-3 py-2 text-white hover:bg-slate-800"
            >
              Register
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-12">
        <SeneveLogo variant="mark" size="sm" alt="" className="mb-2" />
        <h1 className="text-3xl font-semibold">Secure and configurable online voting platform.</h1>
        <p className="max-w-2xl text-base leading-7 text-slate-700">
          Register, verify your email, create an organization and manage member access through the
          first authenticated Seneve web shell.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/register"
            className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Create account
          </Link>
          <Link
            href="/login"
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-white"
          >
            Log in
          </Link>
        </div>
      </section>
    </main>
  );
}
