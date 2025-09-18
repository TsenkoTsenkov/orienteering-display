import { defineFunction } from '@aws-amplify/backend';

export const proxyFn = defineFunction({
  name: 'proxy',
  entry: './handler.ts'
});