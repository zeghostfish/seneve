'use client';

import * as React from 'react';

import { CandidateForm } from '../../../../../../components/candidates/candidate-form';

export default function NewCandidatePage({
  params,
}: Readonly<{ params: Promise<{ campaignId: string }> }>) {
  const { campaignId } = React.use(params);

  return (
    <div className="grid gap-6">
      <section className="rounded-md border border-slate-200 bg-white p-5">
        <h1 className="text-2xl font-semibold">Create candidate</h1>
        <p className="mt-2 text-slate-600">
          Add candidate presentation data for this campaign. This does not create votes or rankings.
        </p>
      </section>
      <CandidateForm campaignId={campaignId} />
    </div>
  );
}
