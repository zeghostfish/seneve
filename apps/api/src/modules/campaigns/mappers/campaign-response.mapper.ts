import type { PersistedCampaignReadModel } from '@seneve/domain-campaign';

export function campaignResponse(campaign: PersistedCampaignReadModel) {
  return {
    id: campaign.id,
    organizationId: campaign.organizationId,
    name: campaign.name,
    slug: campaign.slug,
    description: campaign.description,
    status: campaign.status,
    visibility: campaign.visibility,
    timezone: campaign.timezone,
    locale: campaign.locale,
    startsAt: campaign.startsAt.toISOString(),
    endsAt: campaign.endsAt.toISOString(),
    rules: {
      votingMode: campaign.rules.votingMode,
      votesPerVoter: campaign.rules.votesPerVoter,
      allowMultipleCandidates: campaign.rules.allowMultipleCandidates,
      requiresEmailVerification: campaign.rules.requiresEmailVerification,
      resultsVisibility: campaign.rules.results.visibility,
      resultRevealAt: campaign.rules.results.revealAt?.toISOString() ?? null,
    },
    createdBy: campaign.createdBy,
    createdAt: campaign.createdAt.toISOString(),
    updatedAt: campaign.updatedAt.toISOString(),
    archivedAt: campaign.archivedAt?.toISOString() ?? null,
    cancelledAt: campaign.cancelledAt?.toISOString() ?? null,
    version: campaign.version,
  };
}
