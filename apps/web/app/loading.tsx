import * as React from 'react';

import { SeneveLogo } from '../components/seneve-logo';

export default function Loading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50">
      <SeneveLogo variant="mark" size="lg" alt="" priority />
    </main>
  );
}
