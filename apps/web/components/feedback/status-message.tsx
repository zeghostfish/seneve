export function StatusMessage({
  tone = 'neutral',
  children,
}: Readonly<{
  tone?: 'neutral' | 'success' | 'warning' | 'danger';
  children: React.ReactNode;
}>) {
  const toneClass =
    tone === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : tone === 'warning'
        ? 'border-amber-200 bg-amber-50 text-amber-800'
        : tone === 'danger'
          ? 'border-red-200 bg-red-50 text-red-800'
          : 'border-slate-200 bg-white text-slate-700';

  return <div className={`rounded-md border px-4 py-3 text-sm ${toneClass}`}>{children}</div>;
}
