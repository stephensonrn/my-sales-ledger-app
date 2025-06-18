import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { DynamoDbResources } from './dynamodb-resources';
import { LambdaResources } from './lambda-resources';
import { AppsyncResources } from './appsync-resources';

export class BackendCdkStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const ddb = new DynamoDbResources(this, 'DynamoDbResources');

    const lambdas = new LambdaResources(this, 'LambdaResources', {
      ledgerEntryTable: ddb.ledgerEntryTable,
      accountStatusTable: ddb.accountStatusTable,
      currentAccountTransactionTable: ddb.currentAccountTransactionTable
    });

    new AppsyncResources(this, 'AppsyncResources', {
      ledgerEntryTable: ddb.ledgerEntryTable,
      accountStatusTable: ddb.accountStatusTable,
      currentAccountTransactionTable: ddb.currentAccountTransactionTable,
      sendPaymentRequestLambda: lambdas.sendPaymentRequestLambda,
      adminDataActionsLambda: lambdas.adminDataActionsLambda,
      adminListUsersLambda: lambdas.adminListUsersLambda
    });
  }
}
