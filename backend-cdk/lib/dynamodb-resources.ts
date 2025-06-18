import { Construct } from 'constructs';
import { Table, AttributeType, BillingMode } from 'aws-cdk-lib/aws-dynamodb';

export class DynamoDbResources {
  public readonly ledgerEntryTable: Table;
  public readonly accountStatusTable: Table;
  public readonly currentAccountTransactionTable: Table;

  constructor(scope: Construct, id: string) {
    this.ledgerEntryTable = new Table(scope, 'LedgerEntryTable', {
      partitionKey: { name: 'id', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
    });

    this.accountStatusTable = new Table(scope, 'AccountStatusTable', {
      partitionKey: { name: 'id', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
    });

    this.currentAccountTransactionTable = new Table(scope, 'CurrentAccountTransactionTable', {
      partitionKey: { name: 'id', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
    });
  }
}
