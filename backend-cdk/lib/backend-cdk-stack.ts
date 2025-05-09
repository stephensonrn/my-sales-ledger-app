// backend-cdk/lib/backend-cdk-stack.ts
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda_nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path'; // Keep only one import
import { RemovalPolicy, CfnOutput, Duration } from 'aws-cdk-lib';
// Using alpha module for easier VTL MappingTemplate helpers where available
import * as appsync from '@aws-cdk/aws-appsync-alpha';

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
  public readonly adminListUsersFunction: lambda_nodejs.NodejsFunction; // Added
  public readonly graphqlApi: appsync.GraphqlApi;

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
        // callbackUrls: ['http://localhost:5173/callback'],
        // logoutUrls: ['http://localhost:5173/logout'],
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
      groupName: 'Admin',
      description: 'Administrators with elevated privileges',
    });

    // --- AppSync GraphQL API ---
    this.graphqlApi = new appsync.GraphqlApi(this, 'SalesLedgerAppSyncApi', {
      name: `SalesLedgerApi-${this.stackName}`,
      // Ensure your schema.graphql includes the new AdminListUsers query and types
      schema: appsync.SchemaFile.fromAsset(path.join(__dirname, '../graphql/schema.graphql')),
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: appsync.AuthorizationType.USER_POOL,
          userPoolConfig: {
            userPool: this.userPool,
            defaultAction: appsync.UserPoolDefaultAction.ALLOW,
          },
        },
      },
      logConfig: {
        fieldLogLevel: appsync.FieldLogLevel.ALL,
        excludeVerboseContent: false,
      },
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
    });

    // --- Define Lambda Functions ---
    const sendPaymentRequestRole = new iam.Role(this, 'SendPaymentRequestRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')]
    });
    this.sendPaymentRequestFunction = new lambda_nodejs.NodejsFunction(this, 'SendPaymentRequestFn', {
      functionName: `sendPaymentRequestFunction-${this.stackName}`,
      runtime: lambda.Runtime.NODEJS_20_X, handler: 'handler',
      entry: path.join(__dirname, '../lambda-handlers/sendPaymentRequest/handler.ts'), // Corrected Path
      role: sendPaymentRequestRole, timeout: Duration.seconds(30), memorySize: 256,
      environment: { FROM_EMAIL: 'ross@aurumif.com' }, // SET YOUR VERIFIED EMAIL
      bundling: { externalModules: ['@aws-sdk/*'], nodeModules: [], minify: false, sourceMap: true }
    });

    const adminDataActionsRole = new iam.Role(this, 'AdminDataActionsRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')]
    });
    this.adminDataActionsFunction = new lambda_nodejs.NodejsFunction(this, 'AdminDataActionsFn', {
      functionName: `adminDataActionsFunction-${this.stackName}`,
      runtime: lambda.Runtime.NODEJS_20_X, handler: 'handler',
      entry: path.join(__dirname, '../lambda-handlers/adminDataActions/handler.ts'), // Corrected Path
      role: adminDataActionsRole, timeout: Duration.seconds(15),
      environment: { /* Populated later */ },
      bundling: { externalModules: ['@aws-sdk/*'], nodeModules: [], minify: false, sourceMap: true }
    });

    // *** NEW: Admin List Users Function ***
    const adminListUsersRole = new iam.Role(this, 'AdminListUsersRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')]
    });
    this.adminListUsersFunction = new lambda_nodejs.NodejsFunction(this, 'AdminListUsersFn', {
      functionName: `adminListUsersFunction-${this.stackName}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: path.join(__dirname, '../lambda-handlers/adminListUsers/handler.ts'), // Ensure this handler exists
      role: adminListUsersRole,
      timeout: Duration.seconds(15),
      environment: {
          USER_POOL_ID: this.userPool.userPoolId // Pass User Pool ID
      },
      bundling: { externalModules: ['@aws-sdk/*'], nodeModules: [], minify: false, sourceMap: true }
    });
    // *** END NEW Lambda Function ***

    // --- Apply Permissions and Environment Variables to Lambdas ---
    if (this.sendPaymentRequestFunction.role) {
      const role = this.sendPaymentRequestFunction.role;
      role.addToPrincipalPolicy(new iam.PolicyStatement({ actions: ["ses:SendEmail"], resources: ["*"] }));
      role.addToPrincipalPolicy(new iam.PolicyStatement({ actions: ["cognito-idp:AdminGetUser"], resources: [this.userPool.userPoolArn] }));
      this.transactionTable.grantWriteData(role);
      this.sendPaymentRequestFunction.addEnvironment('USER_POOL_ID', this.userPool.userPoolId);
      this.sendPaymentRequestFunction.addEnvironment('CURRENT_ACCT_TABLE_NAME', this.transactionTable.tableName);
    }
    if (this.adminDataActionsFunction.role) {
      const role = this.adminDataActionsFunction.role;
      this.transactionTable.grantWriteData(role);
      this.ledgerEntryTable.grantWriteData(role);
      this.adminDataActionsFunction.addEnvironment('CURRENT_ACCT_TABLE_NAME', this.transactionTable.tableName);
      this.adminDataActionsFunction.addEnvironment('LEDGER_ENTRY_TABLE_NAME', this.ledgerEntryTable.tableName);
    }
    // *** NEW: Permissions for adminListUsersFunction ***
    if (this.adminListUsersFunction.role) {
       const listUsersPolicy = new iam.PolicyStatement({
          actions: ['cognito-idp:ListUsers'],
          resources: [this.userPool.userPoolArn],
       });
       this.adminListUsersFunction.role.addToPrincipalPolicy(listUsersPolicy);
    }
    // *** END NEW Permissions ***

    // --- Create AppSync Data Sources ---
    const ledgerEntryDataSource = this.graphqlApi.addDynamoDbDataSource('LedgerEntryDataSource', this.ledgerEntryTable);
    const accountStatusDataSource = this.graphqlApi.addDynamoDbDataSource('AccountStatusDataSource', this.accountStatusTable);
    const transactionDataSource = this.graphqlApi.addDynamoDbDataSource('TransactionDataSource', this.transactionTable);
    const sendPaymentRequestDataSource = this.graphqlApi.addLambdaDataSource('SendPaymentRequestDataSource', this.sendPaymentRequestFunction);
    const adminDataActionsDataSource = this.graphqlApi.addLambdaDataSource('AdminDataActionsDataSource', this.adminDataActionsFunction);
    // *** NEW: Add Admin List Users Data Source ***
    const adminListUsersDataSource = this.graphqlApi.addLambdaDataSource(
        'AdminListUsersDataSource',
        this.adminListUsersFunction
    );
    // *** END NEW Data Source ***

    // --- Grant Read/Write Permissions to DDB Data Sources ---
    this.ledgerEntryTable.grantReadWriteData(ledgerEntryDataSource.grantPrincipal); // Combined grant
    this.accountStatusTable.grantReadWriteData(accountStatusDataSource.grantPrincipal); // Combined grant
    this.transactionTable.grantReadData(transactionDataSource.grantPrincipal); // Only needs read for Get/List

    // --- Create and Attach Resolvers ---

    // == LedgerEntry Resolvers (Using fromFile where needed) ==
    ledgerEntryDataSource.createResolver('GetLedgerEntryResolver', {
      typeName: 'Query', fieldName: 'getLedgerEntry',
      requestMappingTemplate: appsync.MappingTemplate.dynamoDbGetItem('id', 'id'),
      responseMappingTemplate: appsync.MappingTemplate.dynamoDbResultItem(),
    });

    ledgerEntryDataSource.createResolver('ListLedgerEntriesResolver', {
      typeName: 'Query', fieldName: 'listLedgerEntries',
      requestMappingTemplate: appsync.MappingTemplate.fromFile(
        path.join(__dirname, 'vtl-templates/ListLedgerEntries.req.vtl')
      ),
      responseMappingTemplate: appsync.MappingTemplate.fromString(`
        #if($ctx.error) $util.error($ctx.error.message, $ctx.error.type) #end
        { "items": $util.toJson($ctx.result.items), "nextToken": $util.toJson($util.defaultIfNullOrBlank($ctx.result.nextToken, null)) }
      `),
    });

    ledgerEntryDataSource.createResolver('CreateLedgerEntryResolver', {
      typeName: 'Mutation', fieldName: 'createLedgerEntry',
      requestMappingTemplate: appsync.MappingTemplate.dynamoDbPutItem(
        appsync.PrimaryKey.partition('id').auto(),
        appsync.Values.projecting('input')
          .attribute('owner').is('$context.identity.sub') // Using sub
          .attribute('createdAt').is('$util.time.nowISO8601()')
          .attribute('updatedAt').is('$util.time.nowISO8601()')
      ),
      responseMappingTemplate: appsync.MappingTemplate.dynamoDbResultItem(),
    });

    ledgerEntryDataSource.createResolver('UpdateLedgerEntryResolver', {
        typeName: 'Mutation', fieldName: 'updateLedgerEntry',
        requestMappingTemplate: appsync.MappingTemplate.fromFile(
          path.join(__dirname, 'vtl-templates/UpdateLedgerEntry.req.vtl')
        ),
        responseMappingTemplate: appsync.MappingTemplate.dynamoDbResultItem(),
    });

    ledgerEntryDataSource.createResolver('DeleteLedgerEntryResolver', {
      typeName: 'Mutation', fieldName: 'deleteLedgerEntry',
      requestMappingTemplate: appsync.MappingTemplate.fromFile(
        path.join(__dirname, 'vtl-templates/DeleteLedgerEntry.req.vtl')
      ),
      responseMappingTemplate: appsync.MappingTemplate.dynamoDbResultItem(),
    });

    // == AccountStatus Resolvers (Using fromFile where needed) ==
    accountStatusDataSource.createResolver('GetAccountStatusResolver', {
      typeName: 'Query', fieldName: 'getAccountStatus',
      requestMappingTemplate: appsync.MappingTemplate.dynamoDbGetItem('id', 'id'),
      responseMappingTemplate: appsync.MappingTemplate.dynamoDbResultItem(),
    });

    accountStatusDataSource.createResolver('ListAccountStatusesResolver', {
      typeName: 'Query', fieldName: 'listAccountStatuses',
      // Using Scan for now. If you create ListAccountStatuses.req.vtl, change to fromFile
      requestMappingTemplate: appsync.MappingTemplate.dynamoDbScanTable(),
      responseMappingTemplate: appsync.MappingTemplate.fromString(`
          #if($ctx.error) $util.error($ctx.error.message, $ctx.error.type) #end
          { "items": $util.toJson($ctx.result.items), "nextToken": $util.toJson($util.defaultIfNullOrBlank($ctx.result.nextToken, null)) }
      `),
    });

    accountStatusDataSource.createResolver('UpdateAccountStatusResolver', {
      typeName: 'Mutation', fieldName: 'updateAccountStatus',
      requestMappingTemplate: appsync.MappingTemplate.fromFile(
        path.join(__dirname, 'vtl-templates/UpdateAccountStatus.req.vtl')
      ),
      responseMappingTemplate: appsync.MappingTemplate.dynamoDbResultItem(),
    });

    // == CurrentAccountTransaction Resolvers (Using fromFile where needed) ==
    transactionDataSource.createResolver('GetCurrentAccountTransactionResolver', {
      typeName: 'Query', fieldName: 'getCurrentAccountTransaction',
      requestMappingTemplate: appsync.MappingTemplate.dynamoDbGetItem('id', 'id'),
      responseMappingTemplate: appsync.MappingTemplate.dynamoDbResultItem(),
    });

    transactionDataSource.createResolver('ListCurrentAccountTransactionsResolver', {
      typeName: 'Query', fieldName: 'listCurrentAccountTransactions',
      requestMappingTemplate: appsync.MappingTemplate.fromFile(
        path.join(__dirname, 'vtl-templates/ListCurrentAccountTransactions.req.vtl')
      ),
      responseMappingTemplate: appsync.MappingTemplate.fromString(`
        #if($ctx.error) $util.error($ctx.error.message, $ctx.error.type) #end
        { "items": $util.toJson($ctx.result.items), "nextToken": $util.toJson($util.defaultIfNullOrBlank($ctx.result.nextToken, null)) }
      `),
    });

    // == Lambda Resolvers (Including NEW one) ==
    adminDataActionsDataSource.createResolver('AdminAddCashReceiptResolver', {
      typeName: 'Mutation', fieldName: 'adminAddCashReceipt',
      requestMappingTemplate: appsync.MappingTemplate.lambdaRequest(),
      responseMappingTemplate: appsync.MappingTemplate.lambdaResult(),
    });

    sendPaymentRequestDataSource.createResolver('SendPaymentRequestEmailResolver', {
      typeName: 'Mutation', fieldName: 'sendPaymentRequestEmail',
      requestMappingTemplate: appsync.MappingTemplate.lambdaRequest(),
      responseMappingTemplate: appsync.MappingTemplate.lambdaResult(),
    });

    // *** NEW: Resolver for adminListUsers query ***
    adminListUsersDataSource.createResolver('AdminListUsersResolver', {
        typeName: 'Query',
        fieldName: 'adminListUsers',
        requestMappingTemplate: appsync.MappingTemplate.lambdaRequest(),
        responseMappingTemplate: appsync.MappingTemplate.lambdaResult(),
    });
    // *** END NEW Resolver ***


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
    new CfnOutput(this, 'LedgerEntryTableArnOutput', { value: this.ledgerEntryTable.tableArn });
    new CfnOutput(this, 'AccountStatusTableArnOutput', { value: this.accountStatusTable.tableArn });
    new CfnOutput(this, 'TransactionTableArnOutput', { value: this.transactionTable.tableArn });
    new CfnOutput(this, 'SendPaymentRequestFunctionNameOutput', { value: this.sendPaymentRequestFunction.functionName });
    new CfnOutput(this, 'SendPaymentRequestFunctionArnOutput', { value: this.sendPaymentRequestFunction.functionArn });
    new CfnOutput(this, 'AdminDataActionsFunctionNameOutput', { value: this.adminDataActionsFunction.functionName });
    new CfnOutput(this, 'AdminDataActionsFunctionArnOutput', { value: this.adminDataActionsFunction.functionArn });
    // *** NEW: Outputs for Admin List Users Function ***
    new CfnOutput(this, 'AdminListUsersFunctionNameOutput', { value: this.adminListUsersFunction.functionName });
    new CfnOutput(this, 'AdminListUsersFunctionArnOutput', { value: this.adminListUsersFunction.functionArn });
    // *** END NEW Outputs ***

  } // End constructor
} // End class