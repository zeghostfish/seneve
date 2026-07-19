import { SeneveLogo } from '../seneve-logo';

export function AuthCard({
  title,
  children,
}: Readonly<{ title: string; children: React.ReactNode }>) {
  return (
    <section className="mx-auto grid min-h-[calc(100vh-84px)] w-full max-w-md content-center px-6 py-10">
      <div className="grid gap-6 rounded-md border border-slate-200 bg-white p-6 text-slate-950 shadow-sm">
        <SeneveLogo variant="transparent" size="md" priority />
        <h1 className="text-2xl font-semibold">{title}</h1>
        {children}
      </div>
    </section>
  );
}
