import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@seneve/config': new URL('./packages/config/src/index.ts', import.meta.url).pathname,
      '@seneve/contracts': new URL('./packages/contracts/src/index.ts', import.meta.url).pathname,
      '@seneve/domain-identity': new URL('./packages/domain/identity/src/index.ts', import.meta.url)
        .pathname,
      '@seneve/identity-application': new URL(
        './packages/identity-application/src/index.ts',
        import.meta.url,
      ).pathname,
      '@seneve/identity-crypto': new URL('./packages/identity-crypto/src/index.ts', import.meta.url)
        .pathname,
      '@seneve/identity-persistence': new URL(
        './packages/identity-persistence/src/index.ts',
        import.meta.url,
      ).pathname,
      '@seneve/shared': new URL('./packages/shared/src/index.ts', import.meta.url).pathname,
      '@seneve/testing': new URL('./packages/testing/src/index.ts', import.meta.url).pathname,
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['apps/**/*.test.ts', 'packages/**/*.test.ts'],
    coverage: {
      reporter: ['text', 'lcov'],
    },
  },
});
