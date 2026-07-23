'use client';

import * as React from 'react';

import { FreeVotingBallot } from '../../../../../components/voting/free-voting-ballot';

export default function VotePage({
  params,
}: Readonly<{ params: Promise<{ organizationId: string; campaignId: string }> }>) {
  const { organizationId, campaignId } = React.use(params);

  return <FreeVotingBallot organizationId={organizationId} campaignId={campaignId} />;
}
