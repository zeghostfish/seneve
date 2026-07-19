import { CampaignForm } from '../../../../components/campaigns/campaign-form';

export default function NewCampaignPage() {
  return (
    <div className="grid gap-6">
      <section className="rounded-md border border-slate-200 bg-white p-5">
        <h1 className="text-2xl font-semibold">Create campaign</h1>
        <p className="mt-2 text-slate-600">
          Configure campaign identity, schedule, visibility and preliminary voting rules.
        </p>
      </section>
      <CampaignForm mode="create" />
    </div>
  );
}
