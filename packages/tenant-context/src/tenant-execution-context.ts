import type { TenantContext } from './tenant-context.js';
import type { TenantContextProvider } from './tenant-context-provider.js';

export class TenantExecutionContext {
  constructor(private readonly provider: TenantContextProvider) {}

  current(): TenantContext | undefined {
    return this.provider.current();
  }

  requireCurrent(): TenantContext {
    return this.provider.requireCurrent();
  }

  run<T>(context: TenantContext, work: () => T): T {
    return this.provider.runWith(context, work);
  }
}
