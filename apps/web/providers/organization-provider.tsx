'use client';

import * as React from 'react';

import { organizationApi } from '../lib/api/organization-api';
import type { OrganizationSummary } from '../lib/api/types';
import { useAuth } from './auth-provider';

interface OrganizationContextValue {
  readonly organizations: readonly OrganizationSummary[];
  readonly currentOrganization: OrganizationSummary | null;
  readonly status: 'idle' | 'loading' | 'ready' | 'error';
  readonly error: string | null;
  reload(): Promise<void>;
  selectOrganization(organizationId: string): void;
}

const selectedOrganizationKey = 'seneve.selectedOrganizationId';
const OrganizationContext = React.createContext<OrganizationContextValue | null>(null);

export function OrganizationProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const { accessToken, isAuthenticated } = useAuth();
  const [organizations, setOrganizations] = React.useState<readonly OrganizationSummary[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<OrganizationContextValue['status']>('idle');
  const [error, setError] = React.useState<string | null>(null);

  const reload = React.useCallback(async () => {
    if (!isAuthenticated || !accessToken) {
      setOrganizations([]);
      setStatus('idle');
      return;
    }

    setStatus('loading');
    setError(null);

    try {
      const response = await organizationApi.list(accessToken);
      setOrganizations(response.organizations);
      setStatus('ready');
      setSelectedId((current) => {
        const stored =
          typeof window === 'undefined'
            ? null
            : window.localStorage.getItem(selectedOrganizationKey);
        const candidate = current ?? stored;
        const selected = response.organizations.find(
          (organization) => organization.id === candidate,
        );
        const fallback = response.organizations[0] ?? null;
        const next = selected?.id ?? fallback?.id ?? null;

        if (next && typeof window !== 'undefined') {
          window.localStorage.setItem(selectedOrganizationKey, next);
        }

        return next;
      });
    } catch (caught) {
      setStatus('error');
      setError(caught instanceof Error ? caught.message : 'Could not load organizations.');
    }
  }, [accessToken, isAuthenticated]);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  const value = React.useMemo<OrganizationContextValue>(
    () => ({
      organizations,
      currentOrganization:
        organizations.find((organization) => organization.id === selectedId) ?? null,
      status,
      error,
      reload,
      selectOrganization(organizationId) {
        setSelectedId(organizationId);
        window.localStorage.setItem(selectedOrganizationKey, organizationId);
      },
    }),
    [error, organizations, reload, selectedId, status],
  );

  return <OrganizationContext.Provider value={value}>{children}</OrganizationContext.Provider>;
}

export function useOrganizations() {
  const context = React.useContext(OrganizationContext);

  if (!context) {
    throw new Error('useOrganizations must be used inside OrganizationProvider.');
  }

  return context;
}
