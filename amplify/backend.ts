import { defineBackend } from '@aws-amplify/backend';
import { proxyFn } from './functions/proxy/resource';

defineBackend({
  proxyFn
});