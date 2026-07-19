import * as React from 'react';

import { SeneveLogo } from '../../components/seneve-logo';

export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <header className="mx-auto flex max-w-6xl items-center px-6 py-5">
        <SeneveLogo variant="mark" size="md" priority />
      </header>
      {children}
    </main>
  );
}
