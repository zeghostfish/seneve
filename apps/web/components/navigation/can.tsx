import type { SenevePermission } from '../../lib/auth/permissions';
import { usePermission } from '../../lib/auth/use-permission';

export function Can({
  permission,
  children,
}: Readonly<{ permission: SenevePermission; children: React.ReactNode }>) {
  const decision = usePermission(permission);

  if (!decision.allowed) {
    return null;
  }

  return <>{children}</>;
}
