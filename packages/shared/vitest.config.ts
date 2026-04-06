import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    extensionAlias: {
      '.js': ['.ts', '.js'],
    },
  },
  test: { passWithNoTests: true,
    globals: true,
    environment: 'node',
  },
});
