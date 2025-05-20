// backend-cdk/lambda-handlers/monthlyReportMailer/index.ts

import { Context, Handler } from 'aws-lambda';
import {
    CognitoIdentityProviderClient,
    ListUsersCommand,
    ListGroupsForUserCommand,
    UserType as CognitoUserType, // Renamed to avoid conflict if you have your own UserType
    AttributeType,
} from '@aws-sdk/client-cognito-identity-provider';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, QueryCommandInput } from '@aws-sdk/lib-dynamodb';
import { SESClient, SendRawEmailCommand } from '@aws-sdk/client-ses';
import Papa from 'papaparse';
import MailComposer from 'mailcomposer';

// --- Configuration from Environment Variables ---
const USER_POOL_ID = process.env.USER_POOL_ID;
const SES_FROM_ADDRESS = process.env.SES_FROM_ADDRESS;
const LEDGER_TABLE_NAME = process.env.LEDGER_TABLE_NAME;
const TRANSACTION_TABLE_NAME = process.env.TRANSACTION_TABLE_NAME;
const ADMIN_GROUP_NAME = process.env.ADMIN_GROUP_NAME || 'Admin';
const AWS_REGION = process.env.AWS_REGION || 'eu-west-1'; // Default to your region or get from context

// --- Initialize AWS Clients ---
const cognitoClient = new CognitoIdentityProviderClient({ region: AWS_REGION });
const ddbClient = new DynamoDBClient({ region: AWS_REGION });
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);
const sesClient = new SESClient({ region: AWS_REGION });

interface ReportableUser {
    username: string;
    email: string;
}

// --- Helper: Get User Email ---
const getUserEmail = (user: CognitoUserType): string | null => {
    const emailAttr = user.Attributes?.find((attr: AttributeType) => attr.Name === 'email');
    const emailVerifiedAttr = user.Attributes?.find((attr: AttributeType) => attr.Name === 'email_verified');
    if (emailAttr?.Value && emailVerifiedAttr?.Value === 'true') {
        return emailAttr.Value;
    }
    console.warn(`User ${user.Username} does not have a verified email. Email attribute: ${emailAttr?.Value}, Verified: ${emailVerifiedAttr?.Value}`);
    return null;
};

// --- Helper: Check if User is Admin ---
const isUserAdmin = async (username: string): Promise<boolean> => {
    if (!username) return false; // Should not happen if username is from Cognito list
    try {
        const command = new ListGroupsForUserCommand({
            UserPoolId: USER_POOL_ID,
            Username: username,
            Limit: 10, // Max groups to check; adjust if users can be in many groups
        });
        const response = await cognitoClient.send(command);
        return response.Groups?.some(group => group.GroupName === ADMIN_GROUP_NAME) ?? false;
    } catch (error) {
        console.error(`Error checking admin status for user ${username}:`, error);
        return true; // Fail safe: assume admin if error occurs to prevent accidental email
    }
};

// --- Helper: Fetch all items for a user within a date range (handles pagination) ---
const fetchAllDynamoDBItems = async (
    tableName: string,
    userId: string, // This should be the value used in your 'owner' attribute (e.g., Cognito sub/username)
    startDateISO: string,
    endDateISO: string
): Promise<any[]> => {
    let allItems: any[] = [];
    let ExclusiveStartKey: Record<string, any> | undefined = undefined;

    console.log(`Workspaceing from ${tableName} for owner ${userId} between ${startDateISO} and ${endDateISO}`);

    do {
        const params: QueryCommandInput = {
            TableName: tableName,
            IndexName: 'byOwner', // GSI must have 'owner' as partition key
            KeyConditionExpression: '#ownerAttr = :ownerVal',
            FilterExpression: '#createdAtAttr >= :startDate AND #createdAtAttr < :endDate', // Use >= and < for date range
            ExpressionAttributeNames: {
                '#ownerAttr': 'owner',
                '#createdAtAttr': 'createdAt', // Assumes 'createdAt' attribute exists and is an ISO8601 string
            },
            ExpressionAttributeValues: {
                ':ownerVal': userId,
                ':startDate': startDateISO,
                ':endDate': endDateISO,
            },
            ExclusiveStartKey: ExclusiveStartKey,
        };

        try {
            const command = new QueryCommand(params);
            const result = await ddbDocClient.send(command);
            if (result.Items) {
                allItems = allItems.concat(result.Items);
            }
            ExclusiveStartKey = result.LastEvaluatedKey;
        } catch (error) {
            console.error(`Error querying ${tableName} for owner ${userId}:`, error);
            throw error; // Propagate error to stop processing for this user's report
        }
    } while (ExclusiveStartKey);

    console.log(`Found ${allItems.length} items in ${tableName} for owner ${userId}`);
    return allItems;
};

