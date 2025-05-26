import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { ulid } from "ulid"; // For generating unique IDs

// Environment Variables (set these in your CDK stack definition for the Lambda)
const DDB_TABLE_TRANSACTIONS = process.env.CURRENT_ACCT_TABLE_NAME;
const DDB_TABLE_ACCOUNT_STATUS = process.env.ACCOUNT_STATUS_TABLE_NAME;
const AWS_REGION = process.env.AWS_REGION || "eu-west-1"; // Fallback region if not set

if (!DDB_TABLE_TRANSACTIONS || !DDB_TABLE_ACCOUNT_STATUS) {
  throw new Error(
    "Missing required environment variables: CURRENT_ACCT_TABLE_NAME and/or ACCOUNT_STATUS_TABLE_NAME"
  );
}

const ddbClient = new DynamoDBClient({ region: AWS_REGION });
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

interface AppSyncEventArguments {
  // For adminAddCashReceipt
  targetOwnerId?: string;
  amount?: number;
  description?: string;

  // For adminCreateAccountStatus
  ownerId?: string;
  initialUnapprovedInvoiceValue?: number;

  // For adminRequestPaymentForUser (nested in input)
  input?: {
    targetUserId?: string;
    amount?: number;
    // add other fields from AdminRequestPaymentForUserInput if any
  };
}

interface AppSyncEvent {
  arguments: AppSyncEventArguments;
  identity: {
    sub: string;
    username: string;
    groups: string[] | null;
    // other identity fields...
  };
  info: {
    fieldName: string; // e.g., "adminAddCashReceipt"
    parentTypeName: string; // e.g., "Mutation"
    // ... other info
  };
}

