import { Construct } from 'constructs';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as path from 'path';

export class LambdaResources {
  public readonly sendPaymentRequestLambda: lambda.Function;
  public readonly adminDataActionsLambda: lambda.Function;
  public readonly adminListUsersLambda: lambda.Function;

  constructor(scope: Construct, id: string, props: {
    ledgerEntryTable: Table;
    accountStatusTable: Table;
    currentAccountTransactionTable: Table;
  }) {
    this.sendPaymentRequestLambda = new lambda.Function(scope, 'SendPaymentRequestLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda-handlers/sendPaymentRequest')),
      environment: {
        LEDGER_ENTRY_TABLE_NAME: props.ledgerEntryTable.tableName,
        ACCOUNT_STATUS_TABLE_NAME: props.accountStatusTable.tableName,
        CURRENT_ACCT_TABLE_NAME: props.currentAccountTransactionTable.tableName
      }
    });

    this.adminDataActionsLambda = new lambda.Function(scope, 'AdminDataActionsLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda-handlers/adminDataActions')),
      environment: {
        LEDGER_ENTRY_TABLE_NAME: props.ledgerEntryTable.tableName,
        ACCOUNT_STATUS_TABLE_NAME: props.accountStatusTable.tableName,
        CURRENT_ACCT_TABLE_NAME: props.currentAccountTransactionTable.tableName
      }
    });

    this.adminListUsersLambda = new lambda.Function(scope, 'AdminListUsersLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda-handlers/adminListUsers'))
    });

    props.ledgerEntryTable.grantReadWriteData(this.sendPaymentRequestLambda);
    props.accountStatusTable.grantReadWriteData(this.sendPaymentRequestLambda);
    props.currentAccountTransactionTable.grantReadWriteData(this.sendPaymentRequestLambda);

    props.ledgerEntryTable.grantReadWriteData(this.adminDataActionsLambda);
    props.accountStatusTable.grantReadWriteData(this.adminDataActionsLambda);
    props.currentAccountTransactionTable.grantReadWriteData(this.adminDataActionsLambda);
  }
}
