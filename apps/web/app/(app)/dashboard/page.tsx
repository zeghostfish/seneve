'use client';

import Link from 'next/link';

import { CreateOrganizationForm } from '../../../components/organizations/create-organization-form';
import { useOrganizations } from '../../../providers/organization-provider';

export default function DashboardPage() {
  const { organizations, currentOrganization, status, error } = useOrganizations();

  if (status === 'loading') {
    return <p className="text-slate-600">Loading workspace...</p>;
  }

  if (status === 'error') {
    return <p className="text-red-700">{error}</p>;
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-md border border-slate-200 bg-white p-5">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-2 text-slate-600">
          Manage your Seneve account, organizations, members and invitations.
        </p>
      </section>

      {organizations.length === 0 ? (
        <CreateOrganizationForm />
      ) : (
        <section className="rounded-md border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold">Current organization</h2>
          <p className="mt-2 text-slate-700">{currentOrganization?.displayName}</p>
          <Link
            href="/organizations"
            className="mt-4 inline-flex rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50"
          >
            View organizations
          </Link>
        </section>
      )}
    </div>
  );
}
