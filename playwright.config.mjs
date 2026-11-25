import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/browser',
  use: { baseURL: 'http://127.0.0.1:5191', channel: 'msedge', viewport: { width: 390, height: 844 }, serviceWorkers: 'block' },
  webServer: { command: 'npm run build && npm run preview -- --listen tcp://127.0.0.1:5191', url: 'http://127.0.0.1:5191', reuseExistingServer: !process.env.CI, timeout: 120_000 },
})
