'use client';

import * as React from 'react';
import Link from 'next/link';

import { organizationApi } from '../../../../lib/api/organization-api';
import type { OrganizationSummary } from '../../../../lib/api/types';
import { useAuth } from '../../../../providers/auth-provider';
import { StatusMessage } from '../../../../components/feedback/status-message';

export default function OrganizationOverviewPage({
  params,
}: Readonly<{ params: Promise<{ organizationId: string }> }>) {
  const resolved = React.use(params);
  const { accessToken } = useAuth();
  const [organization, setOrganization] = React.useState<OrganizationSummary | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!accessToken) {
      return;
    }

    void organizationApi
      .get(accessToken, resolved.organizationId)
      .then((response) => setOrganization(response.organization))
      .catch((caught) =>
        setError(caught instanceof Error ? caught.message : 'Organization not found.'),
      );
  }, [accessToken, resolved.organizationId]);

  if (error) {
    return <StatusMessage tone="danger">{error}</StatusMessage>;
  }

  if (!organization) {
    return <p className="text-slate-600">Loading organization...</p>;
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-md border border-slate-200 bg-white p-5">
        <h1 className="text-2xl font-semibold">{organization.displayName}</h1>
        <dl className="mt-4 grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
          <div>
            <dt className="font-medium text-slate-950">Slug</dt>
            <dd>{organization.slug}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-950">Status</dt>
            <dd>{organization.status}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-950">Locale</dt>
            <dd>{organization.defaultLocale}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-950">Timezone</dt>
            <dd>{organization.timezone}</dd>
          </div>
        </dl>
      </section>
      <div className="flex flex-wrap gap-3">
        <Link
          href={`/organizations/${organization.id}/members`}
          className="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white"
        >
          Members
        </Link>
        <Link
          href={`/organizations/${organization.id}/invitations`}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-white"
        >
          Invitations
        </Link>
        <Link
          href={`/organizations/${organization.id}/ownership`}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-white"
        >
          Ownership transfer
        </Link>
      </div>
    </div>
  );
}
