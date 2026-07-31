import { VotingHistory } from '../../../../../components/voting/voting-history';

export default async function VotingHistoryPage({
  params,
}: Readonly<{ params: Promise<{ organizationId: string }> }>) {
  const { organizationId } = await params;

  return <VotingHistory organizationId={organizationId} />;
}
