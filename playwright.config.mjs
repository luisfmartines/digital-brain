import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/browser',
  use: { baseURL: 'http://127.0.0.1:5191', channel: 'msedge', viewport: { width: 390, height: 844 } },
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 5191 --strictPort', url: 'http://127.0.0.1:5191', reuseExistingServer: !process.env.CI },
})
