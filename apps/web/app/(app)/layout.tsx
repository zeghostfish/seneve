import { AppShell } from '../../components/navigation/app-shell';

export default function ProtectedLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <AppShell>{children}</AppShell>;
}
