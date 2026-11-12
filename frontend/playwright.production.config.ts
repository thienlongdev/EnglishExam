import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'./tests-production',timeout:420000,expect:{timeout:30000},workers:1,
 outputDir:'../evidence/production/test-results',
 reporter:[['list'],['json',{outputFile:'../evidence/production/playwright-results.json'}]],
 use:{baseURL:'https://english-exam-coursework.vercel.app',channel:'chrome',headless:true,
  locale:'vi-VN',timezoneId:'Asia/Bangkok',viewport:{width:1440,height:1000},
  ignoreHTTPSErrors:false,screenshot:'only-on-failure',trace:'off'},
});
