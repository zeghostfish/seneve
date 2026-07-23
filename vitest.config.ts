import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@seneve/config': new URL('./packages/config/src/index.ts', import.meta.url).pathname,
      '@seneve/contracts': new URL('./packages/contracts/src/index.ts', import.meta.url).pathname,
      '@seneve/audit-application': new URL(
        './packages/audit-application/src/index.ts',
        import.meta.url,
      ).pathname,
      '@seneve/authorization-application': new URL(
        './packages/authorization-application/src/index.ts',
        import.meta.url,
      ).pathname,
      '@seneve/campaign-application': new URL(
        './packages/campaign-application/src/index.ts',
        import.meta.url,
      ).pathname,
      '@seneve/campaign-persistence': new URL(
        './packages/campaign-persistence/src/index.ts',
        import.meta.url,
      ).pathname,
      '@seneve/candidate-application': new URL(
        './packages/candidate-application/src/index.ts',
        import.meta.url,
      ).pathname,
      '@seneve/candidate-persistence': new URL(
        './packages/candidate-persistence/src/index.ts',
        import.meta.url,
      ).pathname,
      '@seneve/domain-audit': new URL('./packages/domain/audit/src/index.ts', import.meta.url)
        .pathname,
      '@seneve/domain-campaign': new URL('./packages/domain/campaign/src/index.ts', import.meta.url)
        .pathname,
      '@seneve/domain-candidate': new URL(
        './packages/domain/candidate/src/index.ts',
        import.meta.url,
      ).pathname,
      '@seneve/domain-identity': new URL('./packages/domain/identity/src/index.ts', import.meta.url)
        .pathname,
      '@seneve/domain-organization': new URL(
        './packages/domain/organization/src/index.ts',
        import.meta.url,
      ).pathname,
      '@seneve/domain-voting': new URL('./packages/domain/voting/src/index.ts', import.meta.url)
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
      '@seneve/organization-application': new URL(
        './packages/organization-application/src/index.ts',
        import.meta.url,
      ).pathname,
      '@seneve/organization-persistence': new URL(
        './packages/organization-persistence/src/index.ts',
        import.meta.url,
      ).pathname,
      '@seneve/voting-application': new URL(
        './packages/voting-application/src/index.ts',
        import.meta.url,
      ).pathname,
      '@seneve/voting-persistence': new URL(
        './packages/voting-persistence/src/index.ts',
        import.meta.url,
      ).pathname,
      '@seneve/shared': new URL('./packages/shared/src/index.ts', import.meta.url).pathname,
      '@seneve/tenant-context': new URL('./packages/tenant-context/src/index.ts', import.meta.url)
        .pathname,
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
