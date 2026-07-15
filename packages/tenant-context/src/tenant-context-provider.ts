import { AsyncLocalStorage } from 'node:async_hooks';

import { type TenantContext, requireTenantContext } from './tenant-context.js';

export interface TenantContextProvider {
  current(): TenantContext | undefined;
  requireCurrent(): TenantContext;
  runWith<T>(context: TenantContext, work: () => T): T;
}

export class AsyncLocalStorageTenantContextProvider implements TenantContextProvider {
  private readonly storage = new AsyncLocalStorage<TenantContext>();

  current(): TenantContext | undefined {
    return this.storage.getStore();
  }

  requireCurrent(): TenantContext {
    return requireTenantContext(this.current());
  }

  runWith<T>(context: TenantContext, work: () => T): T {
    return this.storage.run(context, work);
  }
}

export const tenantContextProvider = new AsyncLocalStorageTenantContextProvider();
