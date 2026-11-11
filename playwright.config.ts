import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: "http://127.0.0.1:3000",
    headless: true,
    viewport: { width: 1536, height: 1024 },
    launchOptions: { channel: "chrome" },
    trace: "retain-on-failure",
  },
  reporter: "list",
});
