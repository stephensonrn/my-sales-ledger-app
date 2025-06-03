import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { ulid } from "ulid";

const DDB_TABLE_TRANSACTIONS = process.env.CURRENT_ACCT_TABLE_NAME;
const DDB_TABLE_ACCOUNT_STATUS = process.env.ACCOUNT_STATUS_TABLE_NAME;
const AWS_REGION = process.env.AWS_REGION || "eu-west-1";
const ADMIN_GROUP_NAME = process.env.ADMIN_GROUP_NAME || "Admin";

if (!DDB_TABLE_TRANSACTIONS || !DDB_TABLE_ACCOUNT_STATUS) {
  throw new Error("Missing required environment variables.");
}

const ddbClient = new DynamoDBClient({ region: AWS_REGION });
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

interface AppSyncEventArguments {
  targetOwnerId?: string;
  amount?: number;
  description?: string;
  ownerId?: string;
  initialUnapprovedInvoiceValue?: number;
  input?: {
    targetUserId?: string;
    amount?: number;
  };
}

interface AppSyncEvent {
  arguments: AppSyncEventArguments;
  identity: {
    sub: string;
    username: string;
    groups: string[] | null;
  };
  info: {
    fieldName: string;
    parentTypeName: string;
  };
}

type CurrentAccountTransactionType = "CASH_RECEIPT" | "PAYMENT_REQUEST";

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

function isAdmin(groups: string[] | null | undefined): boolean {
  return !!groups?.includes(ADMIN_GROUP_NAME);
}

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

  if (!isAdmin(event.identity?.groups)) {
    console.error("Unauthorized: Caller is not in Admin group.");
    throw new Error("Unauthorized");
  }

  const adminSub = event.identity?.sub;

  switch (event.info.fieldName) {
    case "adminAddCashReceipt": {
      const { targetOwnerId, amount, description } = event.arguments;

      if (!targetOwnerId || typeof amount !== "number") {
        console.error("adminAddCashReceipt: Missing required arguments.");
        throw new Error("Missing targetOwnerId or amount.");
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
            ConditionExpression: "attribute_not_exists(id)",
          })
        );
        console.log("Successfully added cash receipt:", newTransaction);
        return newTransaction;
      } catch (error: any) {
        console.error("DynamoDB error:", error);
        throw new Error(`Failed to add cash receipt: ${error.message}`);
      }
    }

    case "adminCreateAccountStatus": {
      const { ownerId, initialUnapprovedInvoiceValue } = event.arguments;

      if (!ownerId || typeof initialUnapprovedInvoiceValue !== "number") {
        console.error("adminCreateAccountStatus: Missing required arguments.");
        throw new Error("Missing ownerId or initialUnapprovedInvoiceValue.");
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
        console.log("Created/updated account status:", newAccountStatus);
        return newAccountStatus;
      } catch (error: any) {
        console.error("DynamoDB error:", error);
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
        console.error("adminRequestPaymentForUser: Missing input values.");
        throw new Error("Missing targetUserId or amount.");
      }

      const { targetUserId: paymentTargetUser, amount: paymentAmount } = paymentInput;

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

        return {
          message: `Admin initiated payment request for ${paymentAmount} to ${paymentTargetUser}`,
          transactionId: paymentRequestTransaction.id,
          __typename: "AdminPaymentRequestResult",
        };
      } catch (dbError: any) {
        console.error("DynamoDB error:", dbError);
        throw new Error(`Failed to create payment request: ${dbError.message}`);
      }
    }

    default:
      console.error("Unknown admin action:", event.info.fieldName);
      throw new Error(`Unsupported admin action: ${event.info.fieldName}`);
  }
};
