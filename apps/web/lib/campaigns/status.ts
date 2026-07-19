import type { CampaignStatus, CandidateStatus } from '../api/types';

export interface StatusPresentation {
  readonly label: string;
  readonly intent: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
  readonly description: string;
}

export const campaignStatusPresentation: Readonly<Record<CampaignStatus, StatusPresentation>> = {
  DRAFT: {
    label: 'Draft',
    intent: 'neutral',
    description: 'Configuration is still being prepared.',
  },
  SCHEDULED: {
    label: 'Scheduled',
    intent: 'info',
    description: 'Campaign is scheduled but not active.',
  },
  ACTIVE: {
    label: 'Active',
    intent: 'success',
    description: 'Campaign is currently active.',
  },
  PAUSED: {
    label: 'Paused',
    intent: 'warning',
    description: 'Campaign is paused.',
  },
  COMPLETED: {
    label: 'Completed',
    intent: 'success',
    description: 'Campaign has completed.',
  },
  CANCELLED: {
    label: 'Cancelled',
    intent: 'danger',
    description: 'Campaign was cancelled.',
  },
  ARCHIVED: {
    label: 'Archived',
    intent: 'neutral',
    description: 'Campaign is retained as read-only history.',
  },
};

export const candidateStatusPresentation: Readonly<Record<CandidateStatus, StatusPresentation>> = {
  DRAFT: {
    label: 'Draft',
    intent: 'neutral',
    description: 'Candidate is not yet eligible.',
  },
  ELIGIBLE: {
    label: 'Eligible',
    intent: 'success',
    description: 'Candidate is eligible when campaign rules allow participation.',
  },
  SUSPENDED: {
    label: 'Suspended',
    intent: 'warning',
    description: 'Candidate is temporarily unavailable.',
  },
  WITHDRAWN: {
    label: 'Withdrawn',
    intent: 'neutral',
    description: 'Candidate voluntarily withdrew.',
  },
  DISQUALIFIED: {
    label: 'Disqualified',
    intent: 'danger',
    description: 'Candidate was administratively excluded.',
  },
  ARCHIVED: {
    label: 'Archived',
    intent: 'neutral',
    description: 'Candidate is retained as read-only history.',
  },
};

export function statusClass(intent: StatusPresentation['intent']): string {
  return intent === 'success'
    ? 'bg-emerald-50 text-emerald-800 ring-emerald-200'
    : intent === 'warning'
      ? 'bg-amber-50 text-amber-800 ring-amber-200'
      : intent === 'danger'
        ? 'bg-red-50 text-red-800 ring-red-200'
        : intent === 'info'
          ? 'bg-sky-50 text-sky-800 ring-sky-200'
          : 'bg-slate-100 text-slate-700 ring-slate-200';
}

export function formatDateTime(value: string, timezone?: string): string {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: timezone || undefined,
  }).format(new Date(value));
}