// --- Helper: Create and Send Email ---
const sendReportEmail = async (
    recipientEmail: string,
    monthName: string,
    year: number,
    ledgerCsv: string,
    transactionCsv: string
): Promise<void> => {
    const mailOptions = {
        from: SES_FROM_ADDRESS,
        to: recipientEmail,
        subject: `Your Monthly Transaction Report - ${monthName} ${year}`,
        text: `Hi,\n\nPlease find attached your Sales Ledger and Current Account transaction reports for ${monthName} ${year}.\n\nIf you have any questions, please contact support.\n\nRegards,\nYour Application Name`, // Customize your app name
        html: `<p>Hi,</p><p>Please find attached your Sales Ledger and Current Account transaction reports for ${monthName} ${year}.</p><p>If you have any questions, please contact support.</p><p>Regards,<br/>Your Application Name</p>`, // Customize
        attachments: [
            {
                filename: `sales_ledger_report_${year}_${monthName.toLowerCase().replace(' ', '_')}.csv`,
                content: ledgerCsv,
                contentType: 'text/csv',
            },
            {
                filename: `current_account_report_${year}_${monthName.toLowerCase().replace(' ', '_')}.csv`,
                content: transactionCsv,
                contentType: 'text/csv',
            },
        ],
    };

    try {
        const mail = new MailComposer(mailOptions);
        const messageBuffer = await mail.compile().build();

        const command = new SendRawEmailCommand({
            RawMessage: { Data: messageBuffer },
        });

        await sesClient.send(command);
        console.log(`Report email successfully sent to ${recipientEmail} for ${monthName} ${year}`);

    } catch (error) {
        console.error(`Failed to send email to ${recipientEmail} for period ${monthName} ${year}:`, error);
        throw new Error(`Failed to send email to ${recipientEmail}`); // Propagate to mark this user's processing as failed
    }
};


