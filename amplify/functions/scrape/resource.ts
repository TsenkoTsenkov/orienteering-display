import { defineFunction } from '@aws-amplify/backend';

export const scrapeFn = defineFunction({
  name: 'scrape',
  entry: './handler.ts',
  timeoutSeconds: 60,
  memoryMB: 2048,
  runtime: 20
});