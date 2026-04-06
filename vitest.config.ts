import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Allow importing .ts files with .js extension (Node ESM style)
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
      reporter: ['text', 'json', 'html'],
      exclude: [
        '**/*.d.ts',
        '**/dist/**',
        '**/index.ts',
        '**/types.ts',
        '**/transport/**',
        'packages/**/types.ts',
        'packages/mcp/**/*.ts',
      ],
    },
  },
});
