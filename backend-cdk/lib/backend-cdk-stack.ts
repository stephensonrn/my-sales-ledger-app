// backend-cdk/lib/backend-cdk-stack.ts
// ATTEMPT_MAY30_COMPLETE_WITH_LAMBDA_ENTRY_FIXES
// ATTEMPT_MAY30_COMPLETE_WITH_LAMBDA_ENTRY_FIXES Trival change 1457
// ATTEMPT_MAY30_COMPLETE_WITH_LAMBDA_ENTRY_FIXES Trival change 1504
// ATTEMPT_MAY30_COMPLETE_WITH_LAMBDA_ENTRY_FIXES Trival change 1513
// ATTEMPT_MAY30_COMPLETE_WITH_LAMBDA_ENTRY_FIXES Trival change 1529

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

    cdk.Tags.of(this).add('Project', 'SalesLedger');
    cdk.Tags.of(this).add('Environment', props?.env?.region || 'dev');
    cdk.Tags.of(this).add('DeploymentFocus', 'FixLambdaEntryPathsAndResponseVTL');

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

    // --- Define Lambda Functions with corrected entry paths ---
    const sendPaymentRequestRole = new iam.Role(this, 'SendPaymentRequestRole', { assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'), managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')] });
    this.sendPaymentRequestFunction = new lambda_nodejs.NodejsFunction(this, 'SendPaymentRequestFn', {
        ...nodeJsFunctionProps,
        functionName: `sendPaymentRequestFunction-${this.stackName}`,
        handler: 'handler',
        entry: path.join(__dirname, '../lambda-handlers/sendPaymentRequest/handler.ts'), // Corrected
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
        }
    });

    const adminDataActionsRole = new iam.Role(this, 'AdminDataActionsRole', { assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'), managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')] });
    this.adminDataActionsFunction = new lambda_nodejs.NodejsFunction(this, 'AdminDataActionsFn', {
        ...nodeJsFunctionProps,
        functionName: `adminDataActionsFunction-${this.stackName}`,
        handler: 'handler',
        entry: path.join(__dirname, '../lambda-handlers/adminDataActions/handler.ts'), // Corrected
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
        }
    });

    const adminListUsersRole = new iam.Role(this, 'AdminListUsersRole', { assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'), managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')] });
    this.adminListUsersFunction = new lambda_nodejs.NodejsFunction(this, 'AdminListUsersFn', {
        ...nodeJsFunctionProps,
        functionName: `adminListUsersFunction-${this.stackName}`,
        handler: 'handler',
        entry: path.join(__dirname, '../lambda-handlers/adminListUsers/handler.ts'), // Corrected
        role: adminListUsersRole,
        timeout: Duration.seconds(15),
        environment: { USER_POOL_ID: this.userPool.userPoolId },
        bundling: {
            ...nodeJsFunctionProps.bundling,
            externalModules: ['@aws-sdk/client-cognito-identity-provider'],
        }
    });
    
    const monthlyReportMailerRole = new iam.Role(this, 'MonthlyReportMailerRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')]
    });
    this.monthlyReportMailerFunction = new lambda_nodejs.NodejsFunction(this, 'MonthlyReportMailerFunction', {
      ...nodeJsFunctionProps,
      functionName: `monthlyReportMailerFunction-${this.stackName}`,
      entry: path.join(__dirname, '../lambda-handlers/monthlyReportMailer/index.ts'), // Corrected (assuming index.ts is the entry)
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
      }
    });

    const scheduleRule = new events.Rule(this, 'MonthlyReportScheduleRule', {
      ruleName: `monthlyReportScheduleRule-${this.stackName}`,
      description: 'Triggers monthly report generation on the last day of the month at 21:00 UTC',
      schedule: events.Schedule.cron({ minute: '0', hour: '21', day: 'L', month: '*', year: '*' }),
    });
    scheduleRule.addTarget(new targets.LambdaFunction(this.monthlyReportMailerFunction));

    // --- Apply Permissions to Lambdas (Ensure these are complete and correct) ---
    if (sendPaymentRequestRole) {
      sendPaymentRequestRole.addToPrincipalPolicy(new iam.PolicyStatement({ actions: ["ses:SendEmail"], resources: ["*"] })); 
      sendPaymentRequestRole.addToPrincipalPolicy(new iam.PolicyStatement({ actions: ["cognito-idp:AdminGetUser"], resources: [this.userPool.userPoolArn] }));
      this.transactionTable.grantWriteData(sendPaymentRequestRole);
    }
    if (adminDataActionsRole) { 
      this.transactionTable.grantReadWriteData(adminDataActionsRole); 
      this.ledgerEntryTable.grantReadWriteData(adminDataActionsRole);  
      this.accountStatusTable.grantReadWriteData(adminDataActionsRole);
      adminDataActionsRole.addToPrincipalPolicy(new iam.PolicyStatement({ actions: ["ses:SendEmail"], resources: ["*"] })); 
      adminDataActionsRole.addToPrincipalPolicy(new iam.PolicyStatement({ actions: ["cognito-idp:AdminGetUser"], resources: [this.userPool.userPoolArn] }));
    }
    if (adminListUsersRole) {
      adminListUsersRole.addToPrincipalPolicy(new iam.PolicyStatement({ actions: ['cognito-idp:ListUsers', 'cognito-idp:ListGroupsForUser'], resources: [this.userPool.userPoolArn] }));
    }
    if (monthlyReportMailerRole) {
      monthlyReportMailerRole.addToPrincipalPolicy(new iam.PolicyStatement({ actions: ['cognito-idp:ListUsers', 'cognito-idp:ListGroupsForUser'], resources: [this.userPool.userPoolArn] }));
      monthlyReportMailerRole.addToPrincipalPolicy(new iam.PolicyStatement({ actions: ['ses:SendRawEmail'], resources: ['*'] }));
      this.ledgerEntryTable.grantReadData(monthlyReportMailerRole);
      this.transactionTable.grantReadData(monthlyReportMailerRole);
      this.accountStatusTable.grantReadData(monthlyReportMailerRole);
    }

    // --- Create AppSync Data Sources ---
    const ledgerEntryDataSource = this.graphqlApi.addDynamoDbDataSource('LedgerEntryDataSource', this.ledgerEntryTable);
    const accountStatusDataSource = this.graphqlApi.addDynamoDbDataSource('AccountStatusDataSource', this.accountStatusTable);
    const transactionDataSource = this.graphqlApi.addDynamoDbDataSource('TransactionDataSource', this.transactionTable);
    const sendPaymentRequestDataSource = this.graphqlApi.addLambdaDataSource('SendPaymentRequestDataSource', this.sendPaymentRequestFunction);
    const adminDataActionsDataSource = this.graphqlApi.addLambdaDataSource('AdminDataActionsDataSource', this.adminDataActionsFunction);
    const adminListUsersDataSource = this.graphqlApi.addLambdaDataSource('AdminListUsersDataSource', this.adminListUsersFunction);

    this.ledgerEntryTable.grantReadWriteData(ledgerEntryDataSource.grantPrincipal);
    this.accountStatusTable.grantReadWriteData(accountStatusDataSource.grantPrincipal);
    this.transactionTable.grantReadWriteData(transactionDataSource.grantPrincipal);

    // --- Create and Attach AppSync Resolvers ---

    // **** CORRECTED listResponseMappingTemplate with SAFER LOGGING and CORRECT RETURN ****
    const listResponseMappingTemplate = appsync.MappingTemplate.fromString(`
      ## RESP_VTL_LOGGED_FINAL_FIX - May 30 
      $util.qr($ctx.log.info("RESPONSE_MAPPER_DEBUG --- List Query Response (Field: " + $ctx.info.fieldName + ") ---"))
      
      #set( $logCtxError = $util.toJson($ctx.error) )
      $util.qr($ctx.log.info("RESPONSE_MAPPER_DEBUG: ctx.error (from DDB or request VTL): " + $logCtxError))
      
      #set( $logCtxResult = $util.toJson($ctx.result) )
      $util.qr($ctx.log.info("RESPONSE_MAPPER_DEBUG: ctx.result (raw from DDB): " + $logCtxResult))
      
      #set( $logRawNextToken = "null" ) 
      #if( !$util.isNull($ctx.result) )
        #set( $logRawNextToken = $util.toJson($ctx.result.nextToken) )
      #end
      $util.qr($ctx.log.info("RESPONSE_MAPPER_DEBUG: Raw nextToken from ctx.result: " + $logRawNextToken))

      #if($ctx.error)
        $util.qr($ctx.log.info("RESPONSE_MAPPER_DEBUG: Error detected in ctx.error. Calling $util.error to return GraphQL error."))
        $util.error($ctx.error.message, $ctx.error.type)
      #end

      #set( $processedItems = [] ) 
      #if( !$util.isNull($ctx.result) && !$util.isNull($ctx.result.items) )
        #if( !$util.isList($ctx.result.items) )
          #set( $itemsWarningValue = $util.toJson($ctx.result.items) )
          $util.qr($ctx.log.warn("RESPONSE_MAPPER_DEBUG: Warning - ctx.result.items is present but not a list. Value: " + $itemsWarningValue))
        #else
          #set( $processedItems = $ctx.result.items )
        #end
      #else
        $util.qr($ctx.log.info("RESPONSE_MAPPER_DEBUG: ctx.result or ctx.result.items is null/undefined. items defaults to empty list [] for response."))
      #end

      #set( $processedNextToken = $util.defaultIfNullOrBlank($ctx.result.nextToken, null) )
      
      #set( $logProcessedItems = $util.toJson($processedItems) )
      $util.qr($ctx.log.info("RESPONSE_MAPPER_DEBUG: Processed items for final map: " + $logProcessedItems))
      
      #set( $logProcessedNextToken = $util.toJson($processedNextToken) )
      $util.qr($ctx.log.info("RESPONSE_MAPPER_DEBUG: Processed nextToken for final map: " + $logProcessedNextToken))

      {
        "items": $processedItems,
        "nextToken": $processedNextToken
      }
    `);
    // **** END CORRECTED listResponseMappingTemplate ****

    const getItemResponseMappingTemplate = appsync.MappingTemplate.dynamoDbResultItem();

    // == LedgerEntry Resolvers ==
    ledgerEntryDataSource.createResolver('GetLedgerEntryResolver', { typeName: 'Query', fieldName: 'getLedgerEntry', requestMappingTemplate: appsync.MappingTemplate.dynamoDbGetItem('id', 'id'), responseMappingTemplate: getItemResponseMappingTemplate });
    ledgerEntryDataSource.createResolver('ListLedgerEntriesResolver', { typeName: 'Query', fieldName: 'listLedgerEntries', requestMappingTemplate: appsync.MappingTemplate.fromFile(path.join(__dirname, '../vtl-templates/ListLedgerEntries.req.vtl')), responseMappingTemplate: listResponseMappingTemplate });
    ledgerEntryDataSource.createResolver('CreateLedgerEntryResolver', { typeName: 'Mutation', fieldName: 'createLedgerEntry', requestMappingTemplate: appsync.MappingTemplate.fromFile(path.join(__dirname, '../vtl-templates/CreateLedgerEntry.req.vtl')), responseMappingTemplate: getItemResponseMappingTemplate });
    ledgerEntryDataSource.createResolver('UpdateLedgerEntryResolver', { typeName: 'Mutation', fieldName: 'updateLedgerEntry', requestMappingTemplate: appsync.MappingTemplate.fromFile(path.join(__dirname, '../vtl-templates/UpdateLedgerEntry.req.vtl')), responseMappingTemplate: getItemResponseMappingTemplate });
    ledgerEntryDataSource.createResolver('DeleteLedgerEntryResolver', { typeName: 'Mutation', fieldName: 'deleteLedgerEntry', requestMappingTemplate: appsync.MappingTemplate.fromFile(path.join(__dirname, '../vtl-templates/DeleteLedgerEntry.req.vtl')), responseMappingTemplate: getItemResponseMappingTemplate });
    ledgerEntryDataSource.createResolver('AdminCreateLedgerEntryResolver', { typeName: 'Mutation', fieldName: 'adminCreateLedgerEntry', requestMappingTemplate: appsync.MappingTemplate.fromFile(path.join(__dirname, '../vtl-templates/AdminCreateLedgerEntry.req.vtl')), responseMappingTemplate: getItemResponseMappingTemplate });

    // == AccountStatus Resolvers ==
    accountStatusDataSource.createResolver('GetAccountStatusResolver', { typeName: 'Query', fieldName: 'getAccountStatus', requestMappingTemplate: appsync.MappingTemplate.dynamoDbGetItem('id', 'id'), responseMappingTemplate: getItemResponseMappingTemplate });
    accountStatusDataSource.createResolver('ListAccountStatusesResolverV2', { // <<< CHANGED Logical ID
  typeName: 'Query', 
  fieldName: 'listAccountStatuses', 
  requestMappingTemplate: appsync.MappingTemplate.fromFile(path.join(__dirname, '../vtl-templates/ListAccountStatusesByOwner.req.vtl')), 
  responseMappingTemplate: listResponseMappingTemplate 
});
    accountStatusDataSource.createResolver('UpdateAccountStatusResolver', { typeName: 'Mutation', fieldName: 'updateAccountStatus', requestMappingTemplate: appsync.MappingTemplate.fromFile(path.join(__dirname, '../vtl-templates/UpdateAccountStatus.req.vtl')), responseMappingTemplate: getItemResponseMappingTemplate });

    // == CurrentAccountTransaction Resolvers ==
    transactionDataSource.createResolver('GetCurrentAccountTransactionResolver', { typeName: 'Query', fieldName: 'getCurrentAccountTransaction', requestMappingTemplate: appsync.MappingTemplate.dynamoDbGetItem('id', 'id'), responseMappingTemplate: getItemResponseMappingTemplate });
    transactionDataSource.createResolver('ListCurrentAccountTransactionsResolver', { typeName: 'Query', fieldName: 'listCurrentAccountTransactions', requestMappingTemplate: appsync.MappingTemplate.fromFile(path.join(__dirname, '../vtl-templates/ListCurrentAccountTransactions.req.vtl')), responseMappingTemplate: listResponseMappingTemplate });

    // == Lambda Resolvers (Ensure full properties) ==
    adminDataActionsDataSource.createResolver('AdminAddCashReceiptResolver', { 
      typeName: 'Mutation', 
      fieldName: 'adminAddCashReceipt', 
      requestMappingTemplate: appsync.MappingTemplate.lambdaRequest(), 
      responseMappingTemplate: appsync.MappingTemplate.lambdaResult() 
    });
    adminDataActionsDataSource.createResolver('AdminCreateAccountStatusResolver', { 
      typeName: 'Mutation', 
      fieldName: 'adminCreateAccountStatus', 
      requestMappingTemplate: appsync.MappingTemplate.lambdaRequest(), 
      responseMappingTemplate: appsync.MappingTemplate.lambdaResult() 
    });
    sendPaymentRequestDataSource.createResolver('SendPaymentRequestEmailResolver', { 
      typeName: 'Mutation', 
      fieldName: 'sendPaymentRequestEmail', 
      requestMappingTemplate: appsync.MappingTemplate.lambdaRequest(), 
      responseMappingTemplate: appsync.MappingTemplate.lambdaResult() 
    });
    adminListUsersDataSource.createResolver('AdminListUsersResolver', { 
      typeName: 'Query', 
      fieldName: 'adminListUsers', 
      requestMappingTemplate: appsync.MappingTemplate.lambdaRequest(), 
      responseMappingTemplate: appsync.MappingTemplate.lambdaResult() 
    });
    adminDataActionsDataSource.createResolver('AdminRequestPaymentForUserResolver', { 
      typeName: 'Mutation', 
      fieldName: 'adminRequestPaymentForUser', 
      requestMappingTemplate: appsync.MappingTemplate.lambdaRequest(), 
      responseMappingTemplate: appsync.MappingTemplate.lambdaResult() 
    });

    // --- Stack Outputs ---
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