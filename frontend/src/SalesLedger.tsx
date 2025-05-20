// frontend/src/SalesLedger.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { generateClient } from 'aws-amplify/api';
import { getCurrentUser, fetchAuthSession } from 'aws-amplify/auth'; // Added fetchAuthSession
import type { ObservableSubscription } from '@aws-amplify/api-graphql';

import {
  ListLedgerEntriesDocument,
  ListAccountStatusesDocument,
  ListCurrentAccountTransactionsDocument,
  CreateLedgerEntryDocument,
  SendPaymentRequestEmailDocument,
  OnCreateLedgerEntryDocument
} from './graphql/generated/graphql'; // Assuming this path is correct
import type {
  LedgerEntry,
  AccountStatus,
  CurrentAccountTransaction,
  CreateLedgerEntryInput,
  LedgerEntryType,
  OnCreateLedgerEntrySubscription,
  OnCreateLedgerEntrySubscriptionVariables,
  ListLedgerEntriesQuery,
  ListAccountStatusesQuery,
  ListCurrentAccountTransactionsQuery,
  CreateLedgerEntryMutation,
  SendPaymentRequestEmailMutation
} from './graphql/generated/graphql'; // Assuming this path is correct

import CurrentBalance from './CurrentBalance';
import LedgerEntryForm from './LedgerEntryForm';
import LedgerHistory from './LedgerHistory';
import AvailabilityDisplay from './AvailabilityDisplay';
import PaymentRequestForm from './PaymentRequestForm';
import { Loader, Text, Alert, View } from '@aws-amplify/ui-react'; // Added View for layout

const client = generateClient();
const ADVANCE_RATE = 0.90;

interface SalesLedgerProps {
  targetUserId?: string | null; // For admin viewing a specific user
  isAdmin?: boolean;            // Flag to indicate if the current logged-in user is an admin
}

