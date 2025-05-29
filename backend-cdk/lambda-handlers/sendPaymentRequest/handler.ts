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
const marshallOptions = { removeUndefinedValues: true };
const translateConfig = { marshallOptions };
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient, translateConfig);

// Interface for the GraphQL arguments, reflecting the SendPaymentRequestInput type
interface SendPaymentRequestArgs {
  input: {
    amount: number;
  };
}

// Interface for the Cognito identity object from AppSync event
interface AppSyncCognitoIdentity {
  claims?: { [key: string]: any; email?: string; };
  sub: string; // 'sub' is the user's unique identifier from Cognito
  username: string; // 'username' in Cognito
  sourceIp?: string[];
  groups: string[] | null;
  [key: string]: any;
}

// Main Lambda handler function
export const handler: AppSyncResolverHandler<SendPaymentRequestArgs, string> = async (event) => {
  const FROM_EMAIL = process.env.FROM_EMAIL;
  const TO_EMAIL = "ross@aurumif.com"; // Hardcoded recipient for the notification
  const USER_POOL_ID = process.env.USER_POOL_ID;
  const CURRENT_ACCT_TABLE_NAME = process.env.CURRENT_ACCT_TABLE_NAME;

  console.log('SEND PAYMENT REQUEST EVENT:', JSON.stringify(event, null, 2));

  // Validate Environment Variables
  if (!FROM_EMAIL || FROM_EMAIL.includes('example.com') || !TO_EMAIL) {
    console.error('FROM_EMAIL or TO_EMAIL environment variable not set correctly.');
    throw new Error('Configuration error: Email settings are incomplete.');
  }
  if (!USER_POOL_ID) {
    console.warn('USER_POOL_ID environment variable not set. User email lookup might be limited.');
  }
  if (!CURRENT_ACCT_TABLE_NAME) {
    console.error('CURRENT_ACCT_TABLE_NAME environment variable not set. Cannot record transaction.');
    // Depending on requirements, you might throw an error here or allow email to send but log failure to record.
    // For now, let's allow email to proceed but log the issue.
  }

  // Extract & Validate Arguments
  if (!event.arguments || !event.arguments.input) {
    console.error("Invalid arguments: 'input' object is missing.");
    throw new Error("Invalid arguments: 'input' object with amount is required.");
  }
  const requestedAmount = event.arguments.input.amount; // <<< CORRECTED: Access amount via input object
  
  console.log('Extracted requestedAmount:', requestedAmount);
  if (typeof requestedAmount !== 'number' || requestedAmount <= 0) {
    console.error("Invalid amount type or value:", requestedAmount);
    throw new Error('Invalid payment amount provided. Amount must be a positive number.');
  }

  // Extract User Identity
  const identity = event.identity as AppSyncCognitoIdentity | null;
  if (!identity || !identity.sub) {
    console.error("User identity or sub is missing. Cannot process payment request.");
    throw new Error("User identity not found. Unable to process request.");
  }
  console.log('Identity Object:', JSON.stringify(identity, null, 2));
  
  let userIdentifierForEmailMessage: string = identity.username || identity.sub; // Fallback to sub if username somehow missing
  const ownerIdForDbRecord: string = identity.sub; // Always use 'sub' for owner consistency in DB

  // Attempt to get the user's email attribute for a more friendly identifier in the notification
  if (identity.username && USER_POOL_ID) {
    try {
      console.log(`Attempting AdminGetUser for username: ${identity.username} in pool ${USER_POOL_ID}`);
      const getUserCommand = new AdminGetUserCommand({ UserPoolId: USER_POOL_ID, Username: identity.username });
      const userData = await cognitoClient.send(getUserCommand);
      console.log("AdminGetUser Response Attributes:", JSON.stringify(userData.UserAttributes));
      const emailAttribute = userData.UserAttributes?.find(attr => attr.Name === 'email');
      if (emailAttribute?.Value) {
        userIdentifierForEmailMessage = emailAttribute.Value;
        console.log(`Found email via AdminGetUser: ${userIdentifierForEmailMessage}`);
      } else {
        console.log("Email attribute not found via AdminGetUser for username:", identity.username);
      }
    } catch (cognitoError: any) {
      console.error(`Error calling AdminGetUser for ${identity.username} (check IAM permissions for Lambda role):`, cognitoError);
      // Continue with username/sub as identifier if email fetch fails
    }
  }
  console.log('Resolved User Identifier (for email message):', userIdentifierForEmailMessage);
  console.log('Owner ID (for DB record):', ownerIdForDbRecord);

  // Construct Email
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

  // Send Email
  try {
    console.log(`Attempting to send email from ${FROM_EMAIL} to ${TO_EMAIL}`);
    await sesClient.send(new SendEmailCommand(sendEmailParams));
    console.log("Email send command issued successfully.");
    emailSentSuccessfully = true;
  } catch (error: any) {
    console.error("Error sending email via SES (check Lambda IAM permissions for ses:SendEmail on the Source ARN and for sending):", error);
    const errorMessage = error.message || 'Internal SES Error';
    // We still want to try and record the transaction if the email fails, but notify about email failure.
    // Or, you could decide to throw here and not record the transaction if email is critical.
    // For now, we will proceed to record transaction and include email error in response.
    transactionRecordError = `Email notification failed (${errorMessage}).`; 
  }

  // Record Transaction in DynamoDB
  if (CURRENT_ACCT_TABLE_NAME && ownerIdForDbRecord) {
    transactionId = ulid();
    const timestamp = new Date().toISOString();
    const transactionItem = {
      id: transactionId,
      owner: ownerIdForDbRecord, // User making the request
      type: 'PAYMENT_REQUEST',   // From CurrentAccountTransactionType enum
      amount: requestedAmount,
      description: `Payment Request submitted by user`, // Or include more details
      createdAt: timestamp,
      updatedAt: timestamp,
      __typename: 'CurrentAccountTransaction' // For GraphQL
    };
    try {
      console.log("Attempting to put item into DynamoDB Table:", CURRENT_ACCT_TABLE_NAME, JSON.stringify(transactionItem));
      const putCommand = new PutCommand({ TableName: CURRENT_ACCT_TABLE_NAME, Item: transactionItem });
      await ddbDocClient.send(putCommand);
      console.log("CurrentAccountTransaction record created successfully with ID:", transactionId);
    } catch (dbError: any) {
      console.error("Error creating CurrentAccountTransaction record (check DDB permissions for Lambda role):", dbError);
      const dbErrorMessage = dbError.message || 'DB Write Error';
      // If email also failed, append. Otherwise, set.
      transactionRecordError = transactionRecordError 
        ? `${transactionRecordError} Additionally, transaction recording failed (${dbErrorMessage}).`
        : `Transaction recording failed (${dbErrorMessage}).`;
      transactionId = null; // Ensure transactionId is null if DB write failed
    }
  } else {
    if (!CURRENT_ACCT_TABLE_NAME) console.error("Cannot record transaction - CURRENT_ACCT_TABLE_NAME env var missing.");
    if (!ownerIdForDbRecord) console.error("Cannot record transaction - ownerIdForDbRecord is missing.");
    transactionRecordError = transactionRecordError 
        ? `${transactionRecordError} Additionally, transaction recording was skipped due to missing config/ownerId.`
        : "Transaction recording skipped due to missing config/ownerId.";
  }

  // Final Return Message based on schema (String)
  if (emailSentSuccessfully && !transactionRecordError) {
    return `Payment request for £${requestedAmount.toFixed(2)} submitted and recorded successfully. Transaction ID: ${transactionId}.`;
  } else if (emailSentSuccessfully && transactionRecordError) {
    return `Payment request for £${requestedAmount.toFixed(2)} submitted (email sent), but ${transactionRecordError}`;
  } else if (!emailSentSuccessfully && !transactionRecordError) {
    // This case means email failed, but DDB config was also missing, so no DDB error message to append
     return `Payment request for £${requestedAmount.toFixed(2)} failed: Email notification failed. Transaction not recorded due to missing config.`;
  } else { // !emailSentSuccessfully && transactionRecordError
    return `Payment request for £${requestedAmount.toFixed(2)} failed: ${transactionRecordError}`;
  }
};