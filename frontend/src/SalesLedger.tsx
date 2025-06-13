// src/SalesLedger.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { generateClient } from 'aws-amplify/api';
// REMOVE: import { getCurrentUser } from 'aws-amplify/auth'; // No longer needed directly here
import { Auth } from 'aws-amplify'; // <--- ADD THIS IMPORT for Auth.currentSession()
import {
    listLedgerEntries,
    listAccountStatuses,
    listCurrentAccountTransactions
} from './graphql/operations/queries';
import {
    createLedgerEntry,
    adminCreateLedgerEntry,
    sendPaymentRequestEmail,
    adminRequestPaymentForUser
} from './graphql/operations/mutations';
import { onCreateLedgerEntry } from './graphql/operations/subscriptions';
import {
    LedgerEntryType,
    type LedgerEntry,
    type AccountStatus,
    type CurrentAccountTransaction,
    type AdminCreateLedgerEntryInput,
    type SendPaymentRequestInput
} from './graphql/API';
import { type User } from 'aws-amplify/auth'; // <--- IMPORT User type
import CurrentBalance from './CurrentBalance';
import LedgerEntryForm from './LedgerEntryForm';
import LedgerHistory from './LedgerHistory';
import AvailabilityDisplay from './AvailabilityDisplay';
import PaymentRequestForm from './PaymentRequestForm';
import ManageAccountStatus from './ManageAccountStatus';
import { Loader, Text, Alert, View } from '@aws-amplify/ui-react';

const ADVANCE_RATE = 0.90;

interface SalesLedgerProps {
    targetUserId?: string | null;
    isAdmin?: boolean;
    loggedInUser: User; // The user object passed from App.tsx
}

