import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
  resolve: {
    alias: {
      '@extension': resolve(__dirname, 'src/extension'),
      '@webview': resolve(__dirname, 'src/webview'),
    },
  },
});
