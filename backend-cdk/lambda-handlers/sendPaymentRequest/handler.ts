// backend-cdk/lambda-handlers/sendPaymentRequest/handler.ts
import type { AppSyncResolverHandler } from 'aws-lambda';
import { SESClient, SendEmailCommand, type SendEmailCommandInput } from "@aws-sdk/client-ses";
import { CognitoIdentityProviderClient, AdminGetUserCommand } from "@aws-sdk/client-cognito-identity-provider";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { ulid } from "ulid";

// Initialize AWS SDK Clients
const sesClient = new SESClient({});
const cognitoClient = new CognitoIdentityProviderClient({});
const ddbClient = new DynamoDBClient({});
const marshallOptions = { removeUndefinedValues: true };
const translateConfig = { marshallOptions };
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient, translateConfig);

// Interface for the scalar GraphQL arguments
interface SendPaymentRequestEmailArgs {
    amount: number; // Amount is now a direct argument
}

// Interface for the Cognito identity object
interface AppSyncCognitoIdentity {
    claims?: { [key: string]: any; email?: string; };
    sub?: string;
    username?: string;
    sourceIp?: string[];
    [key: string]: any;
}

// Main Lambda handler function
export const handler: AppSyncResolverHandler<SendPaymentRequestEmailArgs, string | null> = async (event) => {
    // Read Environment Variables (These need to be set via CDK escape hatch or manually)
    const FROM_EMAIL = process.env.FROM_EMAIL;
    const TO_EMAIL = "ross@aurumif.com"; // Hardcoded recipient
    const USER_POOL_ID = process.env.USER_POOL_ID;
    const CURRENT_ACCT_TABLE_NAME = process.env.CURRENT_ACCT_TABLE_NAME;

    console.log('SEND PAYMENT REQUEST EVENT:', JSON.stringify(event, null, 2));

    // Validate Environment Variables
    if (!FROM_EMAIL || FROM_EMAIL.includes('example.com')) {
        console.error('FROM_EMAIL environment variable not set correctly.');
        return 'Error: Lambda configuration error (FROM_EMAIL).';
    }
    if (!USER_POOL_ID) { console.warn('USER_POOL_ID env var not set. Cannot perform email lookup.'); }
    if (!CURRENT_ACCT_TABLE_NAME) { console.error('CURRENT_ACCT_TABLE_NAME env var not set. Cannot record transaction.'); }

    // Extract & Validate Arguments
    console.log('Arguments Received:', JSON.stringify(event.arguments));
    const requestedAmount = event.arguments?.amount; // Access amount directly
    console.log('Extracted requestedAmount:', requestedAmount);
    if (typeof requestedAmount !== 'number' || requestedAmount <= 0) {
        console.error("Invalid amount type or value:", requestedAmount);
        return 'Error: Invalid payment amount provided.';
    }

    // Extract User Identity
    const identity = event.identity as AppSyncCognitoIdentity | null;
    console.log('Identity Object:', JSON.stringify(identity, null, 2));
    let userIdentifierForEmail: string = 'Unknown User';
    let ownerId: string | undefined = identity?.sub || identity?.username;
    const cognitoUsernameForLookup = identity?.username;

    if (cognitoUsernameForLookup && USER_POOL_ID) {
        userIdentifierForEmail = cognitoUsernameForLookup; // Default identifier
        try {
            console.log(`Attempting AdminGetUser for username: ${cognitoUsernameForLookup} in pool ${USER_POOL_ID}`);
            const getUserCommand = new AdminGetUserCommand({ UserPoolId: USER_POOL_ID, Username: cognitoUsernameForLookup });
            const userData = await cognitoClient.send(getUserCommand);
            console.log("AdminGetUser Response Attributes:", JSON.stringify(userData.UserAttributes));
            const emailAttribute = userData.UserAttributes?.find(attr => attr.Name === 'email');
            if (emailAttribute?.Value) {
                userIdentifierForEmail = emailAttribute.Value; // Use email if found
                console.log(`Found email via AdminGetUser: ${userIdentifierForEmail}`);
            } else { console.log("Email attribute not found via AdminGetUser."); }
        } catch (cognitoError: any) { console.error("Error calling AdminGetUser (check IAM permissions):", cognitoError); }
    } else if (ownerId) { userIdentifierForEmail = ownerId; }
    if (!ownerId){ console.error("Owner ID (sub/username) missing from identity."); userIdentifierForEmail = "Unknown (ID missing)"; }
    console.log('Resolved User Identifier (for email):', userIdentifierForEmail);
    console.log('Owner ID (for DB record):', ownerId);

    // Construct Email
    const emailSubject = `Payment Request Received`;
    const emailBody = `A payment request for £${requestedAmount.toFixed(2)} has been submitted by user: ${userIdentifierForEmail}.`;
    const sendEmailParams: SendEmailCommandInput = {
        Source: FROM_EMAIL, Destination: { ToAddresses: [TO_EMAIL] },
        Message: { Subject: { Data: emailSubject }, Body: { Text: { Data: emailBody } } }
    };

    let emailSentSuccessfully = false;
    let transactionRecordError: string | null = null;

    // Send Email
    try {
        console.log(`Attempting to send email from ${FROM_EMAIL} to ${TO_EMAIL}`);
        await sesClient.send(new SendEmailCommand(sendEmailParams));
        console.log("Email send command issued successfully.");
        emailSentSuccessfully = true;
    } catch (error: any) {
        console.error("Error sending email via SES (check Lambda IAM permissions for ses:SendEmail):", error);
        const errorMessage = error.message || 'Internal SES Error';
        return `Error: Failed to send email notification (${errorMessage}). Please contact support.`;
    }

    // Record Transaction if Email Sent
    if (emailSentSuccessfully) {
        if (!CURRENT_ACCT_TABLE_NAME) {
             console.error("Cannot record transaction - table name env var missing.");
             transactionRecordError = "Transaction recording failed (config error).";
        } else if (!ownerId) {
             console.error("Cannot create transaction record: Owner ID is missing from identity.");
             transactionRecordError = "Transaction recording failed (missing owner).";
        } else {
            const transactionId = ulid();
            const timestamp = new Date().toISOString();
            const transactionItem = {
                id: transactionId, owner: ownerId, type: 'PAYMENT_REQUEST',
                amount: requestedAmount, description: `Payment Request`,
                createdAt: timestamp, updatedAt: timestamp,
                __typename: 'CurrentAccountTransaction'
            };
            try {
                console.log("Attempting to put item into DynamoDB Table:", CURRENT_ACCT_TABLE_NAME);
                const putCommand = new PutCommand({ TableName: CURRENT_ACCT_TABLE_NAME, Item: transactionItem });
                await ddbDocClient.send(putCommand);
                console.log("CurrentAccountTransaction record created successfully.");
            } catch (dbError: any) {
                console.error("Error creating CurrentAccountTransaction record (check DDB permissions):", dbError);
                transactionRecordError = `Transaction recording failed (${dbError.message || 'DB Error'}).`;
            }
        }
    }

    // Final Return Message
    let finalMessage = `Payment request for £${requestedAmount!.toFixed(2)} submitted successfully.`;
    if (transactionRecordError) { finalMessage += ` ${transactionRecordError}`; }
    return finalMessage;

}; // End of handler