// --- Lambda Handler ---
export const handler: Handler = async (event: any, context: Context): Promise<void> => {
    console.log('Starting Monthly Report Mailer execution...');
    console.log('Received event:', JSON.stringify(event, null, 2)); // EventBridge scheduled event is simple

    if (!USER_POOL_ID || !SES_FROM_ADDRESS || !LEDGER_TABLE_NAME || !TRANSACTION_TABLE_NAME) {
        console.error('FATAL: Missing required environment variables! USER_POOL_ID, SES_FROM_ADDRESS, LEDGER_TABLE_NAME, TRANSACTION_TABLE_NAME must be set.');
        throw new Error('Missing required environment variables!');
    }

    // Determine the date range for the *previous* full month based on the Lambda's execution time
    const executionTime = new Date(); // Time when Lambda is running
    // To get the previous month, go to the first day of the current month, then subtract one day to get the last day of the previous month.
    const firstDayOfCurrentMonth = new Date(Date.UTC(executionTime.getUTCFullYear(), executionTime.getUTCMonth(), 1));
    const lastDayOfPreviousMonth = new Date(firstDayOfCurrentMonth.getTime() - (24 * 60 * 60 * 1000)); // Subtract one day in ms

    const reportYear = lastDayOfPreviousMonth.getUTCFullYear();
    const reportMonthIndex = lastDayOfPreviousMonth.getUTCMonth(); // 0-indexed (0=Jan, 11=Dec)
    
    // For naming and display
    const reportMonthName = new Date(Date.UTC(reportYear, reportMonthIndex)).toLocaleString('en-UK', { month: 'long' });

    // Date range for querying: from the first day of the reportMonth to the first day of the month AFTER reportMonth (exclusive)
    const startDate = new Date(Date.UTC(reportYear, reportMonthIndex, 1));
    const endDate = new Date(Date.UTC(reportYear, reportMonthIndex + 1, 1)); // reportMonthIndex + 1 handles year wrap-around

    const startDateISO = startDate.toISOString(); // e.g., "2025-04-01T00:00:00.000Z"
    const endDateISO = endDate.toISOString();     // e.g., "2025-05-01T00:00:00.000Z" (exclusive end for April data)

    console.log(`Processing reports for month: ${reportMonthName} ${reportYear} (Date Range for Query: ${startDateISO} to ${endDateISO})`);

    let CognitoPaginationToken: string | undefined = undefined;
    let totalUsersScanned = 0;
    let reportsAttempted = 0;
    let reportsSuccessfullySent = 0;
    let reportErrors = 0;

    // Paginate through all users in the User Pool
    do {
        try {
            const listUsersCmd = new ListUsersCommand({
                UserPoolId: USER_POOL_ID,
                PaginationToken: CognitoPaginationToken,
                Limit: 50, // Adjust as needed, max 60 per call
            });
            const listUsersResp = await cognitoClient.send(listUsersCmd);

            if (listUsersResp.Users && listUsersResp.Users.length > 0) {
                totalUsersScanned += listUsersResp.Users.length;

                for (const cognitoUser of listUsersResp.Users) {
                    const username = cognitoUser.Username; // This is usually the 'sub' or the primary sign-in alias
                    const email = getUserEmail(cognitoUser);

                    if (!username) {
                        console.warn('User found with no username, skipping.');
                        continue;
                    }
                    if (!email) {
                        console.log(`User ${username} does not have a verified email or email is missing. Skipping report.`);
                        continue;
                    }

                    const isAdmin = await isUserAdmin(username);
                    if (isAdmin) {
                        console.log(`User ${username} is an admin. Skipping report.`);
                        continue;
                    }

                    console.log(`Processing report for non-admin user: ${username} (Email: ${email})`);
                    reportsAttempted++;

                    try {
                        // Fetch data for this user for the determined month
                        // The 'owner' field in DynamoDB should match the 'username' (e.g., Cognito sub)
                        const ledgerEntries = await fetchAllDynamoDBItems(LEDGER_TABLE_NAME, username, startDateISO, endDateISO);
                        const transactions = await fetchAllDynamoDBItems(TRANSACTION_TABLE_NAME, username, startDateISO, endDateISO);

                        if (ledgerEntries.length === 0 && transactions.length === 0) {
                           console.log(`No transaction data found for user ${username} for ${reportMonthName} ${reportYear}. Skipping email.`);
                           reportsSuccessfullySent++; // Count as "processed" even if no data
                           continue;
                        }

                        // Generate CSVs
                        const ledgerCsv = Papa.unparse(ledgerEntries, { header: true });
                        const transactionCsv = Papa.unparse(transactions, { header: true });

                        // Send Email
                        await sendReportEmail(email, reportMonthName, reportYear, ledgerCsv, transactionCsv);
                        reportsSuccessfullySent++;

                    } catch (userProcessingError) {
                        console.error(`Failed to generate or send report for user ${username} (${email}):`, userProcessingError);
                        reportErrors++;
                        // Continue to the next user even if one fails
                    }
                } // end for loop of users in batch
            } else {
                console.log("No more users found in Cognito User Pool.");
            }
            CognitoPaginationToken = listUsersResp.PaginationToken;
        } catch (error) {
            console.error('FATAL: Error listing users from Cognito:', error);
            CognitoPaginationToken = undefined; // Stop pagination on a major error
            // Depending on the error, you might want to throw to mark the entire Lambda execution as failed
            // For now, we log and assume it might be a temporary issue or an issue with a batch.
            reportErrors++; // Increment general error count
        }
    } while (CognitoPaginationToken);

    console.log(`Monthly Report Mailer execution finished. 
        Total users scanned (approx): ${totalUsersScanned}. 
        Reports attempted for non-admins: ${reportsAttempted}.
        Reports successfully sent/processed: ${reportsSuccessfullySent}. 
        Errors encountered: ${reportErrors}.`);

    // Consider if you need to explicitly signal success/failure if no reports were attempted or all failed.
    if (reportsAttempted > 0 && reportErrors === reportsAttempted) {
        // All attempts to process user reports failed
        throw new Error(`All ${reportsAttempted} user report processing attempts failed.`);
    }
    // If reportsAttempted is 0, it means no non-admin users with emails were found or Cognito list failed early.
};