import { SeneveLogo } from '../../components/seneve-logo';

export default function VotingLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center px-5 py-4">
          <SeneveLogo variant="mark" size="sm" priority />
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl px-5 py-8 sm:py-12">{children}</main>
    </div>
  );
}
