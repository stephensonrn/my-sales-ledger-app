import React, { useState, useEffect, useCallback } from 'react';
import { generateClient } from 'aws-amplify/api';
import { getCurrentUser } from 'aws-amplify/auth';
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
}

function SalesLedger({ targetUserId, isAdmin = false }: SalesLedgerProps) {
    const client = generateClient(); // Initialize client once per component instance

    const [loggedInUserSub, setLoggedInUserSub] = useState<string | null>(null);
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [userCompanyName, setUserCompanyName] = useState<string | null>(null);
    const [userIdForData, setUserIdForData] = useState<string | null>(null);

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

    // Ensure user is authenticated before making requests
    const ensureAuth = async () => {
        try {
            const user = await getCurrentUser();
            // Only proceed if user is not null/undefined AND has a signInUserSession
            if (user && user.signInUserSession) { // <--- MODIFIED LINE
                const idToken = user.signInUserSession.idToken?.jwtToken; // Optional chaining for idToken is good
                console.log('Authenticated with token:', idToken);
                return user;
            } else {
                // Log specific reason if not authenticated
                console.error('User not authenticated: No active session found or invalid session.');
                setError("Could not retrieve current user session. Please ensure you are logged in.");
                return null; // Explicitly return null if authentication is not successful
            }
        } catch (error) {
            // This catches actual errors thrown by getCurrentUser() (e.g., network issues)
            console.error('User not authenticated: Failed to get user or session, or session is invalid:', error);
            setError("Could not retrieve current user session. Please ensure you are logged in.");
            return null;
        }
    };

    // Fetch logged-in user details
    useEffect(() => {
        async function fetchUserDetails() {
            const user = await ensureAuth(); // Ensure user is authenticated
            if (user) { // user will be null if ensureAuth fails
                setLoggedInUserSub(user.username);
                setUserEmail(user.attributes?.email ?? null);
                setUserCompanyName(user.attributes?.['custom:company_name'] ?? null); // Corrected custom attribute name
            }
        }
        fetchUserDetails();
    }, []);

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
            setUserIdForData(null); // Explicitly ensure it's null if no valid user ID
        }
    }, [isAdmin, targetUserId, loggedInUserSub]);

    // Function to fetch all ledger entries (paginated)
    const fetchAllLedgerEntries = useCallback(async (ownerId: string): Promise<LedgerEntry[]> => {
        let allEntries: LedgerEntry[] = [];
        let nextToken: string | undefined = undefined;
        try {
            do {
                const response = await client.graphql({
                    query: listLedgerEntries,
                    variables: {
                        filter: { owner: { eq: ownerId } },
                        nextToken,
                        limit: 50,
                    }
                });
                const items = response?.data?.listLedgerEntries?.items?.filter(Boolean) as LedgerEntry[] || [];
                allEntries = [...allEntries, ...items];
                nextToken = response?.data?.listLedgerEntries?.nextToken || undefined;
            } while (nextToken);
            return allEntries;
        } catch (err) {
            console.error("Error in fetchAllLedgerEntries:", err);
            setError("Failed to load ledger entries.");
            throw err; // Re-throw to be caught by the calling useEffect
        }
    }, [client]); // client is a dependency

    // Function to refresh all data - useful after mutations
    const refreshAllData = useCallback(async () => {
        if (!userIdForData) return;

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
            });
            const transactionItems = transactionsResponse?.data?.listCurrentAccountTransactions?.items?.filter(Boolean) as CurrentAccountTransaction[] || [];
            setCurrentAccountTransactions(transactionItems);
        } catch (err) {
            setError("Failed to load account transactions.");
        } finally {
            setLoadingTransactions(false);
        }
    }, [userIdForData, fetchAllLedgerEntries, client]); // Dependencies for useCallback

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
        }).subscribe({
            next: ({ data }) => {
                const newEntry = data.onCreateLedgerEntry;
                if (newEntry) {
                    setEntries(prevEntries => [newEntry, ...prevEntries]);
                }
            },
            error: (subscriptionError) => console.error("Subscription error:", subscriptionError)
        });

        return () => sub.unsubscribe(); // Unsubscribe when component unmounts
    }, [userIdForData, client]);

    const handlePaymentRequest = async () => {
        setPaymentRequestLoading(true);
        setPaymentRequestError(null);
        setPaymentRequestSuccess(null);
        try {
            if (!userEmail) throw new Error("User email is not available for payment request.");
            const amountToRequest = accountStatus?.totalUnapprovedInvoiceValue * ADVANCE_RATE || 0; // Example calculation
            if (amountToRequest <= 0) {
                 throw new Error("Calculated amount for payment request is zero or negative.");
            }

            const input: SendPaymentRequestInput = {
                amount: amountToRequest,
                toEmail: userEmail,
            };
            await client.graphql({
                query: sendPaymentRequestEmail,
                variables: { input },
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