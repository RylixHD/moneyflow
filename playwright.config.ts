import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir:'./tests/e2e',workers:1,fullyParallel:false,retries:process.env.CI?1:0,
  use:{baseURL:'http://localhost:3000',trace:'retain-on-failure',screenshot:'only-on-failure'},
  webServer:[
    {command:'node --import tsx apps/api/src/main.ts',url:'http://localhost:4000/api/auth/me',env:{NODE_ENV:'test',APP_ORIGIN:'http://localhost:3000',API_PORT:'4000'},reuseExistingServer:!process.env.CI},
    {command:'node node_modules/next/dist/bin/next start apps/web',url:'http://localhost:3000',reuseExistingServer:!process.env.CI}
  ]
});
