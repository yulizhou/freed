import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    extensionAlias: {
      '.js': ['.ts', '.js'],
    },
  },
  test: {
    globals: true,
    environment: 'node',
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json'],
      exclude: [
        '**/*.d.ts',
        '**/dist/**',
        '**/index.ts',
        '**/types.ts',
      ],
    },
  },
});
