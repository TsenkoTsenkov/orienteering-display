import { defineBackend } from '@aws-amplify/backend';
import { scrapeFn } from './functions/scrape/resource';
import { Stack } from 'aws-cdk-lib';
import { LayerVersion } from 'aws-cdk-lib/aws-lambda';

const backend = defineBackend({
  scrapeFn
});

// Add Chromium layer for Puppeteer support
backend.scrapeFn.resources.lambda.addLayers(
  LayerVersion.fromLayerVersionArn(
    Stack.of(backend.scrapeFn.resources.lambda),
    'ChromiumLayer',
    'arn:aws:lambda:eu-west-1:764866452798:layer:chrome-aws-lambda:39'
  )
);

// Add function URL with CORS
const fnUrl = backend.scrapeFn.resources.lambda.addFunctionUrl({
  authType: 'NONE',
  cors: {
    allowedOrigins: ['*'],
    allowedMethods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['*']
  }
});

// Output the function URL
backend.addOutput({
  custom: {
    scraperFunctionUrl: fnUrl.url
  }
});