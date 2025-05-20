// backend-cdk/lib/backend-cdk-stack.ts
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
import * as appsync from '@aws-cdk/aws-appsync-alpha'; // Using alpha for existing pattern

export class BackendCdkStack extends cdk.Stack {
  // Public properties
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

    // --- Define Custom Attribute for Company Name ---
    const companyNameCustomAttributeDefinition = new cognito.StringAttribute({
      mutable: true,
    });
    this.companyNameAttributeFullName = `custom:company_name`;

    // --- Cognito User Pool ---
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
      removalPolicy: RemovalPolicy.DESTROY, // Change to RETAIN for production
    });

    // --- Cognito User Pool Client ---
    this.userPoolClient = new cognito.UserPoolClient(this, 'SalesLedgerAppClient', {
      userPool: this.userPool,
      userPoolClientName: `SalesLedgerWebAppClient-${this.stackName}`,
      authFlows: { userSrp: true, userPassword: true },
      oAuth: {
        scopes: [
          cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.PROFILE, cognito.OAuthScope.COGNITO_ADMIN
        ],
        // callbackUrls: ['http://localhost:5173/callback', 'https://www.salesledgersync.com/callback'], // Configure as needed
        // logoutUrls: ['http://localhost:5173/logout', 'https://www.salesledgersync.com/logout'],   // Configure as needed
      },
      readAttributes: new cognito.ClientAttributes()
        .withStandardAttributes({ email: true, emailVerified: true })
        .withCustomAttributes('company_name'),
      writeAttributes: new cognito.ClientAttributes()
        .withStandardAttributes({ email: true })
        .withCustomAttributes('company_name'),
    });

    // --- Create Admin Group ---
    new cognito.CfnUserPoolGroup(this, 'AdminGroup', {
      userPoolId: this.userPool.userPoolId,
      groupName: 'Admin', // This group name is used in VTL resolvers
      description: 'Administrators with elevated privileges',
    });

    // --- AppSync GraphQL API ---
    this.graphqlApi = new appsync.GraphqlApi(this, 'SalesLedgerAppSyncApi', {
      name: `SalesLedgerApi-${this.stackName}`,
      schema: appsync.SchemaFile.fromAsset(path.join(__dirname, '../graphql/schema.graphql')),
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: appsync.AuthorizationType.USER_POOL,
          userPoolConfig: {
            userPool: this.userPool,
            defaultAction: appsync.UserPoolDefaultAction.ALLOW,
          },
        },
        // If your monthlyReportMailerFunction Lambda needs to call GraphQL via IAM:
        // additionalAuthorizationModes: [{ authorizationType: appsync.AuthorizationType.IAM }],
      },
      logConfig: { fieldLogLevel: appsync.FieldLogLevel.ALL, excludeVerboseContent: false },
      xrayEnabled: true,
    });

    // --- Define DynamoDB Tables ---
    this.ledgerEntryTable = new dynamodb.Table(this, 'LedgerEntryTable', {
      tableName: `LedgerEntry-${this.stackName}`,
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    this.ledgerEntryTable.addGlobalSecondaryIndex({
      indexName: 'byOwner',
      partitionKey: { name: 'owner', type: dynamodb.AttributeType.STRING },
      // Add sort key here if 'createdAt' is used for sorting in GSI queries
      // sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
    });

    this.accountStatusTable = new dynamodb.Table(this, 'AccountStatusTable', {
      tableName: `AccountStatus-${this.stackName}`,
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING }, // Often user's sub if 1-to-1
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    this.accountStatusTable.addGlobalSecondaryIndex({
      indexName: 'byOwner', // Or use primary key if 'id' is 'owner'
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
      // sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
    });

    // --- Define Lambda Functions ---
    const sendPaymentRequestRole = new iam.Role(this, 'SendPaymentRequestRole', { assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'), managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')] });
    this.sendPaymentRequestFunction = new lambda_nodejs.NodejsFunction(this, 'SendPaymentRequestFn', { functionName: `sendPaymentRequestFunction-${this.stackName}`, runtime: lambda.Runtime.NODEJS_20_X, handler: 'handler', entry: path.join(__dirname, '../lambda-handlers/sendPaymentRequest/handler.ts'), role: sendPaymentRequestRole, timeout: Duration.seconds(30), environment: { FROM_EMAIL: 'ross@aurumif.com', USER_POOL_ID: this.userPool.userPoolId, CURRENT_ACCT_TABLE_NAME: this.transactionTable.tableName } });

    const adminDataActionsRole = new iam.Role(this, 'AdminDataActionsRole', { assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'), managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')] });
    this.adminDataActionsFunction = new lambda_nodejs.NodejsFunction(this, 'AdminDataActionsFn', { functionName: `adminDataActionsFunction-${this.stackName}`, runtime: lambda.Runtime.NODEJS_20_X, handler: 'handler', entry: path.join(__dirname, '../lambda-handlers/adminDataActions/handler.ts'), role: adminDataActionsRole, timeout: Duration.seconds(15), environment: { CURRENT_ACCT_TABLE_NAME: this.transactionTable.tableName, LEDGER_ENTRY_TABLE_NAME: this.ledgerEntryTable.tableName, ACCOUNT_STATUS_TABLE_NAME: this.accountStatusTable.tableName } });

    const adminListUsersRole = new iam.Role(this, 'AdminListUsersRole', { assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'), managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')] });
    this.adminListUsersFunction = new lambda_nodejs.NodejsFunction(this, 'AdminListUsersFn', { functionName: `adminListUsersFunction-${this.stackName}`, runtime: lambda.Runtime.NODEJS_20_X, handler: 'handler', entry: path.join(__dirname, '../lambda-handlers/adminListUsers/handler.ts'), role: adminListUsersRole, timeout: Duration.seconds(15), environment: { USER_POOL_ID: this.userPool.userPoolId } });
    
    const monthlyReportMailerRole = new iam.Role(this, 'MonthlyReportMailerRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')]
    });
    this.monthlyReportMailerFunction = new lambda_nodejs.NodejsFunction(this, 'MonthlyReportMailerFunction', {
      functionName: `monthlyReportMailerFunction-${this.stackName}`,
      runtime: lambda.Runtime.NODEJS_LATEST,
      entry: path.join(__dirname, '../lambda-handlers/monthlyReportMailer/index.ts'),
      handler: 'handler',
      role: monthlyReportMailerRole,
      timeout: Duration.minutes(10),
      memorySize: 256,
      environment: {
        USER_POOL_ID: this.userPool.userPoolId,
        LEDGER_TABLE_NAME: this.ledgerEntryTable.tableName,
        TRANSACTION_TABLE_NAME: this.transactionTable.tableName,
        ACCOUNT_STATUS_TABLE_NAME: this.accountStatusTable.tableName, // Added in case mailer needs it
        SES_FROM_ADDRESS: 'ross@aurumif.com', 
        ADMIN_GROUP_NAME: 'Admin', // Pass admin group name to Lambda
      },
      bundling: { minify: false, sourceMap: true, externalModules: ['@aws-sdk/*'] },
    });

    const scheduleRule = new events.Rule(this, 'MonthlyReportScheduleRule', {
      ruleName: `monthlyReportScheduleRule-${this.stackName}`,
      description: 'Triggers monthly report generation on the last day of the month at 21:00 UTC',
      schedule: events.Schedule.cron({ minute: '0', hour: '21', day: 'L', month: '*', year: '*' }),
    });
    scheduleRule.addTarget(new targets.LambdaFunction(this.monthlyReportMailerFunction));

    // --- Apply Permissions to Lambdas ---
    if (this.sendPaymentRequestFunction.role) {
      const role = this.sendPaymentRequestFunction.role as iam.Role;
      role.addToPrincipalPolicy(new iam.PolicyStatement({ actions: ["ses:SendEmail"], resources: ["*"] }));
      role.addToPrincipalPolicy(new iam.PolicyStatement({ actions: ["cognito-idp:AdminGetUser"], resources: [this.userPool.userPoolArn] }));
      this.transactionTable.grantWriteData(role);
    }
    if (this.adminDataActionsFunction.role) {
      const role = this.adminDataActionsFunction.role as iam.Role;
      this.transactionTable.grantReadWriteData(role); // Grant R/W
      this.ledgerEntryTable.grantReadWriteData(role);   // Grant R/W
      this.accountStatusTable.grantReadWriteData(role); // Grant R/W
    }
    if (this.adminListUsersFunction.role) {
      const role = this.adminListUsersFunction.role as iam.Role;
      role.addToPrincipalPolicy(new iam.PolicyStatement({ actions: ['cognito-idp:ListUsers', 'cognito-idp:ListGroupsForUser'], resources: [this.userPool.userPoolArn] }));
    }
    if (this.monthlyReportMailerFunction.role) {
      const role = this.monthlyReportMailerFunction.role as iam.Role;
      role.addToPrincipalPolicy(new iam.PolicyStatement({ actions: ['cognito-idp:ListUsers', 'cognito-idp:ListGroupsForUser'], resources: [this.userPool.userPoolArn] }));
      role.addToPrincipalPolicy(new iam.PolicyStatement({ actions: ['ses:SendRawEmail'], resources: ['*'] }));
      this.ledgerEntryTable.grantReadData(role);
      this.transactionTable.grantReadData(role);
      this.accountStatusTable.grantReadData(role); // Grant read if needed for report
    }

    // --- Create AppSync Data Sources ---
    const ledgerEntryDataSource = this.graphqlApi.addDynamoDbDataSource('LedgerEntryDataSource', this.ledgerEntryTable);
    const accountStatusDataSource = this.graphqlApi.addDynamoDbDataSource('AccountStatusDataSource', this.accountStatusTable);
    const transactionDataSource = this.graphqlApi.addDynamoDbDataSource('TransactionDataSource', this.transactionTable);
    const sendPaymentRequestDataSource = this.graphqlApi.addLambdaDataSource('SendPaymentRequestDataSource', this.sendPaymentRequestFunction);
    const adminDataActionsDataSource = this.graphqlApi.addLambdaDataSource('AdminDataActionsDataSource', this.adminDataActionsFunction);
    const adminListUsersDataSource = this.graphqlApi.addLambdaDataSource('AdminListUsersDataSource', this.adminListUsersFunction);

    // --- Grant AppSync Data Sources Permissions to DynamoDB tables ---
    this.ledgerEntryTable.grantReadWriteData(ledgerEntryDataSource.grantPrincipal);
    this.accountStatusTable.grantReadWriteData(accountStatusDataSource.grantPrincipal);
    this.transactionTable.grantReadWriteData(transactionDataSource.grantPrincipal);

    // --- Create and Attach AppSync Resolvers ---
    // Helper for standard list response
    const listResponseMappingTemplate = appsync.MappingTemplate.fromString(`
      #if($ctx.error) $util.error($ctx.error.message, $ctx.error.type) #end
      { "items": $util.toJson($ctx.result.items), "nextToken": $util.toJson($util.defaultIfNullOrBlank($ctx.result.nextToken, null)) }
    `);

    // == LedgerEntry Resolvers ==
    ledgerEntryDataSource.createResolver('GetLedgerEntryResolver', {
      typeName: 'Query', fieldName: 'getLedgerEntry',
      requestMappingTemplate: appsync.MappingTemplate.dynamoDbGetItem('id', 'id'),
      responseMappingTemplate: appsync.MappingTemplate.dynamoDbResultItem(),
    });
    ledgerEntryDataSource.createResolver('ListLedgerEntriesResolver', {
      typeName: 'Query', fieldName: 'listLedgerEntries',
      requestMappingTemplate: appsync.MappingTemplate.fromFile(path.join(__dirname, '../vtl-templates/ListLedgerEntries.req.vtl')),
      responseMappingTemplate: listResponseMappingTemplate,
    });
    ledgerEntryDataSource.createResolver('CreateLedgerEntryResolver', {
      typeName: 'Mutation', fieldName: 'createLedgerEntry',
      requestMappingTemplate: appsync.MappingTemplate.dynamoDbPutItem(
        appsync.PrimaryKey.partition('id').auto(),
        appsync.Values.projecting('input')
          .attribute('owner').is('$context.identity.sub')
          .attribute('createdAt').is('$util.time.nowISO8601()')
          .attribute('updatedAt').is('$util.time.nowISO8601()')
      ),
      responseMappingTemplate: appsync.MappingTemplate.dynamoDbResultItem(),
    });
    ledgerEntryDataSource.createResolver('UpdateLedgerEntryResolver', {
      typeName: 'Mutation', fieldName: 'updateLedgerEntry',
      requestMappingTemplate: appsync.MappingTemplate.fromFile(path.join(__dirname, '../vtl-templates/UpdateLedgerEntry.req.vtl')),
      responseMappingTemplate: appsync.MappingTemplate.dynamoDbResultItem(),
    });
    ledgerEntryDataSource.createResolver('DeleteLedgerEntryResolver', {
      typeName: 'Mutation', fieldName: 'deleteLedgerEntry',
      requestMappingTemplate: appsync.MappingTemplate.fromFile(path.join(__dirname, '../vtl-templates/DeleteLedgerEntry.req.vtl')),
      responseMappingTemplate: appsync.MappingTemplate.dynamoDbResultItem(),
    });

    // == AccountStatus Resolvers ==
    accountStatusDataSource.createResolver('GetAccountStatusResolver', {
      typeName: 'Query', fieldName: 'getAccountStatus',
      requestMappingTemplate: appsync.MappingTemplate.dynamoDbGetItem('id', 'id'), // Assuming id is owner's sub
      responseMappingTemplate: appsync.MappingTemplate.dynamoDbResultItem(),
    });
    accountStatusDataSource.createResolver('ListAccountStatusesResolver', {
      typeName: 'Query', fieldName: 'listAccountStatuses',
      requestMappingTemplate: appsync.MappingTemplate.fromFile(path.join(__dirname, '../vtl-templates/ListAccountStatusesByOwner.req.vtl')),
      responseMappingTemplate: listResponseMappingTemplate,
    });
    accountStatusDataSource.createResolver('UpdateAccountStatusResolver', {
      typeName: 'Mutation', fieldName: 'updateAccountStatus',
      requestMappingTemplate: appsync.MappingTemplate.fromFile(path.join(__dirname, '../vtl-templates/UpdateAccountStatus.req.vtl')),
      responseMappingTemplate: appsync.MappingTemplate.dynamoDbResultItem(),
    });

    // == CurrentAccountTransaction Resolvers ==
    transactionDataSource.createResolver('GetCurrentAccountTransactionResolver', {
      typeName: 'Query', fieldName: 'getCurrentAccountTransaction',
      requestMappingTemplate: appsync.MappingTemplate.dynamoDbGetItem('id', 'id'),
      responseMappingTemplate: appsync.MappingTemplate.dynamoDbResultItem(),
    });
    transactionDataSource.createResolver('ListCurrentAccountTransactionsResolver', {
      typeName: 'Query', fieldName: 'listCurrentAccountTransactions',
      requestMappingTemplate: appsync.MappingTemplate.fromFile(path.join(__dirname, '../vtl-templates/ListCurrentAccountTransactions.req.vtl')),
      responseMappingTemplate: listResponseMappingTemplate,
    });

    // == Lambda Resolvers ==
    adminDataActionsDataSource.createResolver('AdminAddCashReceiptResolver', { typeName: 'Mutation', fieldName: 'adminAddCashReceipt', requestMappingTemplate: appsync.MappingTemplate.lambdaRequest(), responseMappingTemplate: appsync.MappingTemplate.lambdaResult() });
    adminDataActionsDataSource.createResolver('AdminCreateAccountStatusResolver', { typeName: 'Mutation', fieldName: 'adminCreateAccountStatus', requestMappingTemplate: appsync.MappingTemplate.lambdaRequest(), responseMappingTemplate: appsync.MappingTemplate.lambdaResult() });
    sendPaymentRequestDataSource.createResolver('SendPaymentRequestEmailResolver', { typeName: 'Mutation', fieldName: 'sendPaymentRequestEmail', requestMappingTemplate: appsync.MappingTemplate.lambdaRequest(), responseMappingTemplate: appsync.MappingTemplate.lambdaResult() });
    adminListUsersDataSource.createResolver('AdminListUsersResolver', { typeName: 'Query', fieldName: 'adminListUsers', requestMappingTemplate: appsync.MappingTemplate.lambdaRequest(), responseMappingTemplate: appsync.MappingTemplate.lambdaResult() });

    // --- Stack Outputs ---
    new CfnOutput(this, 'RegionOutput', { value: this.region });
    new CfnOutput(this, 'UserPoolIdOutput', { value: this.userPool.userPoolId });
    new CfnOutput(this, 'UserPoolClientIdOutput', { value: this.userPoolClient.userPoolClientId });
    new CfnOutput(this, 'CompanyNameCustomAttributeOutput', { value: this.companyNameAttributeFullName });
    new CfnOutput(this, 'GraphQLAPIURLOutput', { value: this.graphqlApi.graphqlUrl });
    new CfnOutput(this, 'GraphQLAPIIDOutput', { value: this.graphqlApi.apiId });
    new CfnOutput(this, 'LedgerEntryTableNameOutput', { value: this.ledgerEntryTable.tableName });
    new CfnOutput(this, 'AccountStatusTableNameOutput', { value: this.accountStatusTable.tableName });
    new CfnOutput(this, 'TransactionTableNameOutput', { value: this.transactionTable.tableName });
    // ... Add ARNs if needed for other purposes
    new CfnOutput(this, 'SendPaymentRequestFunctionNameOutput', { value: this.sendPaymentRequestFunction.functionName });
    new CfnOutput(this, 'AdminDataActionsFunctionNameOutput', { value: this.adminDataActionsFunction.functionName });
    new CfnOutput(this, 'AdminListUsersFunctionNameOutput', { value: this.adminListUsersFunction.functionName });
    new CfnOutput(this, 'MonthlyReportMailerFunctionNameOutput', { value: this.monthlyReportMailerFunction.functionName });
    new CfnOutput(this, 'MonthlyReportMailerFunctionArnOutput', { value: this.monthlyReportMailerFunction.functionArn });

  } // End constructor
} // End class