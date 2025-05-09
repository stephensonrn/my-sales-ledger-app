// backend-cdk/lambda-handlers/adminDataActions/handler.ts
import type { AppSyncResolverHandler } from 'aws-lambda';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { ulid } from "ulid";

const ddbClient = new DynamoDBClient({});
const marshallOptions = { removeUndefinedValues: true };
const translateConfig = { marshallOptions };
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient, translateConfig);

interface AdminAddCashReceiptArgs {
    targetOwnerId: string;
    amount: number;
    description?: string | null;
}

type CurrentAccountTransactionResult = { /* ... as defined before ... */ } | null;
// Define LedgerEntry structure for return if needed, or just return the CurrentAccountTransaction
type LedgerEntryResult = { id: string; owner: string; type: string; amount: number; description?: string | null; createdAt: string; updatedAt: string; __typename: 'LedgerEntry'; };


export const handler: AppSyncResolverHandler<AdminAddCashReceiptArgs, CurrentAccountTransactionResult> = async (event) => {
    const CURRENT_ACCT_TABLE_NAME = process.env.CURRENT_ACCT_TABLE_NAME;
    const LEDGER_ENTRY_TABLE_NAME = process.env.LEDGER_ENTRY_TABLE_NAME; // New Env Var

    console.log('ADMIN ACTION EVENT (Cash Receipt):', JSON.stringify(event, null, 2));

    if (!CURRENT_ACCT_TABLE_NAME || !LEDGER_ENTRY_TABLE_NAME) {
        console.error('Missing table name environment variables.');
        throw new Error('Lambda configuration error (TABLE NAMES).');
    }

    const { targetOwnerId, amount, description } = event.arguments;

    if (!targetOwnerId || typeof amount !== 'number' || amount <= 0) {
        console.error('Invalid input for cash receipt:', event.arguments);
        throw new Error('Target Owner ID and a valid positive amount are required.');
    }

    const timestamp = new Date().toISOString();
    const cashReceiptIdForCurrentAccount = ulid();
    const cashReceiptIdForSalesLedger = ulid(); // Separate ID for ledger entry

    const currentAccountTxItem = {
        id: cashReceiptIdForCurrentAccount,
        owner: targetOwnerId,
        type: 'CASH_RECEIPT', // This DECREASES the current account balance (reduces amount owed)
        amount: amount,       // Store positive value
        description: description ?? `Cash Receipt - ${targetOwnerId}`,
        createdAt: timestamp,
        updatedAt: timestamp,
        __typename: 'CurrentAccountTransaction'
    };

    const ledgerEntryItem = {
        id: cashReceiptIdForSalesLedger,
        owner: targetOwnerId,
        type: 'CASH_RECEIPT', // Use 'CASH_RECEIPT' or 'CASH_APPLIED_AS_CREDIT' (ensure enum exists in AppSync schema)
        amount: amount,       // This will be treated as a credit on sales ledger
        description: description ?? `Cash Receipt - SL Application`,
        createdAt: timestamp,
        updatedAt: timestamp,
        __typename: 'LedgerEntry'
    };

    try {
        console.log("Attempting to put item into CurrentAccountTransaction Table:", currentAccountTxItem);
        await ddbDocClient.send(new PutCommand({ TableName: CURRENT_ACCT_TABLE_NAME, Item: currentAccountTxItem }));
        console.log("CurrentAccountTransaction record created successfully by admin.");

        try {
            console.log("Attempting to put item into LedgerEntry Table:", ledgerEntryItem);
            await ddbDocClient.send(new PutCommand({ TableName: LEDGER_ENTRY_TABLE_NAME, Item: ledgerEntryItem }));
            console.log("LedgerEntry record for cash receipt created successfully by admin.");
        } catch (ledgerDbError: any) {
            console.error("Error creating LedgerEntry for cash receipt (CurrentAccountTransaction WAS saved):", ledgerDbError);
            // Depending on desired atomicity, you might want to attempt to roll back the CurrentAccountTransaction
            // For simplicity here, we proceed but inform about partial success.
            throw new Error(`Cash receipt recorded in current account, but failed to update sales ledger: ${ledgerDbError.message}`);
        }
        
        return currentAccountTxItem as CurrentAccountTransactionResult; // Return the primary transaction

    } catch (dbError: any) {
        console.error("Error during database operations for admin cash receipt:", dbError);
        throw new Error(`Failed to process cash receipt: ${dbError.message || 'Internal DB Error'}`);
    }
};