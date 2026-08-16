import { defineConfig, devices } from "@playwright/test";

const appPort = process.env.PLAYWRIGHT_PORT ?? "3101";
const appUrl = `http://127.0.0.1:${appPort}`;

export default defineConfig({
  testDir: "./tests/e2e",
  use: {
    baseURL: appUrl,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "Mobile Safari",
      use: { ...devices["iPhone 13"] },
    },
  ],
  webServer: {
    command: `npm run dev -- --port ${appPort}`,
    url: appUrl,
    reuseExistingServer: false,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
        "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH",
    },
  },
});
