import type { CampaignStatus, CandidateStatus } from '../../lib/api/types';
import {
  campaignStatusPresentation,
  candidateStatusPresentation,
  statusClass,
} from '../../lib/campaigns/status';

export function CampaignStatusBadge({ status }: Readonly<{ status: CampaignStatus }>) {
  const presentation = campaignStatusPresentation[status];

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusClass(presentation.intent)}`}
    >
      {presentation.label}
    </span>
  );
}

export function CandidateStatusBadge({ status }: Readonly<{ status: CandidateStatus }>) {
  const presentation = candidateStatusPresentation[status];

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusClass(presentation.intent)}`}
    >
      {presentation.label}
    </span>
  );
}
