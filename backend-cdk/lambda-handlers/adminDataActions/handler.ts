import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { ulid } from "ulid"; // For generating unique IDs

// Environment Variables (set these in your CDK stack definition for the Lambda)
const DDB_TABLE_TRANSACTIONS = process.env.CURRENT_ACCT_TABLE_NAME;
const DDB_TABLE_ACCOUNT_STATUS = process.env.ACCOUNT_STATUS_TABLE_NAME;
const AWS_REGION = process.env.AWS_REGION || "eu-west-1"; // Fallback region if not set
const ADMIN_GROUP_NAME = process.env.ADMIN_GROUP_NAME || "Admin";

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

type CurrentAccountTransactionType =
  | "CASH_RECEIPT"
  | "PAYMENT_REQUEST"
  // add other types if needed
  ;

interface CurrentAccountTransaction {
  id: string;
  owner: string;
  type: CurrentAccountTransactionType;
  amount: number;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  createdByAdmin?: string;
  __typename: string;
}

interface AccountStatus {
  id: string;
  owner: string;
  totalUnapprovedInvoiceValue: number;
  createdAt: string;
  updatedAt: string;
  createdByAdmin?: string;
  __typename: string;
}

// Helper: check if caller is admin
function isAdmin(groups: string[] | null | undefined): boolean {
  return !!groups?.includes(ADMIN_GROUP_NAME);
}

// Helper: create a CurrentAccountTransaction object
function createTransaction(
  owner: string,
  type: CurrentAccountTransactionType,
  amount: number,
  description: string | null,
  adminSub?: string
): CurrentAccountTransaction {
  const now = new Date().toISOString();
  return {
    id: ulid(),
    owner,
    type,
    amount,
    description,
    createdAt: now,
    updatedAt: now,
    createdByAdmin: adminSub,
    __typename: "CurrentAccountTransaction",
  };
}

export const handler = async (event: AppSyncEvent): Promise<any> => {
  console.log("AdminDataActionsFunction event:", JSON.stringify(event, null, 2));

  // Enforce Admin group membership here if desired
  if (!isAdmin(event.identity?.groups)) {
    console.error("Unauthorized: Caller is not in Admin group.");
    throw new Error("Unauthorized");
  }

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

      const newTransaction = createTransaction(
        targetOwnerId,
        "CASH_RECEIPT",
        amount,
        description || null,
        adminSub
      );

      try {
        await ddbDocClient.send(
          new PutCommand({
            TableName: DDB_TABLE_TRANSACTIONS,
            Item: newTransaction,
            ConditionExpression: "attribute_not_exists(id)", // Prevent accidental overwrite
          })
        );
        console.log("Successfully added cash receipt:", newTransaction);
        return newTransaction;
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

      const now = new Date().toISOString();
      const newAccountStatus: AccountStatus = {
        id: ownerId,
        owner: ownerId,
        totalUnapprovedInvoiceValue: initialUnapprovedInvoiceValue,
        createdAt: now,
        updatedAt: now,
        createdByAdmin: adminSub,
        __typename: "AccountStatus",
      };

      try {
        await ddbDocClient.send(
          new PutCommand({
            TableName: DDB_TABLE_ACCOUNT_STATUS,
            Item: newAccountStatus,
          })
        );
        console.log("Successfully created/updated account status:", newAccountStatus);
        return newAccountStatus;
      } catch (error: any) {
        console.error("Error creating/updating account status in DynamoDB:", error);
        throw new Error(`Failed to create/update account status: ${error.message}`);
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

      const { targetUserId: paymentTargetUser, amount: paymentAmount } = paymentInput;

      // TODO: Add your payment gateway / SES email notification logic here.

      const paymentRequestTransaction = createTransaction(
        paymentTargetUser,
        "PAYMENT_REQUEST",
        paymentAmount,
        `Admin-initiated payment request by ${adminSub}`,
        adminSub
      );

      try {
        await ddbDocClient.send(
          new PutCommand({
            TableName: DDB_TABLE_TRANSACTIONS,
            Item: paymentRequestTransaction,
          })
        );
        console.log("PAYMENT_REQUEST transaction created:", paymentRequestTransaction);

        // Returning object instead of string for consistency
        return {
          message: `Admin successfully initiated payment request for ${paymentAmount} for user ${paymentTargetUser}.`,
          transactionId: paymentRequestTransaction.id,
        };
      } catch (dbError: any) {
        console.error("Error creating PAYMENT_REQUEST transaction:", dbError);
        throw new Error(`Failed to log payment request transaction: ${dbError.message}`);
      }
    }

    default:
      console.error("Unknown admin action in AdminDataActionsFunction:", event.info.fieldName);
      throw new Error(`Unsupported admin action: ${event.info.fieldName}`);
  }
};
