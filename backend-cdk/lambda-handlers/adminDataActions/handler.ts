// handler.ts
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { ulid } from "ulid";

const DDB_TABLE_TRANSACTIONS = process.env.CURRENT_ACCT_TABLE_NAME;
const DDB_TABLE_ACCOUNT_STATUS = process.env.ACCOUNT_STATUS_TABLE_NAME;
const DDB_TABLE_SALES_LEDGER = process.env.LEDGER_ENTRY_TABLE_NAME;
const AWS_REGION = process.env.AWS_REGION || "eu-west-1";
const ADMIN_GROUP_NAME = process.env.ADMIN_GROUP_NAME || "Admin";

if (!DDB_TABLE_TRANSACTIONS || !DDB_TABLE_ACCOUNT_STATUS || !DDB_TABLE_SALES_LEDGER) {
  throw new Error("Missing required environment variables.");
}

const ddbClient = new DynamoDBClient({ region: AWS_REGION });
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

type CurrentAccountTransactionType = "CASH_RECEIPT" | "PAYMENT_REQUEST";
type LedgerEntryType = "INVOICE" | "CASH_RECEIPT" | "CREDIT_NOTE" | "INCREASE_ADJUSTMENT" | "DECREASE_ADJUSTMENT";

interface AppSyncEventArguments {
  targetOwnerId?: string;
  amount?: number;
  description?: string;
  ownerId?: string;
  initialUnapprovedInvoiceValue?: number;
  input?: {
    targetUserId?: string;
    amount?: number;
    description?: string;
    type?: string;
  };
}

interface AppSyncEvent {
  arguments: AppSyncEventArguments;
  identity: {
    sub: string;
    username: string;
    groups: string[] | null;
    sourceIp?: string[];
  };
  info: {
    fieldName: string;
    parentTypeName: string;
  };
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
) {
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

function createLedgerEntry(
  owner: string,
  type: LedgerEntryType,
  amount: number,
  description: string | null,
  adminSub?: string,
  ip?: string[],
  groups?: string[] | null
) {
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
    ...(ip?.length ? { createdByIp: ip[0] } : {}),
    ...(groups?.length ? { adminGroups: groups } : {}),
    __typename: "LedgerEntry",
  };
}

export const handler = async (event: AppSyncEvent): Promise<any> => {
  console.log("AdminDataActionsFunction event:", JSON.stringify(event, null, 2));

  if (!isAdmin(event.identity?.groups)) {
    throw new Error("Unauthorized");
  }

  const adminSub = event.identity?.sub;

  switch (event.info.fieldName) {
    case "adminAddCashReceipt": {
      const { targetOwnerId, amount, description } = event.arguments.input || {};
      if (!targetOwnerId || typeof amount !== "number") {
        throw new Error("Missing targetOwnerId or amount.");
      }

      const cashReceiptTx = createTransaction(
        targetOwnerId,
        "CASH_RECEIPT",
        amount,
        description || null,
        adminSub
      );

      const ledgerEntry = createLedgerEntry(
        targetOwnerId,
        "CASH_RECEIPT",
        amount,
        description || null,
        adminSub,
        event.identity.sourceIp,
        event.identity.groups
      );

      try {
        await Promise.all([
          ddbDocClient.send(
            new PutCommand({
              TableName: DDB_TABLE_TRANSACTIONS,
              Item: cashReceiptTx,
              ConditionExpression: "attribute_not_exists(id)",
            })
          ),
          ddbDocClient.send(
            new PutCommand({
              TableName: DDB_TABLE_SALES_LEDGER,
              Item: ledgerEntry,
              ConditionExpression: "attribute_not_exists(id)",
            })
          ),
        ]);

        return cashReceiptTx;
      } catch (err: any) {
        console.error("Failed to write cash receipt and ledger entry", err);
        throw new Error(`Failed to add cash receipt: ${err.message}`);
      }
    }

    case "adminCreateLedgerEntry": {
      const input = event.arguments.input;
      if (
        !input?.targetUserId ||
        typeof input.amount !== "number" ||
        !input.type
      ) {
        throw new Error("Missing targetUserId, amount, or type.");
      }

      const entry = createLedgerEntry(
        input.targetUserId,
        input.type as LedgerEntryType,
        input.amount,
        input.description || null,
        adminSub,
        event.identity.sourceIp,
        event.identity.groups
      );

      try {
        await ddbDocClient.send(
          new PutCommand({
            TableName: DDB_TABLE_SALES_LEDGER,
            Item: entry,
            ConditionExpression: "attribute_not_exists(id)",
          })
        );

        // 🔁 Update AccountStatus balance if this entry affects it
        const delta =
          input.type === "INVOICE" || input.type === "INCREASE_ADJUSTMENT"
            ? input.amount
            : input.type === "CREDIT_NOTE" || input.type === "DECREASE_ADJUSTMENT"
            ? -input.amount
            : 0;

        if (delta !== 0) {
          await ddbDocClient.send(
            new UpdateCommand({
              TableName: DDB_TABLE_ACCOUNT_STATUS,
              Key: { id: input.targetUserId },
              UpdateExpression: "SET totalUnapprovedInvoiceValue = if_not_exists(totalUnapprovedInvoiceValue, :zero) + :delta, updatedAt = :now",
              ExpressionAttributeValues: {
                ":delta": delta,
                ":now": new Date().toISOString(),
                ":zero": 0,
              },
            })
          );
        }

        return entry;
      } catch (err: any) {
        console.error("Error creating ledger entry or updating AccountStatus:", err);
        throw new Error(`CreateLedgerEntryError: ${err.message}`);
      }
    }

    case "adminCreateAccountStatus": {
      const { ownerId, initialUnapprovedInvoiceValue } = event.arguments;

      if (!ownerId || typeof initialUnapprovedInvoiceValue !== "number") {
        throw new Error("Missing ownerId or initialUnapprovedInvoiceValue.");
      }

      const now = new Date().toISOString();
      const newAccountStatus = {
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
        return newAccountStatus;
      } catch (error: any) {
        throw new Error(`Failed to create/update account status: ${error.message}`);
      }
    }

    case "adminRequestPaymentForUser": {
      const paymentInput = event.arguments.input;

      if (!paymentInput?.targetUserId || typeof paymentInput.amount !== "number") {
        throw new Error("Missing targetUserId or amount.");
      }

      const transaction = createTransaction(
        paymentInput.targetUserId,
        "PAYMENT_REQUEST",
        paymentInput.amount,
        `Admin-initiated payment request by ${adminSub}`,
        adminSub
      );

      try {
        await ddbDocClient.send(
          new PutCommand({
            TableName: DDB_TABLE_TRANSACTIONS,
            Item: transaction,
          })
        );

        return {
          message: `Admin initiated payment request for ${paymentInput.amount} to ${paymentInput.targetUserId}`,
          transactionId: transaction.id,
          __typename: "AdminPaymentRequestResult",
        };
      } catch (error: any) {
        throw new Error(`Failed to create payment request: ${error.message}`);
      }
    }

    default:
      throw new Error(`Unsupported admin action: ${event.info.fieldName}`);
  }
};
