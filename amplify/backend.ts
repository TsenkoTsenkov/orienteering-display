import { defineBackend } from '@aws-amplify/backend';
import { proxyFn } from './functions/proxy/resource';
import { scrapeFn } from './functions/scrape/resource';
import { Stack } from 'aws-cdk-lib';
import { FunctionUrlAuthType } from 'aws-cdk-lib/aws-lambda';

const backend = defineBackend({
  proxyFn,
  scrapeFn
});

// Add function URLs for direct access
const stack = Stack.of(backend.proxyFn.resources.lambda);

// Add URL to proxy function
backend.proxyFn.resources.lambda.addFunctionUrl({
  authType: FunctionUrlAuthType.NONE,
  cors: {
    allowOrigins: ['*'],
    allowMethods: ['*'],
    allowHeaders: ['*']
  }
});

// Add URL to scrape function with Puppeteer layer
backend.scrapeFn.resources.lambda.addFunctionUrl({
  authType: FunctionUrlAuthType.NONE,
  cors: {
    allowOrigins: ['*'],
    allowMethods: ['*'],
    allowHeaders: ['*']
  }
});

// Add Chromium layer for Puppeteer
backend.scrapeFn.resources.lambda.addLayers(
  `arn:aws:lambda:eu-west-1:764866452798:layer:chrome-aws-lambda:39`
);