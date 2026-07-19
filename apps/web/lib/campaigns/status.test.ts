import { describe, expect, it } from 'vitest';

import { campaignStatusPresentation, candidateStatusPresentation, statusClass } from './status';

describe('campaign and candidate status presentation', () => {
  it('separates lifecycle semantics without using raw enum names as the only UI contract', () => {
    expect(campaignStatusPresentation.ACTIVE).toMatchObject({
      label: 'Active',
      intent: 'success',
    });
    expect(campaignStatusPresentation.CANCELLED.intent).toBe('danger');
    expect(candidateStatusPresentation.DISQUALIFIED.intent).toBe('danger');
    expect(candidateStatusPresentation.ARCHIVED.intent).toBe('neutral');
  });

  it('maps status intents to stable badge classes', () => {
    expect(statusClass('success')).toContain('emerald');
    expect(statusClass('danger')).toContain('red');
    expect(statusClass('neutral')).toContain('slate');
  });
});
