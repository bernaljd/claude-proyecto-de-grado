import { defineConfig } from '@playwright/test';

// Corre sobre npm run preview (el sitio ya construido, como en Vercel)
export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'off',
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM ?? undefined,
      args: ['--headless', '--no-sandbox'],
    },
  },
  webServer: {
    command: 'npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 60000,
  },
});
