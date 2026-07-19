'use client';

import * as React from 'react';

import { AuthProvider } from './auth-provider';
import { OrganizationProvider } from './organization-provider';

export function AppProviders({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <AuthProvider>
      <OrganizationProvider>{children}</OrganizationProvider>
    </AuthProvider>
  );
}
