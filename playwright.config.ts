import { defineConfig, devices } from "@playwright/test"

// E2E_PORT lets a second checkout run the suite without clashing with a dev server on 3847.
const port = Number(process.env.E2E_PORT ?? 3847)

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run build && npm run start -- -p ${port}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    env: {
      BILLKIT_E2E: "1",
    },
  },
})
