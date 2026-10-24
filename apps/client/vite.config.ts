import { networkInterfaces } from 'node:os';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const serverUrl = process.env.SERVER_URL ?? 'http://localhost:9090';

function lanHost(): string | undefined {
  if (process.env.LAN_HOST) return process.env.LAN_HOST;
  return Object.values(networkInterfaces())
    .flat()
    .find((address) => address?.family === 'IPv4' && !address.internal)?.address;
}

export default defineConfig(({ command, mode }) => ({
  plugins: [react()],
  define: {
    __LAN_HOST__: JSON.stringify(command === 'serve' && mode !== 'test' ? lanHost() : undefined),
  },
  server: {
    host: true,
    proxy: {
      '/api': serverUrl,
      '/ws': { target: serverUrl, ws: true },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
  },
}));
