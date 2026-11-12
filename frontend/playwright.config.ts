import {defineConfig} from "@playwright/test";
export default defineConfig({
 testDir:"./tests",timeout:90000,expect:{timeout:20000},workers:1,
 reporter:[["list"],["json",{outputFile:"../evidence/frontend-tests.json"}]],
 use:{baseURL:process.env.TEST_BASE_URL||"http://127.0.0.1:3000",channel:"chrome",headless:true,locale:"vi-VN",timezoneId:"Asia/Bangkok",viewport:{width:1440,height:1000},screenshot:"only-on-failure",trace:"off"},
});
