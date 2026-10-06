import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Fast suite (default `npm test`). The heavy statistical luck-baseline
    // checks live in *.slow.test.ts and run via `npm run test:slow`.
    include: ['test/**/*.test.ts'],
    exclude: ['**/node_modules/**', 'test/**/*.slow.test.ts'],
    environment: 'node',
  },
});