function SalesLedger({ targetUserId, isAdmin = false }: SalesLedgerProps) {
  const [loggedInUserSub, setLoggedInUserSub] = useState<string | null>(null); // Logged-in user's own ID
  const [userIdForData, setUserIdForData] = useState<string | null>(null);   // Whose data to fetch/display

  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [currentSalesLedgerBalance, setCurrentSalesLedgerBalance] = useState(0);

  const [accountStatus, setAccountStatus] = useState<AccountStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  const [currentAccountTransactions, setCurrentAccountTransactions] = useState<CurrentAccountTransaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(true);
  const [calculatedCurrentAccountBalance, setCalculatedCurrentAccountBalance] = useState(0);

  const [grossAvailability, setGrossAvailability] = useState(0);
  const [netAvailability, setNetAvailability] = useState(0);
  const [grossAvailTemp, setGrossAvailTemp] = useState(0);
  const [netAvailTemp, setNetAvailTemp] = useState(0);

  const [paymentRequestLoading, setPaymentRequestLoading] = useState(false);
  const [paymentRequestError, setPaymentRequestError] = useState<string | null>(null);
  const [paymentRequestSuccess, setPaymentRequestSuccess] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);

  // 1. Get the ID of the currently logged-in user
  useEffect(() => {
    const fetchCurrentLoggedInUser = async () => {
      try {
        const { userId: sub } = await getCurrentUser(); // userId is the 'sub'
        setLoggedInUserSub(sub);
        console.log("SalesLedger: Logged-in user sub:", sub);
      } catch (err) {
        console.error("SalesLedger: Error fetching current logged-in user details:", err);
        setLoggedInUserSub(null);
        setError("Could not retrieve current user session. Please ensure you are logged in.");
      }
    };
    fetchCurrentLoggedInUser();
  }, []);

  // 2. Determine which user's data to fetch based on props and loggedInUserSub
  useEffect(() => {
    console.log("SalesLedger: Determining userIdForData. isAdmin:", isAdmin, "targetUserId:", targetUserId, "loggedInUserSub:", loggedInUserSub);
    if (isAdmin && targetUserId) {
      setUserIdForData(targetUserId);
      console.log("SalesLedger: Admin is viewing target user:", targetUserId);
    } else if (!isAdmin && loggedInUserSub) {
      setUserIdForData(loggedInUserSub);
      console.log("SalesLedger: Non-admin is viewing their own data:", loggedInUserSub);
    } else if (isAdmin && !targetUserId) {
        // Admin is on this page but hasn't selected a user to view.
        // Clear data or show a message. For now, clear.
        console.log("SalesLedger: Admin view, but no targetUserId. Clearing data.");
        setUserIdForData(null);
        setEntries([]);
        setAccountStatus(null);
        setCurrentAccountTransactions([]);
    } else {
      setUserIdForData(null); // Neither admin viewing target, nor user viewing self yet
    }
  }, [isAdmin, targetUserId, loggedInUserSub]);

  // Define fetch functions (using useCallback to stabilize them if passed as dependencies)
  const fetchInitialEntries = useCallback(async (idToFetch: string) => {
    setLoadingEntries(true); setError(null);
    console.log("SALESLEDGER.TSX: Attempting to fetchInitialEntries for user:", idToFetch);
    try {
      const response = await client.graphql<ListLedgerEntriesQuery>({
        query: ListLedgerEntriesDocument,
        variables: { filter: { owner: { eq: idToFetch } } },
        authMode: 'userPool'
      });
      console.log("SalesLedger: ListLedgerEntries response:", response);
      const items = response.data?.listLedgerEntries?.items?.filter(item => item !== null) as LedgerEntry[] || [];
      setEntries(items.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
    } catch (err: any) {
      console.error("SalesLedger: Ledger history error for user", idToFetch, err);
      const errorMessages = (err.errors as any[])?.map(e => e.message).join(', ') || err.message || 'Unknown error';
      setError(`Ledger history error: ${errorMessages}`); setEntries([]);
    } finally { setLoadingEntries(false); }
  }, []); // No dependencies needed if client is stable, or add if it changes

  const fetchInitialStatus = useCallback(async (idToFetch: string) => {
    setLoadingStatus(true); setError(null);
    console.log("SALESLEDGER.TSX: Attempting to fetchInitialStatus for user:", idToFetch);
    try {
      const response = await client.graphql<ListAccountStatusesQuery>({
        query: ListAccountStatusesDocument,
        variables: { filter: { owner: { eq: idToFetch } }, limit: 1 },
        authMode: 'userPool'
      });
      console.log("SalesLedger: ListAccountStatuses response:", response);
      const items = response.data?.listAccountStatuses?.items?.filter(item => item !== null) as AccountStatus[] || [];
      setAccountStatus(items.length > 0 ? items[0] : null);
    } catch (err: any) {
      console.error("SalesLedger: Account status error for user", idToFetch, err);
      const errorMessages = (err.errors as any[])?.map(e => e.message).join(', ') || err.message || 'Unknown error';
      setError(`Account status error: ${errorMessages}`); setAccountStatus(null);
    } finally { setLoadingStatus(false); }
  }, []);

  const fetchInitialTransactions = useCallback(async (idToFetch: string) => {
    setLoadingTransactions(true); setError(null);
    console.log("SALESLEDGER.TSX: Attempting to fetchInitialTransactions for user:", idToFetch);
    try {
      const response = await client.graphql<ListCurrentAccountTransactionsQuery>({
        query: ListCurrentAccountTransactionsDocument,
        variables: { filter: { owner: { eq: idToFetch } } },
        authMode: 'userPool'
      });
      console.log("SalesLedger: ListCurrentAccountTransactions response:", response);
      const items = response.data?.listCurrentAccountTransactions?.items?.filter(item => item !== null) as CurrentAccountTransaction[] || [];
      setCurrentAccountTransactions(items.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
    } catch (err: any) {
      console.error("SalesLedger: Account transaction error for user", idToFetch, err);
      const errorMessages = (err.errors as any[])?.map(e => e.message).join(', ') || err.message || 'Unknown error';
      setError(`Account transaction error: ${errorMessages}`); setCurrentAccountTransactions([]);
    } finally { setLoadingTransactions(false); }
  }, []);

  // 3. Fetch data when userIdForData is set
  useEffect(() => {
    console.log("SalesLedger: Data Fetch Effect triggered. userIdForData:", userIdForData);
    if (userIdForData) {
      fetchInitialEntries(userIdForData);
      fetchInitialStatus(userIdForData);
      fetchInitialTransactions(userIdForData);
    } else {
      // Clear data if no user is effectively selected for data viewing
      setEntries([]);
      setAccountStatus(null);
      setCurrentAccountTransactions([]);
      // Reset loading states only if we are not in an initial loggedInUserSub loading phase
      if (!(!isAdmin && loggedInUserSub === null && !targetUserId) ) { // avoid flicker if loggedInUser is still loading
          setLoadingEntries(false);
          setLoadingStatus(false);
          setLoadingTransactions(false);
      }
    }
  }, [userIdForData, fetchInitialEntries, fetchInitialStatus, fetchInitialTransactions, isAdmin, loggedInUserSub, targetUserId]);

  // Subscription Effect
  useEffect(() => {
    // Subscription should listen for changes related to the userIdForData
    if (!userIdForData) {
        console.log("SalesLedger: No userIdForData, skipping subscription setup.");
        return;
    }

    console.log("SalesLedger: Setting up subscription for owner:", userIdForData);
    const clientInstance = generateClient(); // Consider if client needs to be memoized or defined outside
    const sub = clientInstance.graphql<ObservableSubscription<OnCreateLedgerEntrySubscription, OnCreateLedgerEntrySubscriptionVariables>>({
      query: OnCreateLedgerEntryDocument,
      variables: { owner: userIdForData } as OnCreateLedgerEntrySubscriptionVariables,
      authMode: 'userPool'
    }).subscribe({
      next: ({ data }) => {
        const newEntry = data?.onCreateLedgerEntry;
        console.log("SalesLedger: Subscription received data:", newEntry);
        if (newEntry && newEntry.owner === userIdForData) { // Double check owner
          console.log("SalesLedger: Subscription received new ledger entry for current userIdForData:", newEntry.id);
          fetchInitialEntries(userIdForData); // Re-fetch ledger entries for the currently viewed user
          // Optionally re-fetch status if it could change, e.g., due to unapproved invoice value
          // fetchInitialStatus(userIdForData);
        }
      },
      error: (err: any) => { console.error("SalesLedger Subscription error:", err); setError("Subscription error. Data may not be live."); }
    });

    return () => {
      console.log("SalesLedger: Unsubscribing for owner:", userIdForData);
      sub.unsubscribe();
    };
  }, [userIdForData, fetchInitialEntries, fetchInitialStatus]); // fetchInitialStatus might be needed if it affects availability

  // Calculation useEffects (these should work fine once entries, currentAccountTransactions, accountStatus are correct)
  useEffect(() => { /* ... calculate currentSalesLedgerBalance from entries ... */
    let calculatedSLBalance = 0;
    entries.forEach(entry => { /* ... */ calculatedSLBalance += (entry.type === "INVOICE" || entry.type === "INCREASE_ADJUSTMENT" ? entry.amount : (entry.type === "CREDIT_NOTE" || entry.type === "DECREASE_ADJUSTMENT" || entry.type === "CASH_RECEIPT" ? -entry.amount : 0)); });
    setCurrentSalesLedgerBalance(parseFloat(calculatedSLBalance.toFixed(2)));
  }, [entries]);

  useEffect(() => { /* ... calculate calculatedCurrentAccountBalance from currentAccountTransactions ... */
    let calculatedAccBalance = 0;
    currentAccountTransactions.forEach(transaction => { /* ... */ calculatedAccBalance += (transaction.type === "PAYMENT_REQUEST" ? transaction.amount : (transaction.type === "CASH_RECEIPT" ? -transaction.amount : 0));});
    setCalculatedCurrentAccountBalance(parseFloat(calculatedAccBalance.toFixed(2)));
  }, [currentAccountTransactions]);

  useEffect(() => { /* ... calculate grossAvailTemp ... */
    const unapprovedValue = accountStatus?.totalUnapprovedInvoiceValue ?? 0;
    const grossAvail = (currentSalesLedgerBalance - unapprovedValue) * ADVANCE_RATE;
    setGrossAvailTemp(grossAvail);
  }, [currentSalesLedgerBalance, accountStatus]);

  useEffect(() => { /* ... calculate netAvailTemp ... */
    const netAvail = grossAvailTemp - calculatedCurrentAccountBalance;
    setNetAvailTemp(netAvail);
  }, [grossAvailTemp, calculatedCurrentAccountBalance]);

  useEffect(() => { setGrossAvailability(Math.max(0, parseFloat(grossAvailTemp.toFixed(2)))); }, [grossAvailTemp]);
  useEffect(() => { setNetAvailability(Math.max(0, parseFloat(netAvailTemp.toFixed(2)))); }, [netAvailTemp]);


  // Action Handlers (These still operate as the LOGGED-IN user - the admin)
  // To make them act ON BEHALF of targetUserId, you'd need specific admin mutations in backend
  const handleAddLedgerEntry = async (entryData: { type: string, amount: number, description?: string }) => {
    if (!loggedInUserSub) { setError("Your session is invalid. Cannot add entry."); return; } // Actions by logged-in user
    setError(null);
    // If an admin is adding an entry FOR a selected user, this logic would need to change.
    // This currently adds an entry for the logged-in user.
    // For an admin to add FOR someone else, the backend mutation createLedgerEntry's resolver
    // would need to allow an admin to specify the 'owner', or you'd use a specific admin mutation.
    // The current createLedgerEntry resolver automatically sets owner to $context.identity.sub.
    console.log("handleAddLedgerEntry: This action will be performed as user:", loggedInUserSub);
    try {
      const input: CreateLedgerEntryInput = {
        type: entryData.type as LedgerEntryType,
        amount: entryData.amount,
        description: entryData.description || null,
        // 'owner' is typically set by the backend resolver based on $context.identity.sub
      };
      const response = await client.graphql<CreateLedgerEntryMutation>({
        query: CreateLedgerEntryDocument,
        variables: { input: input },
        authMode: 'userPool'
      });
      if (response.data?.createLedgerEntry === null) {
        // This was the previous issue when resolver was missing.
        // Could also happen if resolver logic prevents creation for some reason.
        console.error("Failed to create ledger entry, backend returned null.");
        setError("Failed to save transaction: Could not confirm creation.");
      }
      // The subscription should handle UI update if createLedgerEntry now returns data
    } catch (err: any) {
      console.error("SalesLedger: Error adding ledger entry", err);
      const errors = err.errors || [err];
      setError(`Failed to save transaction: ${errors[0]?.message || 'Unknown error'}`);
    }
  };

  const handlePaymentRequest = async (amount: number) => {
    if (!loggedInUserSub) { setError("Your session is invalid. Cannot request payment."); return; } // Actions by logged-in user
    setPaymentRequestLoading(true); setPaymentRequestError(null); setPaymentRequestSuccess(null);
    console.log("handlePaymentRequest: This action will be performed as user:", loggedInUserSub);
    try {
      const result = await client.graphql<SendPaymentRequestEmailMutation>({
        query: SendPaymentRequestEmailDocument,
        variables: { amount: amount }, // This mutation likely uses logged-in user context
        authMode: 'userPool'
      });
      const responseMessage = result.data?.sendPaymentRequestEmail;
      if (result.errors && result.errors.length > 0) throw result.errors[0];
      setPaymentRequestSuccess(responseMessage ?? 'Request submitted successfully!');
      if (userIdForData) await fetchInitialTransactions(userIdForData); // Re-fetch relevant transactions
    } catch (err: any) {
      const errorMessage = err.message || (err.errors && err.errors[0]?.message) || 'Unknown error.';
      setPaymentRequestError(`Failed to submit request: ${errorMessage}`);
      setPaymentRequestSuccess(null);
    } finally {
      setPaymentRequestLoading(false);
    }
  };

  // --- Render Logic ---
  if (!loggedInUserSub && !error && !targetUserId) { // Still fetching logged-in user, not an admin targeting someone
    return (
      <View padding="xl" textAlign="center">
        <Loader size="large" /> <Text>Initializing user session...</Text>
      </View>
    );
  }

  if (error && (!loggedInUserSub && !targetUserId)) { // Error fetching initial logged-in user, and not an admin viewing a target
    return <Alert variation="error" heading="Session Error">{error}</Alert>;
  }

  if (isAdmin && !targetUserId && !error) { // Admin is on the page but hasn't selected a user
    return (
      <View padding="xl">
        <Alert variation="info">Please select a user to view their sales ledger details.</Alert>
      </View>
    );
  }
  
  // If we don't have a userIdForData yet (e.g. admin selected a user but it hasn't propagated to userIdForData)
  // or if still loading primary user identity for non-admin view
  if (!userIdForData && !error) {
      return (
          <View padding="xl" textAlign="center">
              <Loader size="large" /><Text>Loading user context...</Text>
          </View>
      )
  }


  if (loadingEntries || loadingStatus || loadingTransactions) {
    return (
      <View padding="xl" textAlign="center">
        <Loader size="large" /> <Text>Loading data for {userIdForData ? 'selected user' : 'you'}...</Text>
      </View>
    );
  }
  // General error display if fetches failed for userIdForData but component is otherwise ready
   if (error) { // This error is from fetch failures after userIdForData is set
     return <Alert variation="error" isDismissible={true} onDismiss={() => setError(null)}>{error}</Alert>;
   }


  return (
    <div style={{ padding: '20px' }}>
      <h2>Sales Ledger {isAdmin && targetUserId ? `(Viewing User: ${targetUserId.substring(0,8)}...)` : ''}</h2>
      {/* Display general errors (this might be redundant if specific error above is shown) */}
      {/* {error && <Alert variation="error" isDismissible={true} onDismiss={() => setError(null)}>{error}</Alert>} */}
      
      <CurrentBalance balance={currentSalesLedgerBalance} />
      <AvailabilityDisplay
        grossAvailability={grossAvailability}
        netAvailability={netAvailability}
        currentSalesLedgerBalance={currentSalesLedgerBalance}
        totalUnapprovedInvoiceValue={accountStatus?.totalUnapprovedInvoiceValue ?? 0}
        currentAccountBalance={calculatedCurrentAccountBalance}
      />
      
      {/* Forms should ideally be disabled or act on behalf of viewed user if admin.
          For now, they act as the logged-in admin.
          If !targetUserId (regular user view), they act as self.
      */}
      <PaymentRequestForm
        netAvailability={netAvailability}
        onSubmitRequest={handlePaymentRequest}
        isLoading={paymentRequestLoading}
        requestError={paymentRequestError}
        requestSuccess={paymentRequestSuccess}
        // Disable if admin is viewing another user and this form shouldn't operate on viewed user directly
        // disabled={isAdmin && !!targetUserId} 
      />
      <LedgerEntryForm 
        onSubmit={handleAddLedgerEntry} 
        // Disable if admin is viewing another user and this form shouldn't operate on viewed user directly
        // disabled={isAdmin && !!targetUserId}
      />
      
      <div style={{marginTop: '30px'}}>
        <h3>Sales Ledger Transaction History</h3>
        <LedgerHistory entries={entries} historyType="sales" isLoading={loadingEntries} />
      </div>
      <div style={{marginTop: '30px'}}>
        <h3>Current Account Transaction History</h3>
        <LedgerHistory entries={currentAccountTransactions as unknown as LedgerEntry[]} historyType="account" isLoading={loadingTransactions} />
      </div>
    </div>
  );
}
export default SalesLedger;