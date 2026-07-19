'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import { SeneveLogo } from '../seneve-logo';
import { useAuth } from '../../providers/auth-provider';
import { useOrganizations } from '../../providers/organization-provider';
import { OrganizationSwitcher } from './organization-switcher';

const navigation = [
  { href: '/dashboard', label: 'Dashboard', requiresOrganization: false },
  { href: '/campaigns', label: 'Campaigns', requiresOrganization: true },
  { href: '/organizations', label: 'Organizations', requiresOrganization: false },
  { href: '/sessions', label: 'Sessions', requiresOrganization: false },
] as const;

export function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const router = useRouter();
  const pathname = usePathname();
  const auth = useAuth();
  const { currentOrganization } = useOrganizations();

  React.useEffect(() => {
    if (auth.status === 'unauthenticated' || auth.status === 'expired') {
      router.replace('/login');
    }
  }, [auth.status, router]);

  if (auth.status === 'loading' || auth.status === 'refreshing') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <SeneveLogo variant="mark" size="lg" alt="" priority />
      </main>
    );
  }

  if (!auth.isAuthenticated) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-700">
        Redirecting to login...
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <Link href="/dashboard" className="flex items-center gap-3">
            <SeneveLogo variant="mark" size="sm" alt="" />
            <span className="text-lg font-semibold">Seneve</span>
          </Link>
          <OrganizationSwitcher />
          <button
            type="button"
            onClick={() => void auth.logout()}
            className="h-10 rounded-md border border-slate-300 px-3 text-sm font-semibold hover:bg-slate-50"
          >
            Log out
          </button>
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl gap-6 px-6 py-6 md:grid-cols-[220px_1fr]">
        <nav className="flex gap-2 overflow-x-auto md:flex-col md:overflow-visible">
          {navigation.map((item) => {
            if (item.requiresOrganization && !currentOrganization) {
              return null;
            }

            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-md px-3 py-2 text-sm font-medium ${
                  active ? 'bg-slate-950 text-white' : 'text-slate-700 hover:bg-white'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <main>{children}</main>
      </div>
    </div>
  );
}
