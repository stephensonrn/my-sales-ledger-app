// backend-cdk/lambda-handlers/sendPaymentRequest/handler.ts

import type { AppSyncResolverHandler } from 'aws-lambda';
import { SESClient, SendEmailCommand, type SendEmailCommandInput } from "@aws-sdk/client-ses";
import { CognitoIdentityProviderClient, AdminGetUserCommand } from "@aws-sdk/client-cognito-identity-provider";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { ulid } from "ulid";

// Initialize AWS SDK Clients
const sesClient = new SESClient({ region: process.env.AWS_REGION });
const cognitoClient = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION });
const ddbClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient, {
  marshallOptions: { removeUndefinedValues: true }
});

// Input argument interface matching GraphQL input type
interface SendPaymentRequestArgs {
  input: {
    amount: number;
  };
}

// Interface for Cognito Identity in AppSync event
interface AppSyncCognitoIdentity {
  claims?: { [key: string]: any; email?: string };
  sub: string;
  username: string;
  sourceIp?: string[];
  groups: string[] | null;
  [key: string]: any;
}

export const handler: AppSyncResolverHandler<SendPaymentRequestArgs, string> = async (event) => {
  const FROM_EMAIL = process.env.FROM_EMAIL;
  const TO_EMAIL = "ross@aurumif.com"; // Hardcoded recipient - change or make configurable if needed
  const USER_POOL_ID = process.env.USER_POOL_ID;
  const CURRENT_ACCT_TABLE_NAME = process.env.CURRENT_ACCT_TABLE_NAME;

  console.log('SEND PAYMENT REQUEST EVENT:', JSON.stringify(event, null, 2));

  // Validate critical environment variables (throw early)
  if (!FROM_EMAIL || FROM_EMAIL.includes('example.com')) {
    throw new Error('Configuration error: FROM_EMAIL environment variable is missing or invalid.');
  }
  if (!TO_EMAIL) {
    throw new Error('Configuration error: TO_EMAIL environment variable is missing.');
  }
  if (!CURRENT_ACCT_TABLE_NAME) {
    throw new Error('Configuration error: CURRENT_ACCT_TABLE_NAME environment variable is missing. Cannot record transaction.');
  }
  if (!USER_POOL_ID) {
    console.warn('Warning: USER_POOL_ID environment variable not set. Email user lookup may be limited.');
  }

  // Validate event arguments
  if (!event.arguments || !event.arguments.input) {
    throw new Error("Invalid arguments: 'input' object with 'amount' is required.");
  }

  const requestedAmount = event.arguments.input.amount;
  if (typeof requestedAmount !== 'number' || requestedAmount <= 0) {
    throw new Error('Invalid payment amount provided. Amount must be a positive number.');
  }
  console.log('Requested amount:', requestedAmount);

  // Extract Cognito Identity info from event
  const identity = event.identity as AppSyncCognitoIdentity | null;
  if (!identity || !identity.sub) {
    throw new Error("User identity not found. Unable to process request.");
  }
  console.log('User identity:', JSON.stringify(identity, null, 2));

  // Use username or fallback to sub for notification
  let userIdentifierForEmailMessage: string = identity.username || identity.sub;
  const ownerIdForDbRecord: string = identity.sub;

  // Try to get user email from Cognito for nicer notification
  if (identity.username && USER_POOL_ID) {
    try {
      console.log(`Fetching user email for username: ${identity.username}`);
      const getUserCommand = new AdminGetUserCommand({
        UserPoolId: USER_POOL_ID,
        Username: identity.username
      });
      const userData = await cognitoClient.send(getUserCommand);
      const emailAttribute = userData.UserAttributes?.find(attr => attr.Name === 'email');
      if (emailAttribute?.Value) {
        userIdentifierForEmailMessage = emailAttribute.Value;
        console.log(`Email found for user: ${userIdentifierForEmailMessage}`);
      }
    } catch (cognitoError: any) {
      console.error(`Failed to fetch user email for ${identity.username}:`, cognitoError);
      // Continue with username/sub as fallback
    }
  }

  // Prepare email parameters
  const emailSubject = `Payment Request Received - £${requestedAmount.toFixed(2)}`;
  const emailBody = `A payment request for £${requestedAmount.toFixed(2)} has been submitted by user: ${userIdentifierForEmailMessage} (User Sub: ${ownerIdForDbRecord}).`;

  const sendEmailParams: SendEmailCommandInput = {
    Source: FROM_EMAIL,
    Destination: { ToAddresses: [TO_EMAIL] },
    Message: {
      Subject: { Data: emailSubject },
      Body: { Text: { Data: emailBody } }
    }
  };

  let emailSentSuccessfully = false;
  let transactionRecordError: string | null = null;
  let transactionId: string | null = null;

  // Send the notification email
  try {
    console.log(`Sending email from ${FROM_EMAIL} to ${TO_EMAIL}`);
    await sesClient.send(new SendEmailCommand(sendEmailParams));
    console.log("Email sent successfully.");
    emailSentSuccessfully = true;
  } catch (emailError: any) {
    console.error("Failed to send email:", emailError);
    transactionRecordError = `Email notification failed (${emailError.message || 'Unknown error'}).`;
  }

  // Record transaction in DynamoDB
  try {
    transactionId = ulid();
    const now = new Date().toISOString();
    const transactionItem = {
      id: transactionId,
      owner: ownerIdForDbRecord,
      type: 'PAYMENT_REQUEST',
      amount: requestedAmount,
      description: `Payment Request submitted by user`,
      createdAt: now,
      updatedAt: now,
      __typename: 'CurrentAccountTransaction',
    };

    console.log("Recording transaction in DynamoDB:", transactionItem);
    await ddbDocClient.send(new PutCommand({
      TableName: CURRENT_ACCT_TABLE_NAME,
      Item: transactionItem
    }));
    console.log("Transaction recorded successfully with ID:", transactionId);
  } catch (dbError: any) {
    console.error("Failed to record transaction in DynamoDB:", dbError);
    const dbMsg = dbError.message || 'Unknown error';
    transactionRecordError = transactionRecordError
      ? `${transactionRecordError} Additionally, transaction recording failed (${dbMsg}).`
      : `Transaction recording failed (${dbMsg}).`;
    transactionId = null;
  }

  // Return status message
  if (emailSentSuccessfully && !transactionRecordError) {
    return `Payment request for £${requestedAmount.toFixed(2)} submitted and recorded successfully. Transaction ID: ${transactionId}.`;
  } else if (emailSentSuccessfully && transactionRecordError) {
    return `Payment request for £${requestedAmount.toFixed(2)} submitted (email sent), but ${transactionRecordError}`;
  } else if (!emailSentSuccessfully && !transactionRecordError) {
    return `Payment request for £${requestedAmount.toFixed(2)} failed: Email notification failed. Transaction not recorded due to missing config.`;
  } else {
    return `Payment request for £${requestedAmount.toFixed(2)} failed: ${transactionRecordError}`;
  }
};
