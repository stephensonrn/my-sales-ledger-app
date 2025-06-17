import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda_nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';
import { RemovalPolicy, CfnOutput, Duration } from 'aws-cdk-lib';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as appsync from '@aws-cdk/aws-appsync-alpha';

export class BackendCdkStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly companyNameAttributeFullName: string;
  public readonly ledgerEntryTable: dynamodb.Table;
  public readonly accountStatusTable: dynamodb.Table;
  public readonly transactionTable: dynamodb.Table;
  public readonly sendPaymentRequestFunction: lambda_nodejs.NodejsFunction;
  public readonly adminDataActionsFunction: lambda_nodejs.NodejsFunction;
  public readonly adminListUsersFunction: lambda_nodejs.NodejsFunction;
  public readonly graphqlApi: appsync.GraphqlApi;
  public readonly monthlyReportMailerFunction: lambda_nodejs.NodejsFunction;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    cdk.Tags.of(this).add('Project', 'SalesLedger');
    cdk.Tags.of(this).add('Environment', props?.env?.region || 'dev');
    cdk.Tags.of(this).add('DeploymentFocus', 'LinkAllCustomVTLs');

    const companyNameCustomAttributeDefinition = new cognito.StringAttribute({
      mutable: true,
    });
    this.companyNameAttributeFullName = `custom:company_name`;
    this.userPool = new cognito.UserPool(this, 'SalesLedgerUserPool', {
      userPoolName: `SalesLedgerUserPool-${this.stackName}`,
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: {
        email: { required: true, mutable: false },
      },
      customAttributes: {
        'company_name': companyNameCustomAttributeDefinition,
      },
      passwordPolicy: {
        minLength: 8, requireLowercase: true, requireUppercase: true,
        requireDigits: true, requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    this.userPoolClient = new cognito.UserPoolClient(this, 'SalesLedgerAppClient', {
      userPool: this.userPool,
      userPoolClientName: `SalesLedgerWebAppClient-${this.stackName}`,
      authFlows: { userSrp: true, userPassword: true },
      oAuth: {
        scopes: [
          cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.PROFILE, cognito.OAuthScope.COGNITO_ADMIN
        ],
        callbackUrls: [
          'http://localhost:5173/callback',
          `https://www.salesledgersync.com/callback`
        ],
        logoutUrls: [
          'http://localhost:5173/logout',
          `https://www.salesledgersync.com/logout`
        ],
      },
      readAttributes: new cognito.ClientAttributes().withStandardAttributes({ email: true, emailVerified: true }).withCustomAttributes('company_name'),
      writeAttributes: new cognito.ClientAttributes().withStandardAttributes({ email: true }).withCustomAttributes('company_name'),
    });

    new cognito.CfnUserPoolGroup(this, 'AdminGroup', {
      userPoolId: this.userPool.userPoolId,
      groupName: 'Admin',
      description: 'Administrators with elevated privileges',
    });
    this.graphqlApi = new appsync.GraphqlApi(this, 'SalesLedgerAppSyncApi', {
      name: `SalesLedgerApi-${this.stackName}`,
      schema: appsync.SchemaFile.fromAsset(path.join(__dirname, '../graphql/schema.graphql')),
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: appsync.AuthorizationType.USER_POOL,
          userPoolConfig: { userPool: this.userPool, defaultAction: appsync.UserPoolDefaultAction.ALLOW },
        },
        additionalAuthorizationModes: [{ authorizationType: appsync.AuthorizationType.IAM }],
      },
      logConfig: { fieldLogLevel: appsync.FieldLogLevel.ALL, excludeVerboseContent: false },
      xrayEnabled: true,
    });

    this.ledgerEntryTable = new dynamodb.Table(this, 'LedgerEntryTable', {
      tableName: `LedgerEntry-${this.stackName}`,
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    this.ledgerEntryTable.addGlobalSecondaryIndex({
      indexName: 'byOwner',
      partitionKey: { name: 'owner', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
    });

    this.accountStatusTable = new dynamodb.Table(this, 'AccountStatusTable', {
      tableName: `AccountStatus-${this.stackName}`,
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    this.accountStatusTable.addGlobalSecondaryIndex({
      indexName: 'byOwner',
      partitionKey: { name: 'owner', type: dynamodb.AttributeType.STRING },
    });

    this.transactionTable = new dynamodb.Table(this, 'CurrentAccountTransactionTable', {
      tableName: `Transaction-${this.stackName}`,
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    this.transactionTable.addGlobalSecondaryIndex({
      indexName: 'byOwner',
      partitionKey: { name: 'owner', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
    });
    const nodeJsFunctionProps: Omit<lambda_nodejs.NodejsFunctionProps, 'entry' | 'handler' | 'role' | 'functionName' | 'environment'> = {
      runtime: lambda.Runtime.NODEJS_20_X,
      bundling: {
        minify: true,
        sourceMap: true,
        target: 'node20',
      },
    };

    // Define Lambda functions and roles

// 1. sendPaymentRequestFunction and Role
const sendPaymentRequestRole = new iam.Role(this, 'SendPaymentRequestRole', {
  assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
  managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')],
});
this.sendPaymentRequestFunction = new lambda_nodejs.NodejsFunction(this, 'SendPaymentRequestFn', {
  ...nodeJsFunctionProps,
  functionName: `sendPaymentRequestFunction-${this.stackName}`,
  handler: 'handler',
  entry: path.join(__dirname, '../lambda-handlers/sendPaymentRequest/handler.ts'),
  role: sendPaymentRequestRole,
  timeout: Duration.seconds(30),
  environment: {
    FROM_EMAIL: 'ross@aurumif.com',
    USER_POOL_ID: this.userPool.userPoolId,
    CURRENT_ACCT_TABLE_NAME: this.transactionTable.tableName,
  },
  bundling: {
    ...nodeJsFunctionProps.bundling,
    externalModules: ['@aws-sdk/client-ses', '@aws-sdk/client-cognito-identity-provider', '@aws-sdk/client-dynamodb', '@aws-sdk/lib-dynamodb'],
  },
});

// 2. adminDataActionsFunction and Role
const adminDataActionsRole = new iam.Role(this, 'AdminDataActionsRole', {
  assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
  managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')],
});
this.adminDataActionsFunction = new lambda_nodejs.NodejsFunction(this, 'AdminDataActionsFn', {
  ...nodeJsFunctionProps,
  functionName: `adminDataActionsFunction-${this.stackName}`,
  handler: 'handler',
  entry: path.join(__dirname, '../lambda-handlers/adminDataActions/handler.ts'),
  role: adminDataActionsRole,
  timeout: Duration.seconds(30),
  environment: {
    USER_POOL_ID: this.userPool.userPoolId,
    CURRENT_ACCT_TABLE_NAME: this.transactionTable.tableName,
    LEDGER_ENTRY_TABLE_NAME: this.ledgerEntryTable.tableName,
    ACCOUNT_STATUS_TABLE_NAME: this.accountStatusTable.tableName,
  },
  bundling: {
    ...nodeJsFunctionProps.bundling,
    externalModules: ['@aws-sdk/client-dynamodb', '@aws-sdk/lib-dynamodb', '@aws-sdk/client-cognito-identity-provider', '@aws-sdk/client-ses'],
  },
});

// 3. adminListUsersFunction and Role
const adminListUsersRole = new iam.Role(this, 'AdminListUsersRole', {
  assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
  managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')],
});
this.adminListUsersFunction = new lambda_nodejs.NodejsFunction(this, 'AdminListUsersFn', {
  ...nodeJsFunctionProps,
  functionName: `adminListUsersFunction-${this.stackName}`,
  handler: 'handler',
  entry: path.join(__dirname, '../lambda-handlers/adminListUsers/handler.ts'),
  role: adminListUsersRole,
  timeout: Duration.seconds(15),
  environment: { USER_POOL_ID: this.userPool.userPoolId },
  bundling: {
    ...nodeJsFunctionProps.bundling,
    externalModules: ['@aws-sdk/client-cognito-identity-provider'],
  },
});

// 4. monthlyReportMailerFunction and Role
const monthlyReportMailerRole = new iam.Role(this, 'MonthlyReportMailerRole', {
  assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
  managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')],
});
this.monthlyReportMailerFunction = new lambda_nodejs.NodejsFunction(this, 'MonthlyReportMailerFunction', {
  ...nodeJsFunctionProps,
  functionName: `monthlyReportMailerFunction-${this.stackName}`,
  entry: path.join(__dirname, '../lambda-handlers/monthlyReportMailer/index.ts'),
  handler: 'handler',
  role: monthlyReportMailerRole,
  timeout: Duration.minutes(10),
  memorySize: 256,
  environment: {
    USER_POOL_ID: this.userPool.userPoolId,
    LEDGER_TABLE_NAME: this.ledgerEntryTable.tableName,
    TRANSACTION_TABLE_NAME: this.transactionTable.tableName,
    ACCOUNT_STATUS_TABLE_NAME: this.accountStatusTable.tableName,
    SES_FROM_ADDRESS: 'ross@aurumif.com',
    ADMIN_GROUP_NAME: 'Admin',
  },
  bundling: {
    ...nodeJsFunctionProps.bundling,
    externalModules: ['@aws-sdk/client-cognito-identity-provider', '@aws-sdk/client-dynamodb', '@aws-sdk/lib-dynamodb', '@aws-sdk/client-ses'],
  },
});
    // Create AppSync Data Sources
    const ledgerEntryDataSource = this.graphqlApi.addDynamoDbDataSource('LedgerEntryDataSource', this.ledgerEntryTable);
    const accountStatusDataSource = this.graphqlApi.addDynamoDbDataSource('AccountStatusDataSource', this.accountStatusTable);
    const transactionDataSource = this.graphqlApi.addDynamoDbDataSource('TransactionDataSource', this.transactionTable);
    const sendPaymentRequestDataSource = this.graphqlApi.addLambdaDataSource('SendPaymentRequestDataSource', this.sendPaymentRequestFunction);
    const adminDataActionsDataSource = this.graphqlApi.addLambdaDataSource('AdminDataActionsDataSource', this.adminDataActionsFunction);
    const adminListUsersDataSource = this.graphqlApi.addLambdaDataSource('AdminListUsersDataSource', this.adminListUsersFunction);

    this.ledgerEntryTable.grantReadWriteData(ledgerEntryDataSource.grantPrincipal);
    this.accountStatusTable.grantReadWriteData(accountStatusDataSource.grantPrincipal);
    this.transactionTable.grantReadWriteData(transactionDataSource.grantPrincipal);

    // Setup other resolvers (omitted for brevity, but they follow the pattern from previous messages)...

    // Stack Outputs
    new CfnOutput(this, 'RegionOutput', { value: this.region });
    new CfnOutput(this, 'UserPoolIdOutput', { value: this.userPool.userPoolId });
    new CfnOutput(this, 'UserPoolClientIdOutput', { value: this.userPoolClient.userPoolClientId });
    new CfnOutput(this, 'GraphQLAPIURLOutput', { value: this.graphqlApi.graphqlUrl });
    new CfnOutput(this, 'GraphQLAPIIDOutput', { value: this.graphqlApi.apiId });
    new CfnOutput(this, 'LedgerEntryTableNameOutput', { value: this.ledgerEntryTable.tableName });
    new CfnOutput(this, 'AccountStatusTableNameOutput', { value: this.accountStatusTable.tableName });
    new CfnOutput(this, 'TransactionTableNameOutput', { value: this.transactionTable.tableName });
    new CfnOutput(this, 'SendPaymentRequestFunctionNameOutput', { value: this.sendPaymentRequestFunction.functionName });
    new CfnOutput(this, 'AdminDataActionsFunctionNameOutput', { value: this.adminDataActionsFunction.functionName });
    new CfnOutput(this, 'AdminListUsersFunctionNameOutput', { value: this.adminListUsersFunction.functionName });
    new CfnOutput(this, 'MonthlyReportMailerFunctionNameOutput', { value: this.monthlyReportMailerFunction.functionName });
    new CfnOutput(this, 'MonthlyReportMailerFunctionArnOutput', { value: this.monthlyReportMailerFunction.functionArn });
  }
}
