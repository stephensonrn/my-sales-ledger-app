// lambda-handlers/adminDataActions/handler.ts
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, PutCommandOutput } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from 'crypto'; // For generating IDs if AccountStatus ID is different from ownerId

interface EventArguments {
    // For adminAddCashReceipt
    targetOwnerId?: string;
    amount?: number;
    description?: string;

    // For adminCreateAccountStatus
    ownerId?: string; // This will be the Cognito Sub ID of the target user
    initialUnapprovedInvoiceValue?: number;
}

interface AppSyncEvent {
    info: {
        fieldName: string; // To determine which mutation is being called
    };
    arguments: EventArguments;
}

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const CURRENT_ACCT_TABLE_NAME = process.env.CURRENT_ACCT_TABLE_NAME;
const LEDGER_ENTRY_TABLE_NAME = process.env.LEDGER_ENTRY_TABLE_NAME;
const ACCOUNT_STATUS_TABLE_NAME = process.env.ACCOUNT_STATUS_TABLE_NAME; // Will be added via CDK

export const handler = async (event: AppSyncEvent): Promise<any> => {
    console.log(`Received event: ${JSON.stringify(event)}`);

    if (!CURRENT_ACCT_TABLE_NAME || !LEDGER_ENTRY_TABLE_NAME || !ACCOUNT_STATUS_TABLE_NAME) {
        console.error("Missing table name environment variables!");
        throw new Error("Configuration error: Table names not set.");
    }

    const now = new Date().toISOString();

    // --- Handle adminCreateAccountStatus ---
    if (event.info.fieldName === "adminCreateAccountStatus") {
        if (!event.arguments.ownerId) {
            throw new Error("ownerId is required for adminCreateAccountStatus.");
        }

        const accountStatusId = event.arguments.ownerId; // Using owner's sub as the AccountStatus ID
        const owner = event.arguments.ownerId;
        const totalUnapprovedInvoiceValue = event.arguments.initialUnapprovedInvoiceValue ?? 0;

        const newAccountStatus = {
            id: accountStatusId,
            owner: owner,
            totalUnapprovedInvoiceValue: totalUnapprovedInvoiceValue,
            createdAt: now,
            updatedAt: now,
        };

        const params = {
            TableName: ACCOUNT_STATUS_TABLE_NAME,
            Item: newAccountStatus,
            // ConditionExpression: "attribute_not_exists(id)" // Optional: prevent overwriting
        };

        console.log("Attempting to create AccountStatus with params:", params);
        try {
            await docClient.send(new PutCommand(params));
            console.log("AccountStatus created successfully:", newAccountStatus);
            return newAccountStatus; // Return the created object
        } catch (error) {
            console.error("Error creating AccountStatus:", error);
            throw new Error(`Could not create AccountStatus: ${error.message}`);
        }
    }

    // --- Handle adminAddCashReceipt (existing logic) ---
    else if (event.info.fieldName === "adminAddCashReceipt") {
        if (!event.arguments.targetOwnerId || typeof event.arguments.amount !== 'number') {
            throw new Error("targetOwnerId and amount are required for adminAddCashReceipt.");
        }

        const transactionId = randomUUID();
        const cashReceiptLedgerEntryId = randomUUID(); // Separate ID for LedgerEntry

        const currentAccountTransaction = {
            id: transactionId,
            owner: event.arguments.targetOwnerId,
            type: "CASH_RECEIPT", // From CurrentAccountTransactionType enum
            amount: event.arguments.amount,
            description: event.arguments.description || "Cash receipt by admin",
            createdAt: now,
            updatedAt: now,
        };

        const ledgerEntryCashReceipt = {
            id: cashReceiptLedgerEntryId,
            owner: event.arguments.targetOwnerId,
            type: "CASH_RECEIPT", // From LedgerEntryType enum
            amount: event.arguments.amount,
            description: `Ref: ${transactionId} - ${event.arguments.description || "Cash receipt by admin"}`,
            createdAt: now,
            updatedAt: now,
        };

        const transactionParams = {
            TableName: CURRENT_ACCT_TABLE_NAME,
            Item: currentAccountTransaction,
        };
        const ledgerParams = {
            TableName: LEDGER_ENTRY_TABLE_NAME,
            Item: ledgerEntryCashReceipt,
        };

        try {
            console.log("Adding CurrentAccountTransaction:", currentAccountTransaction);
            await docClient.send(new PutCommand(transactionParams));
            console.log("Adding LedgerEntry for cash receipt:", ledgerEntryCashReceipt);
            await docClient.send(new PutCommand(ledgerParams));
            console.log("adminAddCashReceipt successful.");
            return currentAccountTransaction; // Return the CurrentAccountTransaction object
        } catch (error) {
            console.error("Error in adminAddCashReceipt:", error);
            throw new Error(`Could not process adminAddCashReceipt: ${error.message}`);
        }
    }

    // --- Add other admin actions here if needed ---
    else {
        console.error(`Unknown field, unable to resolve ${event.info.fieldName}`);
        throw new Error(`Unknown field, unable to resolve ${event.info.fieldName}`);
    }
};