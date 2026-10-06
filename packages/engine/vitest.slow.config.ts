import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Statistical build-verification checks (REQUIREMENTS Section 8): the
    // zero-mean luck baselines. These simulate thousands of deals and take
    // tens of seconds, so they are kept out of the default suite.
    include: ['test/**/*.slow.test.ts'],
    environment: 'node',
    testTimeout: 120_000,
  },
});
