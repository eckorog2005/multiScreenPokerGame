import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const serverUrl = process.env.SERVER_URL ?? 'http://localhost:9090'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': serverUrl,
      '/ws': { target: serverUrl, ws: true },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
  },
})
