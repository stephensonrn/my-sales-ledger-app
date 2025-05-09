#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { BackendCdkStack } from '../lib/backend-cdk-stack';

const app = new cdk.App();

// Create the main stack for the application
new BackendCdkStack(app, 'SalesLedgerApp-Backend-eu-west-1', { // Use a descriptive and unique stack name
  // Explicitly set the target region for this stack
  env: {
    region: 'eu-west-1',
    // You can also specify account, or leave it to default AWS profile config
    // account: process.env.CDK_DEFAULT_ACCOUNT
  },
  description: 'Backend stack for Sales Ledger App (Cognito, AppSync, Lambdas, DDB) deployed via CDK'
});

app.synth(); // Synthesize the CloudFormation template