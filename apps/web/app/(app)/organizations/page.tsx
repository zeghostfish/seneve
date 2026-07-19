'use client';

import Link from 'next/link';

import { CreateOrganizationForm } from '../../../components/organizations/create-organization-form';
import { useOrganizations } from '../../../providers/organization-provider';

export default function OrganizationsPage() {
  const { organizations, selectOrganization, status, error } = useOrganizations();

  return (
    <div className="grid gap-6">
      <section className="rounded-md border border-slate-200 bg-white p-5">
        <h1 className="text-2xl font-semibold">Organizations</h1>
        <p className="mt-2 text-slate-600">Select an organization or create a new one.</p>
      </section>

      {status === 'error' ? <p className="text-red-700">{error}</p> : null}

      <div className="grid gap-3">
        {organizations.map((organization) => (
          <article
            key={organization.id}
            className="rounded-md border border-slate-200 bg-white p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">{organization.displayName}</h2>
                <p className="text-sm text-slate-600">
                  {organization.slug} - {organization.status}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => selectOrganization(organization.id)}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50"
                >
                  Select
                </button>
                <Link
                  href={`/organizations/${organization.id}`}
                  className="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white"
                >
                  Open
                </Link>
              </div>
            </div>
          </article>
        ))}
      </div>

      <CreateOrganizationForm />
    </div>
  );
}
