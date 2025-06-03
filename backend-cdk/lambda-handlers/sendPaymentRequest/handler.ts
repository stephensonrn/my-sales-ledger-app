// backend-cdk/lambda-handlers/sendPaymentRequest/handler.ts

import type { AppSyncResolverEvent, AppSyncIdentityCognito } from 'aws-lambda';
import { SESClient, SendEmailCommand, type SendEmailCommandInput } from "@aws-sdk/client-ses";
import { CognitoIdentityProviderClient, AdminGetUserCommand, type AdminGetUserCommandInput } from "@aws-sdk/client-cognito-identity-provider";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { ulid } from "ulid";

const sesClient = new SESClient({ region: process.env.AWS_REGION });
const cognitoClient = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION });
const ddbClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient, {
  marshallOptions: { removeUndefinedValues: true }
});

interface LambdaEventArguments { // Renamed for clarity: these are the direct event args
  toEmail: string;
  subject: string;
  body: string;
  amount: number;
}

interface AppSyncCognitoIdentity {
  claims?: { [key: string]: any; email?: string };
  sub: string;
  username: string;
  sourceIp?: string[];
  groups: string[] | null;
  issuer?: string;
  defaultAuthStrategy?: string;
}

// AppSyncResolverEvent's first generic is for the event.arguments type
export const handler: AppSyncResolverHandler<LambdaEventArguments, string> = async (event) => {
  const FROM_EMAIL = process.env.FROM_EMAIL;
  const USER_POOL_ID = process.env.USER_POOL_ID;
  const CURRENT_ACCT_TABLE_NAME = process.env.CURRENT_ACCT_TABLE_NAME;

  console.log('LAMBDA EVENT (sendPaymentRequestEmail):', JSON.stringify(event, null, 2));

  if (!FROM_EMAIL || FROM_EMAIL.includes('example.com') || FROM_EMAIL.trim() === '') {
    console.error('Configuration error: FROM_EMAIL environment variable is missing or invalid.');
    throw new Error('Configuration error: Email service is not properly configured (sender).');
  }
  if (!CURRENT_ACCT_TABLE_NAME) {
    console.error('Configuration error: CURRENT_ACCT_TABLE_NAME environment variable is missing.');
    throw new Error('Configuration error: Transaction recording service is unavailable.');
  }
  if (!USER_POOL_ID) {
    console.warn('Warning: USER_POOL_ID environment variable not set. User detail lookup may be limited.');
  }

  // --- CORRECTED ARGUMENT ACCESS ---
  // The arguments are directly in event.arguments (which is the first generic type of AppSyncResolverHandler)
  // For a direct Lambda proxy where VTL outputs the argument map, 'event' itself might not have 'arguments' field
  // but AppSync structures the event so that the VTL output becomes event.arguments for the handler type.
  // However, the log shows the arguments are at the root of the 'event' object itself when VTL ends with $util.toJson(map).
  // So, we access them directly from 'event' if they are top-level.
  // The AppSyncResolverHandler<TArgs, TResult> means TArgs refers to event.arguments.
  // Since your log shows them at root, we'll cast 'event' to 'any' or use a more direct event type.
  // Let's assume for AppSync direct Lambda proxy, the VTL output IS the event.

  const actualArgs = event.arguments as LambdaEventArguments; // If VTL passes args to AppSync's $context.arguments
                                                           // More likely from log, they are at event root.

  // Given your log: LAMBDA EVENT (sendPaymentRequestEmail): { "toEmail": ..., "subject": ..., ... }
  // This indicates the VTL output $util.toJson($lambdaEventArgs) made $lambdaEventArgs the *entire* event.
  // So, we should access them from the event directly.
  const directEventArgs = event as any as LambdaEventArguments; // Casting 'event' directly if args are at root

  console.log("Direct event args received by Lambda:", JSON.stringify(directEventArgs, null, 2));

  // Validate fields from directEventArgs
  if (!directEventArgs || typeof directEventArgs.amount !== 'number' || directEventArgs.amount <= 0) {
    throw new Error("Invalid arguments: 'amount' is required and must be a positive number.");
  }
  if (typeof directEventArgs.toEmail !== 'string' || directEventArgs.toEmail.trim() === '') {
    throw new Error("Invalid arguments: 'toEmail' is required.");
  }
  if (typeof directEventArgs.subject !== 'string' || directEventArgs.subject.trim() === '') {
    throw new Error("Invalid arguments: 'subject' is required.");
  }
  if (typeof directEventArgs.body !== 'string' || directEventArgs.body.trim() === '') {
    throw new Error("Invalid arguments: 'body' is required.");
  }

  const requestedAmount = directEventArgs.amount;
  const recipientEmail = directEventArgs.toEmail;
  const emailSubjectFromArgs = directEventArgs.subject;
  const emailBodyFromArgs = directEventArgs.body;
  // --- END CORRECTED ARGUMENT ACCESS ---

  console.log('Request details: Amount=', requestedAmount, 'To=', recipientEmail, 'Subject=', emailSubjectFromArgs);

  const identity = event.identity as AppSyncCognitoIdentity | null;
  if (!identity || !identity.sub) {
    console.error("User identity not found in event.identity.");
    throw new Error("User identity not found. Unable to process request.");
  }
  console.log('User identity:', JSON.stringify(identity, null, 2));

  const ownerIdForDbRecord: string = identity.sub;
  let userIdentifierForEmailMessage: string = identity.username || identity.sub;

  if (identity.username && USER_POOL_ID) {
    try {
      const getUserParams: AdminGetUserCommandInput = { UserPoolId: USER_POOL_ID, Username: identity.username };
      const userData = await cognitoClient.send(new AdminGetUserCommand(getUserParams));
      const emailAttribute = userData.UserAttributes?.find(attr => attr.Name === 'email');
      if (emailAttribute?.Value) userIdentifierForEmailMessage = emailAttribute.Value;
    } catch (cognitoError: any) {
      console.warn(`Could not fetch details for user ${identity.username}:`, cognitoError.message);
    }
  }

  const sendEmailParams: SendEmailCommandInput = {
    Source: FROM_EMAIL,
    Destination: { ToAddresses: [recipientEmail] },
    Message: { Subject: { Data: emailSubjectFromArgs }, Body: { Text: { Data: emailBodyFromArgs } } }
  };

  let emailSentSuccessfully = false;
  let transactionProcessingError: string | null = null;
  const transactionId = ulid();

  try {
    await sesClient.send(new SendEmailCommand(sendEmailParams));
    emailSentSuccessfully = true;
    console.log("Email sent successfully.");
  } catch (emailError: any) {
    console.error("Failed to send email via SES:", emailError);
    transactionProcessingError = `Email notification failed (${emailError.name}: ${emailError.message || 'Unknown SES error'}).`;
  }

  if (CURRENT_ACCT_TABLE_NAME) {
    try {
      const now = new Date().toISOString();
      const transactionItem = {
        id: transactionId, owner: ownerIdForDbRecord, type: 'PAYMENT_REQUEST',
        amount: requestedAmount, description: `Payment Request: ${emailSubjectFromArgs}`,
        status: emailSentSuccessfully ? 'EMAIL_SENT' : 'EMAIL_FAILED',
        createdAt: now, updatedAt: now, __typename: 'CurrentAccountTransaction',
      };
      await ddbDocClient.send(new PutCommand({ TableName: CURRENT_ACCT_TABLE_NAME, Item: transactionItem }));
      console.log("Transaction recorded successfully with ID:", transactionId);
    } catch (dbError: any) {
      console.error("Failed to record transaction in DynamoDB:", dbError);
      const dbMsg = dbError.message || 'Unknown DynamoDB error';
      transactionProcessingError = transactionProcessingError ? `${transactionProcessingError} Additionally, DB error (${dbMsg}).` : `DB error (${dbMsg}).`;
    }
  } else {
    console.warn("CURRENT_ACCT_TABLE_NAME not configured. Skipping transaction recording.");
    if (!transactionProcessingError && !emailSentSuccessfully) {
        transactionProcessingError = (transactionProcessingError || "") + " Transaction recording service not configured.";
    }
  }

  if (emailSentSuccessfully && !transactionProcessingError) {
    return `Payment request for £${requestedAmount.toFixed(2)} to ${recipientEmail} processed. Email sent and transaction recorded (ID: ${transactionId}).`;
  } else if (emailSentSuccessfully && transactionProcessingError) {
    return `Payment request for £${requestedAmount.toFixed(2)} to ${recipientEmail} processed. Email sent, but issue during processing: ${transactionProcessingError}. Ref ID: ${transactionId}.`;
  } else {
    let finalMessage = `Failed to send payment request email for £${requestedAmount.toFixed(2)} to ${recipientEmail}.`;
    if (transactionProcessingError) finalMessage += ` Error: ${transactionProcessingError}`;
    if (transactionId && CURRENT_ACCT_TABLE_NAME) finalMessage += ` Ref ID (attempted): ${transactionId}.`;
    console.error("Final error state for sendPaymentRequestEmail:", finalMessage);
    return finalMessage;
  }
};