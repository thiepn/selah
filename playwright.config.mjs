import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir:'./tests/browser',
  fullyParallel:false,
  retries:1,
  timeout:30_000,
  expect:{timeout:7_000},
  use:{
    baseURL:'http://127.0.0.1:4173',
    serviceWorkers:'allow',
    trace:'retain-on-failure',
  },
  webServer:{
    command:'npm run serve',
    url:'http://127.0.0.1:4173',
    reuseExistingServer:true,
    timeout:20_000,
  },
  projects:[
    {name:'desktop-chromium',use:{...devices['Desktop Chrome']}},
    {name:'mobile-chromium',use:{...devices['Pixel 7']}},
  ],
});