export const handler = async (event: AppSyncEvent): Promise<any> => {
  console.log(
    "AdminDataActionsFunction event:",
    JSON.stringify(event, null, 2)
  );

  // Optional: Double-check admin authorization if not solely relying on AppSync @auth directive
  // if (!event.identity?.groups?.includes("Admin")) {
  //   console.error("Unauthorized: Caller is not in Admin group based on event.identity.groups.");
  //   throw new Error("Unauthorized"); // This will result in a GraphQL error
  // }

  const now = new Date().toISOString();
  const adminSub = event.identity?.sub; // ID of the admin performing the action

  switch (event.info.fieldName) {
    case "adminAddCashReceipt": {
      const { targetOwnerId, amount, description } = event.arguments;

      if (!targetOwnerId || typeof amount !== "number") {
        console.error("adminAddCashReceipt: Missing targetOwnerId or amount.");
        throw new Error(
          "Missing required arguments for adminAddCashReceipt: targetOwnerId and amount."
        );
      }

      const newTransaction = {
        id: ulid(),
        owner: targetOwnerId,
        type: "CASH_RECEIPT", // From CurrentAccountTransactionType enum
        amount: amount,
        description: description || null,
        createdAt: now,
        updatedAt: now,
        createdByAdmin: adminSub, // Optional: track which admin
        __typename: "CurrentAccountTransaction", // Helps AppSync map the response
      };

      try {
        await ddbDocClient.send(
          new PutCommand({
            TableName: DDB_TABLE_TRANSACTIONS,
            Item: newTransaction,
            ConditionExpression: "attribute_not_exists(id)", // Prevent accidental overwrite
          })
        );
        console.log("Successfully added cash receipt:", newTransaction);
        return newTransaction; // Return the created CurrentAccountTransaction object
      } catch (error: any) {
        console.error("Error adding cash receipt to DynamoDB:", error);
        throw new Error(`Failed to add cash receipt: ${error.message}`);
      }
    }

    case "adminCreateAccountStatus": {
      const { ownerId, initialUnapprovedInvoiceValue } = event.arguments;

      if (!ownerId || typeof initialUnapprovedInvoiceValue !== "number") {
        console.error(
          "adminCreateAccountStatus: Missing ownerId or initialUnapprovedInvoiceValue."
        );
        throw new Error(
          "Missing required arguments for adminCreateAccountStatus: ownerId and initialUnapprovedInvoiceValue."
        );
      }

      const newAccountStatus = {
        id: ownerId, // AccountStatus ID is the owner's ID (sub)
        owner: ownerId,
        totalUnapprovedInvoiceValue: initialUnapprovedInvoiceValue,
        createdAt: now,
        updatedAt: now,
        createdByAdmin: adminSub, // Optional: track which admin
        __typename: "AccountStatus", // Helps AppSync map the response
      };

      try {
        await ddbDocClient.send(
          new PutCommand({
            TableName: DDB_TABLE_ACCOUNT_STATUS,
            Item: newAccountStatus,
            // No ConditionExpression means it will create or overwrite
          })
        );
        console.log(
          "Successfully created/updated account status:",
          newAccountStatus
        );
        return newAccountStatus; // Return the created/updated AccountStatus object
      } catch (error: any) {
        console.error(
          "Error creating/updating account status in DynamoDB:",
          error
        );
        throw new Error(
          `Failed to create/update account status: ${error.message}`
        );
      }
    }

    case "adminRequestPaymentForUser": {
      const paymentInput = event.arguments.input;
      if (
        !paymentInput ||
        !paymentInput.targetUserId ||
        typeof paymentInput.amount !== "number"
      ) {
        console.error(
          "adminRequestPaymentForUser: Missing input, input.targetUserId, or input.amount."
        );
        throw new Error(
          "Missing required arguments for adminRequestPaymentForUser: input.targetUserId and input.amount."
        );
      }

      const { targetUserId: paymentTargetUser, amount: paymentAmount } =
        paymentInput;

      // TODO: Implement your actual payment request logic.
      // This might involve:
      // 1. Checking target user's available funds (may require DynamoDB Get/Query on AccountStatus or Transactions).
      //    (Ensure this Lambda has read permissions if so).
      // 2. Creating a 'PAYMENT_REQUEST' transaction in DDB_TABLE_TRANSACTIONS.
      // 3. Sending an email notification via SES (Lambda would need SES permissions).
      // 4. Integrating with a payment gateway if applicable.

      console.log(
        `Admin (${adminSub}) initiating payment request of ${paymentAmount} for user ${paymentTargetUser}. (Placeholder logic)`
      );
      
      // Example of creating a PAYMENT_REQUEST transaction:
      const paymentRequestTransaction = {
        id: ulid(),
        owner: paymentTargetUser,
        type: "PAYMENT_REQUEST", // From CurrentAccountTransactionType enum
        amount: paymentAmount,
        description: `Admin-initiated payment request by ${adminSub}`,
        createdAt: now,
        updatedAt: now,
        createdByAdmin: adminSub,
        __typename: "CurrentAccountTransaction"
      };

      try {
        await ddbDocClient.send(
          new PutCommand({
            TableName: DDB_TABLE_TRANSACTIONS,
            Item: paymentRequestTransaction,
          })
        );
        console.log("PAYMENT_REQUEST transaction created:", paymentRequestTransaction);
        // Your GraphQL schema for adminRequestPaymentForUser returns String.
        // If you want to return the transaction object, you'd change the schema.
        return `Admin successfully initiated payment request for ${paymentAmount} for user ${paymentTargetUser}. Transaction ID: ${paymentRequestTransaction.id}`;
      } catch (dbError: any) {
        console.error("Error creating PAYMENT_REQUEST transaction:", dbError);
        // Even if transaction logging fails, the "request" might have other steps.
        // Decide how to handle partial failures.
        throw new Error(`Failed to log payment request transaction: ${dbError.message}`);
      }
    }

    default:
      console.error("Unknown admin action in AdminDataActionsFunction:", event.info.fieldName);
      throw new Error(`Unsupported admin action: ${event.info.fieldName}`);
  }
};