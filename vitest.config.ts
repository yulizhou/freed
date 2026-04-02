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
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
});
