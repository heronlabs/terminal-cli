import {defineConfig} from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reportsDirectory: 'reports/vitest',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['**/main.ts', '**/*factory.ts'],
      enabled: true,
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
      },
    },
    clearMocks: true,
    mockReset: true,
    restoreMocks: true,
    testTimeout: 30_000,
    pool: 'threads',
  },
});
