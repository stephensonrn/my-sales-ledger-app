// backend-cdk/lambda-handlers/sendPaymentRequest/handler.ts

import type { AppSyncResolverEvent } from 'aws-lambda';
import { SESClient, SendEmailCommand, type SendEmailCommandInput } from "@aws-sdk/client-ses";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { ulid } from "ulid";

const sesClient = new SESClient({ region: process.env.AWS_REGION });
const ddbClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

interface SendPaymentRequestInput {
  toEmail: string;
  subject: string;
  body: string;
  amount: number;
  companyName?: string;
}

export const handler = async (event: AppSyncResolverEvent<{ input: SendPaymentRequestInput }>): Promise<string> => {
  const FROM_EMAIL = process.env.FROM_EMAIL;
  const CURRENT_ACCT_TABLE_NAME = process.env.CURRENT_ACCT_TABLE_NAME;

  if (!FROM_EMAIL || !CURRENT_ACCT_TABLE_NAME) {
    throw new Error('Configuration error: Missing required environment variables.');
  }

  const args = event.arguments.input;
  if (!args || typeof args.amount !== 'number' || args.amount <= 0 || !args.toEmail) {
    throw new Error("Invalid arguments: 'amount' and 'toEmail' are required.");
  }

  const identity = event.identity as any;
  if (!identity || !identity.sub || !identity.username) {
    throw new Error("User identity not found. Unable to process request.");
  }
  
  const ownerId = identity.sub;
  const requesterUsername = identity.username;

  const companyName = args.companyName || 'An unspecified company';
  const emailBody = `A payment request has been submitted.\n\n` +
                    `Company: ${companyName}\n` +
                    `User: ${requesterUsername}\n` +
                    `Amount Requested: £${args.amount.toFixed(2)}\n\n` +
                    `This is an automated notification.`;
  
  const emailSubject = `Payment Request from ${companyName}`;

  const sendEmailParams: SendEmailCommandInput = {
    Source: FROM_EMAIL,
    Destination: { ToAddresses: [args.toEmail] },
    Message: {
      Subject: { Data: emailSubject },
      Body: { Text: { Data: emailBody } }
    }
  };

  try {
    await sesClient.send(new SendEmailCommand(sendEmailParams));
  } catch (emailError: any) {
    console.error("Failed to send email via SES:", emailError);
    throw new Error(`Email notification failed: ${emailError.message}`);
  }

  const transactionId = ulid();
  const now = new Date().toISOString();
  
  const transactionItem = {
    id: transactionId,
    owner: ownerId,
    type: 'PAYMENT_REQUEST',
    amount: args.amount,
    description: `Payment Request from ${companyName}`,
    status: 'EMAIL_SENT',
    createdAt: now,
    updatedAt: now,
    __typename: 'CurrentAccountTransaction',
  };

  try {
    await ddbDocClient.send(new PutCommand({
      TableName: CURRENT_ACCT_TABLE_NAME,
      Item: transactionItem
    }));
  } catch (dbError: any) {
    console.error("Failed to record transaction in DynamoDB:", dbError);
  }
  
  return `Payment request for £${args.amount.toFixed(2)} sent successfully.`;
};
