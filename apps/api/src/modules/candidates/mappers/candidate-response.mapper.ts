import type { CandidateSnapshot } from '@seneve/domain-candidate';

export function candidateResponse(candidate: CandidateSnapshot) {
  return {
    id: candidate.id,
    organizationId: candidate.organizationId,
    campaignId: candidate.campaignId,
    displayName: candidate.displayName,
    slug: candidate.slug,
    shortDescription: candidate.shortDescription,
    description: candidate.description,
    status: candidate.status,
    position: candidate.position,
    imageAssetId: candidate.imageAssetId,
    externalReference: candidate.externalReference,
    metadata: candidate.metadata,
    createdBy: candidate.createdBy,
    createdAt: candidate.createdAt.toISOString(),
    updatedAt: candidate.updatedAt.toISOString(),
    statusReason: candidate.statusReason,
    archivedAt: candidate.archivedAt?.toISOString() ?? null,
    version: candidate.version,
  };
}
