'use client';

import { useOrganizations } from '../../providers/organization-provider';

export function OrganizationSwitcher() {
  const { organizations, currentOrganization, selectOrganization, status } = useOrganizations();

  if (status === 'loading') {
    return <span className="text-sm text-slate-500">Loading organizations...</span>;
  }

  if (organizations.length === 0) {
    return <span className="text-sm text-slate-500">No organization selected</span>;
  }

  return (
    <label className="grid gap-1 text-xs font-medium uppercase tracking-wide text-slate-500">
      Organization
      <select
        value={currentOrganization?.id ?? ''}
        onChange={(event) => selectOrganization(event.target.value)}
        className="h-10 min-w-48 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium normal-case tracking-normal text-slate-950"
      >
        {organizations.map((organization) => (
          <option key={organization.id} value={organization.id}>
            {organization.displayName} - {organization.status}
          </option>
        ))}
      </select>
    </label>
  );
}
