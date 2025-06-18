import { Construct } from 'constructs';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as appsync from '@aws-cdk/aws-appsync-alpha';
import { SchemaFile } from '@aws-cdk/aws-appsync-alpha';
import * as path from 'path';
import { UserPool } from 'aws-cdk-lib/aws-cognito';

interface AppsyncResourcesProps {
  ledgerEntryTable: Table;
  accountStatusTable: Table;
  currentAccountTransactionTable: Table;
  sendPaymentRequestLambda: lambda.Function;
  adminDataActionsLambda: lambda.Function;
  adminListUsersLambda: lambda.Function;
}

export class AppsyncResources {
  public readonly graphqlApi: appsync.GraphqlApi;

  constructor(scope: Construct, id: string, props: AppsyncResourcesProps) {
    const userPool = new UserPool(scope, 'SalesLedgerUserPool', {
      selfSignUpEnabled: true,
    });

    this.graphqlApi = new appsync.GraphqlApi(scope, 'GraphqlApi', {
      name: 'SalesLedgerApi',
      schema: SchemaFile.fromAsset(path.join(__dirname, '../graphql/schema.graphql')),
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: appsync.AuthorizationType.API_KEY,
        },
        additionalAuthorizationModes: [
          {
            authorizationType: appsync.AuthorizationType.USER_POOL,
            userPoolConfig: {
              userPool,
            },
          },
        ],
      },
      xrayEnabled: true,
    });

    const ledgerEntryDS = this.graphqlApi.addDynamoDbDataSource('LedgerEntryDS', props.ledgerEntryTable);
    const accountStatusDS = this.graphqlApi.addDynamoDbDataSource('AccountStatusDS', props.accountStatusTable);
    const transactionDS = this.graphqlApi.addDynamoDbDataSource('TransactionDS', props.currentAccountTransactionTable);

    const sendPaymentRequestDS = this.graphqlApi.addLambdaDataSource('SendPaymentRequestDS', props.sendPaymentRequestLambda);
    const adminDataActionsDS = this.graphqlApi.addLambdaDataSource('AdminDataActionsDS', props.adminDataActionsLambda);
    const adminListUsersDS = this.graphqlApi.addLambdaDataSource('AdminListUsersDS', props.adminListUsersLambda);

    // DDB Resolvers
    ledgerEntryDS.createResolver('ListLedgerEntriesResolver', {
      typeName: 'Query',
      fieldName: 'listLedgerEntries',
      requestMappingTemplate: appsync.MappingTemplate.fromFile('vtl-templates/listLedgerEntries.req.vtl'),
      responseMappingTemplate: appsync.MappingTemplate.fromFile('vtl-templates/listLedgerEntries.res.vtl'),
    });

    accountStatusDS.createResolver('ListAccountStatusesResolver', {
      typeName: 'Query',
      fieldName: 'listAccountStatuses',
      requestMappingTemplate: appsync.MappingTemplate.fromFile('vtl-templates/listAccountStatuses.req.vtl'),
      responseMappingTemplate: appsync.MappingTemplate.fromFile('vtl-templates/listAccountStatuses.res.vtl'),
    });

    transactionDS.createResolver('ListCurrentAccountTransactionsResolver', {
      typeName: 'Query',
      fieldName: 'listCurrentAccountTransactions',
      requestMappingTemplate: appsync.MappingTemplate.fromFile('vtl-templates/listCurrentAccountTransactions.req.vtl'),
      responseMappingTemplate: appsync.MappingTemplate.fromFile('vtl-templates/listCurrentAccountTransactions.res.vtl'),
    });

    // Lambda Resolvers
    sendPaymentRequestDS.createResolver('SendPaymentRequestResolver', {
      typeName: 'Mutation',
      fieldName: 'sendPaymentRequestEmail',
      requestMappingTemplate: appsync.MappingTemplate.lambdaRequest(),
      responseMappingTemplate: appsync.MappingTemplate.lambdaResult(),
    });

    adminDataActionsDS.createResolver('AdminCreateLedgerEntryResolver', {
      typeName: 'Mutation',
      fieldName: 'adminCreateLedgerEntry',
      requestMappingTemplate: appsync.MappingTemplate.lambdaRequest(),
      responseMappingTemplate: appsync.MappingTemplate.lambdaResult(),
    });

    adminDataActionsDS.createResolver('AdminAddCashReceiptResolver', {
      typeName: 'Mutation',
      fieldName: 'adminAddCashReceipt',
      requestMappingTemplate: appsync.MappingTemplate.lambdaRequest(),
      responseMappingTemplate: appsync.MappingTemplate.lambdaResult(),
    });

    adminListUsersDS.createResolver('AdminRequestPaymentForUserResolver', {
      typeName: 'Mutation',
      fieldName: 'adminRequestPaymentForUser',
      requestMappingTemplate: appsync.MappingTemplate.lambdaRequest(),
      responseMappingTemplate: appsync.MappingTemplate.lambdaResult(),
    });
  }
}