function SalesLedger({ targetUserId, isAdmin = false, loggedInUser }: SalesLedgerProps) {
    const client = generateClient(); // Initialize client once per component instance

    // These states are now initialized directly from loggedInUser prop
    const [loggedInUserSub, setLoggedInUserSub] = useState<string | null>(loggedInUser.username);
    const [userEmail, setUserEmail] = useState<string | null>(loggedInUser.attributes?.email ?? null);
    const [userCompanyName, setUserCompanyName] = useState<string | null>(loggedInUser.attributes?.['custom:company_name'] ?? null);
    const [userIdForData, setUserIdForData] = useState<string | null>(null); // Will be set in its useEffect

    const [entries, setEntries] = useState<LedgerEntry[]>([]);
    const [loadingEntries, setLoadingEntries] = useState(true);
    const [accountStatus, setAccountStatus] = useState<AccountStatus | null>(null);
    const [loadingStatus, setLoadingStatus] = useState(true);
    const [currentAccountTransactions, setCurrentAccountTransactions] = useState<CurrentAccountTransaction[]>([]);
    const [loadingTransactions, setLoadingTransactions] = useState(true);

    const [paymentRequestLoading, setPaymentRequestLoading] = useState(false);
    const [paymentRequestError, setPaymentRequestError] = useState<string | null>(null);
    const [paymentRequestSuccess, setPaymentRequestSuccess] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // REMOVE THE entire ensureAuth function and its useEffect call related to fetchUserDetails
    // You now rely on loggedInUser prop which comes from App.tsx's useAuthenticator

    // Determine userIdForData based on admin status or logged-in user
    useEffect(() => {
        console.log("SalesLedger: Determining userIdForData. isAdmin:", isAdmin, "targetUserId:", targetUserId, "loggedInUserSub:", loggedInUserSub);
        if (isAdmin && targetUserId) {
            console.log("SalesLedger: Admin is viewing/acting for target user:", targetUserId);
            setUserIdForData(targetUserId);
        } else if (!isAdmin && loggedInUserSub) {
            console.log("SalesLedger: Non-admin is viewing/acting for their own data:", loggedInUserSub);
            setUserIdForData(loggedInUserSub);
        } else {
            console.log("SalesLedger: userIdForData remains null or undefined.");
            setUserIdForData(null);
        }
    }, [isAdmin, targetUserId, loggedInUserSub]);

    // Function to fetch all ledger entries (paginated)
    const fetchAllLedgerEntries = useCallback(async (ownerId: string): Promise<LedgerEntry[]> => {
        let allEntries: LedgerEntry[] = [];
        let nextToken: string | undefined = undefined;
        try {
            // Get the current session to ensure the client is authenticated
            const session = await Auth.currentSession(); // <--- CRITICAL CHANGE HERE
            const idToken = session.getIdToken().getJwtToken(); // Get the JWT token

            do {
                const response = await client.graphql({
                    query: listLedgerEntries,
                    variables: {
                        filter: { owner: { eq: ownerId } },
                        nextToken,
                        limit: 50,
                    },
                    // Pass the token explicitly in the request if the client initialization
                    // isn't picking it up automatically. This is a common workaround.
                    // Headers can sometimes be automatically added by Amplify if Amplify.configure
                    // is done properly with Auth, but explicit is robust.
                    headers: {
                      Authorization: idToken // <--- ADDED HEADER
                    }
                });
                const items = response?.data?.listLedgerEntries?.items?.filter(Boolean) as LedgerEntry[] || [];
                allEntries = [...allEntries, ...items];
                nextToken = response?.data?.listLedgerEntries?.nextToken || undefined;
            } while (nextToken);
            return allEntries;
        } catch (err) {
            console.error("Error in fetchAllLedgerEntries:", err);
            // Check for authentication specific errors and set a more specific error message
            if ((err as any).message?.includes("NoValidAuthTokens") || (err as any).message?.includes("Not Authorized")) {
                 setError("Authentication required for data access. Please re-login.");
            } else {
                 setError("Failed to load ledger entries.");
            }
            throw err;
        }
    }, [client]);

    // Function to refresh all data - useful after mutations
    const refreshAllData = useCallback(async () => {
        if (!userIdForData) return;

        // The token issue likely affects all graphql calls.
        // We ensure authentication before any GQL call is made within refreshAllData.
        try {
            const userSession = await Auth.currentSession(); // Ensure session is active
            if (!userSession || !userSession.getIdToken().getJwtToken()) {
                setError("Authentication session expired or invalid. Please re-login.");
                return;
            }
        } catch (err) {
            setError("Could not establish active session for data refresh. Please re-login.");
            return;
        }


        setLoadingEntries(true);
        try {
            const entriesResponse = await fetchAllLedgerEntries(userIdForData);
            setEntries(entriesResponse);
        } catch (err) {
            setError("Failed to load ledger history.");
        } finally {
            setLoadingEntries(false);
        }

        setLoadingStatus(true);
        try {
            const statusResponse = await client.graphql({
                query: listAccountStatuses,
                variables: { owner: userIdForData, limit: 1 }
                // headers: { Authorization: userSession.getIdToken().getJwtToken() } // Optional: add header here too
            });
            const statusItem = statusResponse?.data?.listAccountStatuses?.items?.[0] || null;
            setAccountStatus(statusItem);
        } catch (err) {
            setError("Failed to load account status.");
        } finally {
            setLoadingStatus(false);
        }

        setLoadingTransactions(true);
        try {
            const transactionsResponse = await client.graphql({
                query: listCurrentAccountTransactions,
                variables: { filter: { owner: { eq: userIdForData } } }
                // headers: { Authorization: userSession.getIdToken().getJwtToken() } // Optional: add header here too
            });
            const transactionItems = transactionsResponse?.data?.listCurrentAccountTransactions?.items?.filter(Boolean) as CurrentAccountTransaction[] || [];
            setCurrentAccountTransactions(transactionItems);
        } catch (err) {
            setError("Failed to load account transactions.");
        } finally {
            setLoadingTransactions(false);
        }
    }, [userIdForData, fetchAllLedgerEntries, client]);

    // Initial data fetch effect
    useEffect(() => {
        console.log("SalesLedger: Data Fetch Effect triggered. userIdForData:", userIdForData);
        refreshAllData();
    }, [userIdForData, refreshAllData]);

    // Subscription setup
    useEffect(() => {
        if (!userIdForData) return;
        console.log(`SalesLedger: Setting up subscription for owner: ${userIdForData}`);
        const sub = client.graphql({
            query: onCreateLedgerEntry,
            variables: { owner: userIdForData }
            // headers: { Authorization: userSession.getIdToken().getJwtToken() } // Need to pass token here too
        }).subscribe({
            next: ({ data }) => {
                const newEntry = data.onCreateLedgerEntry;
                if (newEntry) {
                    setEntries(prevEntries => [newEntry, ...prevEntries]);
                }
            },
            error: (subscriptionError) => console.error("Subscription error:", subscriptionError)
        });

        return () => sub.unsubscribe();
    }, [userIdForData, client]);

    const handlePaymentRequest = async () => {
        setPaymentRequestLoading(true);
        setPaymentRequestError(null);
        setPaymentRequestSuccess(null);
        try {
            // Ensure authentication before mutation
            const userSession = await Auth.currentSession();
            if (!userSession || !userSession.getIdToken().getJwtToken()) {
                throw new Error("Authentication required for payment request.");
            }
            const idToken = userSession.getIdToken().getJwtToken(); // Get the JWT token

            if (!userEmail) throw new Error("User email is not available for payment request.");
            const amountToRequest = accountStatus?.totalUnapprovedInvoiceValue * ADVANCE_RATE || 0;
            if (amountToRequest <= 0) throw new Error("Calculated amount for payment request is zero or negative.");

            const input: SendPaymentRequestInput = {
                amount: amountToRequest,
                toEmail: userEmail,
            };
            await client.graphql({
                query: sendPaymentRequestEmail,
                variables: { input },
                headers: { Authorization: idToken } // <--- ADDED HEADER
            });
            setPaymentRequestSuccess("Payment request sent successfully!");
        } catch (error) {
            console.error("Failed to submit payment request:", error);
            setPaymentRequestError("Failed to submit payment request: " + (error as Error).message);
        } finally {
            setPaymentRequestLoading(false);
        }
    };

    const handleAddLedgerEntry = async (newEntry: LedgerEntry) => {
        try {
            // Ensure authentication before mutation
            const userSession = await Auth.currentSession();
            if (!userSession || !userSession.getIdToken().getJwtToken()) {
                throw new Error("Authentication required for adding ledger entry.");
            }
            const idToken = userSession.getIdToken().getJwtToken(); // Get the JWT token

            if (!userIdForData) {
                setError("Cannot add entry: User ID for data not available.");
                return;
            }
            const input: AdminCreateLedgerEntryInput = {
                amount: newEntry.amount || 0,
                description: newEntry.description || '',
                type: newEntry.type,
                targetUserId: userIdForData,
            };
            await client.graphql({
                query: adminCreateLedgerEntry,
                variables: { input },
                headers: { Authorization: idToken } // <--- ADDED HEADER
            });
            refreshAllData();
        } catch (err) {
            console.error("Error adding ledger entry:", err);
            setError("Failed to add ledger entry. Please try again.");
        }
    };

    // Show loading state
    if (loadingEntries || loadingStatus || loadingTransactions) {
        return (
            <View className="sales-ledger-loader">
                <Loader variation="linear" size="large" />
                <Text>Loading ledger data...</Text>
            </View>
        );
    }

    // Show error state
    if (error) {
        return (
            <View className="sales-ledger-error">
                <Alert variation="error">
                    <Text>{error}</Text>
                </Alert>
            </View>
        );
    }

    return (
        <View className="sales-ledger-container">
            <h2>Sales Ledger for {userCompanyName || 'Your Business'}</h2>

            {/* Pass actual balance to CurrentBalance with null-safe access */}
            <CurrentBalance balance={accountStatus?.totalUnapprovedInvoiceValue || 0} />

            <AvailabilityDisplay
                currentBalance={accountStatus?.totalUnapprovedInvoiceValue || 0}
                advanceRate={ADVANCE_RATE}
            />

            <LedgerEntryForm onSubmit={handleAddLedgerEntry} />

            <PaymentRequestForm
                onSubmitRequest={handlePaymentRequest}
                isLoading={paymentRequestLoading}
                requestError={paymentRequestError}
                requestSuccess={paymentRequestSuccess}
                calculatedAdvance={accountStatus ? accountStatus.totalUnapprovedInvoiceValue * ADVANCE_RATE : 0}
            />

            <ManageAccountStatus selectedOwnerSub={userIdForData} />

            <LedgerHistory entries={entries} />
        </View>
    );
}

export default SalesLedger;