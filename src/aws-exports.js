/* eslint-disable */
// WARNING: DO NOT EDIT. This file is manually generated from CDK Outputs and should be committed.

const awsmobile = {
    // This should match the region where your CDK backend is deployed
    "aws_project_region": "eu-west-1", // From OutputKey: "RegionOutput"

    // --- AppSync (GraphQL API) Configuration ---
    // Using the previously identified URL, as GraphQLAPIURLOutput was null in stack outputs.
    "aws_appsync_graphqlEndpoint": "https://yik7x25zqne6jnnzvymp5c3c7m.appsync-api.eu-west-1.amazonaws.com/graphql", 
    "aws_appsync_region": "eu-west-1", // From OutputKey: "RegionOutput"
    "aws_appsync_authenticationType": "AMAZON_COGNITO_USER_POOLS", // Assumed from your schema's @aws_cognito_user_pools

    // --- Cognito User Pool (Authentication) Configuration ---
    "aws_user_pools_id": "eu-west-1_jIa2hOCaZ", // From OutputKey: "UserPoolIdOutput"
    "aws_user_pools_web_client_id": "3br2lv10rbfjt4v12j3lonemfm", // From OutputKey: "UserPoolClientIdOutput"
    // "aws_cognito_identity_pool_id": "YOUR_IDENTITY_POOL_ID_FROM_CDK_OUTPUT", // OPTIONAL: Only if you have an Identity Pool in your CDK

    // --- OPTIONAL: DynamoDB Table Names (if needed by frontend directly, e.g., for direct SDK calls, though usually via AppSync) ---
    "AccountStatusTableName": "AccountStatus-SalesLedgerApp-Backend-eu-west-1", // From OutputKey: "AccountStatusTableNameOutput"
    "LedgerEntryTableName": "LedgerEntry-SalesLedgerApp-Backend-eu-west-1", // From OutputKey: "LedgerEntryTableNameOutput"
    "TransactionTableName": "Transaction-SalesLedgerApp-Backend-eu-west-1", // From OutputKey: "TransactionTableNameOutput"

    // --- OPTIONAL: Lambda Function Names/ARNs (if frontend directly invokes Lambda) ---
    "AdminListUsersFunctionName": "adminListUsersFunction-SalesLedgerApp-Backend-eu-west-1", // From OutputKey: "AdminListUsersFunctionNameOutput"
    "MonthlyReportMailerFunctionArn": "arn:aws:lambda:eu-west-1:277707134311:function:monthlyReportMailerFunction-SalesLedgerApp-Backend-eu-west-1", // From OutputKey: "MonthlyReportMailerFunctionArnOutput"
    // "SendPaymentRequestFunctionName": "YOUR_FUNCTION_NAME_FROM_CDK_OUTPUT", // This was null in your output
    // "AdminDataActionsFunctionName": "YOUR_FUNCTION_NAME_FROM_CDK_OUTPUT", // This was null in your output
    // "MonthlyReportMailerFunctionName": "YOUR_FUNCTION_NAME_FROM_CDK_OUTPUT", // This was null in your output

    // Add any other specific outputs your frontend directly consumes from your CDK stack
};

export default awsmobile;