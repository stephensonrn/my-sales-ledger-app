// frontend/src/SalesLedger.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { generateClient } from 'aws-amplify/api';
import { getCurrentUser } from 'aws-amplify/auth'; // fetchAuthSession was not used, removed
import type { ObservableSubscription } from '@aws-amplify/api-graphql';

// Ensure these imports are correct after regenerating your GraphQL code
import {
  ListLedgerEntriesDocument,
  ListAccountStatusesDocument,
  ListCurrentAccountTransactionsDocument,
  CreateLedgerEntryDocument,       // For non-admins or admin acting for self
  AdminCreateLedgerEntryDocument,  // NEW: For admin acting for others
  SendPaymentRequestEmailDocument, // For non-admins or admin acting for self
  AdminRequestPaymentForUserDocument, // NEW: For admin acting for others
  OnCreateLedgerEntryDocument
} from './graphql/generated/graphql'; 
import type {
  LedgerEntry,
  AccountStatus,
  CurrentAccountTransaction,
  CreateLedgerEntryInput,
  AdminCreateLedgerEntryInput,     // NEW
  AdminRequestPaymentForUserInput, // NEW
  LedgerEntryType,
  OnCreateLedgerEntrySubscription,
  OnCreateLedgerEntrySubscriptionVariables,
  ListLedgerEntriesQuery,
  ListAccountStatusesQuery,
  ListCurrentAccountTransactionsQuery,
  CreateLedgerEntryMutation,
  AdminCreateLedgerEntryMutation,  // NEW
  SendPaymentRequestEmailMutation,
  AdminRequestPaymentForUserMutation // NEW
} from './graphql/generated/graphql'; 

import CurrentBalance from './CurrentBalance';
import LedgerEntryForm from './LedgerEntryForm';
import LedgerHistory from './LedgerHistory';
import AvailabilityDisplay from './AvailabilityDisplay';
import PaymentRequestForm from './PaymentRequestForm';
import { Loader, Text, Alert, View } from '@aws-amplify/ui-react';

const client = generateClient(); // Ensure client is initialized correctly based on your Amplify setup
const ADVANCE_RATE = 0.90;

interface SalesLedgerProps {
  targetUserId?: string | null; 
  isAdmin?: boolean;            
}

function SalesLedger({ targetUserId, isAdmin = false }: SalesLedgerProps) {
  const [loggedInUserSub, setLoggedInUserSub] = useState<string | null>(null);
  const [userIdForData, setUserIdForData] = useState<string | null>(null);   

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

  useEffect(() => {
    const fetchCurrentLoggedInUser = async () => {
      try {
        const { userId: sub } = await getCurrentUser();
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

  useEffect(() => {
    console.log("SalesLedger: Determining userIdForData. isAdmin:", isAdmin, "targetUserId:", targetUserId, "loggedInUserSub:", loggedInUserSub);
    if (isAdmin && targetUserId) {
      setUserIdForData(targetUserId);
      console.log("SalesLedger: Admin is viewing/acting for target user:", targetUserId);
    } else if (!isAdmin && loggedInUserSub) {
      setUserIdForData(loggedInUserSub);
      console.log("SalesLedger: Non-admin is viewing/acting for their own data:", loggedInUserSub);
    } else if (isAdmin && !targetUserId) {
      console.log("SalesLedger: Admin view, but no targetUserId. Clearing data.");
      setUserIdForData(null);
      // Resetting data states when admin deselects a user or hasn't selected one
      setEntries([]);
      setAccountStatus(null);
      setCurrentAccountTransactions([]);
    } else {
      setUserIdForData(null); 
    }
  }, [isAdmin, targetUserId, loggedInUserSub]);

  const fetchInitialEntries = useCallback(async (idToFetch: string) => {
    setLoadingEntries(true); setError(null); // Clear general errors when starting a fetch
    console.log("SALESLEDGER.TSX: Attempting to fetchInitialEntries for user:", idToFetch);
    try {
      const response = await client.graphql<ListLedgerEntriesQuery>({
        query: ListLedgerEntriesDocument,
        variables: { filter: { owner: { eq: idToFetch } } },
        authMode: 'userPool'
      });
      console.log("SalesLedger: ListLedgerEntries response:", response);
      if (response.errors) throw response.errors; // Throw if GraphQL errors are present
      const items = response.data?.listLedgerEntries?.items?.filter(item => item !== null) as LedgerEntry[] || [];
      setEntries(items.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
    } catch (err: any) {
      console.error("SalesLedger: Ledger history error for user", idToFetch, err);
      const errorMessages = err.errors && Array.isArray(err.errors) ? err.errors.map((e: any) => e.message).join(', ') : err.message || 'Unknown error';
      setError(`Ledger history error: ${errorMessages}`); setEntries([]);
    } finally { setLoadingEntries(false); }
  }, []); 

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
      if (response.errors) throw response.errors;
      const items = response.data?.listAccountStatuses?.items?.filter(item => item !== null) as AccountStatus[] || [];
      setAccountStatus(items.length > 0 ? items[0] : null);
    } catch (err: any) {
      console.error("SalesLedger: Account status error for user", idToFetch, err);
      const errorMessages = err.errors && Array.isArray(err.errors) ? err.errors.map((e: any) => e.message).join(', ') : err.message || 'Unknown error';
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
      if (response.errors) throw response.errors;
      const items = response.data?.listCurrentAccountTransactions?.items?.filter(item => item !== null) as CurrentAccountTransaction[] || [];
      setCurrentAccountTransactions(items.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
    } catch (err: any) {
      console.error("SalesLedger: Account transaction error for user", idToFetch, err);
      const errorMessages = err.errors && Array.isArray(err.errors) ? err.errors.map((e: any) => e.message).join(', ') : err.message || 'Unknown error';
      setError(`Account transaction error: ${errorMessages}`); setCurrentAccountTransactions([]);
    } finally { setLoadingTransactions(false); }
  }, []);

  useEffect(() => {
    console.log("SalesLedger: Data Fetch Effect triggered. userIdForData:", userIdForData);
    if (userIdForData) {
      fetchInitialEntries(userIdForData);
      fetchInitialStatus(userIdForData);
      fetchInitialTransactions(userIdForData);
    } else {
      setEntries([]);
      setAccountStatus(null);
      setCurrentAccountTransactions([]);
      if (!(!isAdmin && loggedInUserSub === null && !targetUserId) ) {
          setLoadingEntries(false);
          setLoadingStatus(false);
          setLoadingTransactions(false);
      }
    }
  }, [userIdForData, fetchInitialEntries, fetchInitialStatus, fetchInitialTransactions, isAdmin, loggedInUserSub, targetUserId]);

  useEffect(() => {
    if (!userIdForData) {
        console.log("SalesLedger: No userIdForData, skipping subscription setup.");
        return;
    }
    console.log("SalesLedger: Setting up subscription for owner:", userIdForData);
    const clientInstance = generateClient(); 
    const sub = clientInstance.graphql<ObservableSubscription<OnCreateLedgerEntrySubscription, OnCreateLedgerEntrySubscriptionVariables>>({
      query: OnCreateLedgerEntryDocument,
      variables: { owner: userIdForData } as OnCreateLedgerEntrySubscriptionVariables, // Subscription listens to changes for the user being viewed
      authMode: 'userPool'
    }).subscribe({
      next: ({ data }) => {
        const newEntry = data?.onCreateLedgerEntry;
        console.log("SalesLedger: Subscription received data:", newEntry);
        // Ensure the update is for the currently viewed user,
        // especially if admin might have multiple SalesLedger instances or a generic subscription setup.
        if (newEntry && newEntry.owner === userIdForData) { 
          console.log("SalesLedger: Subscription received new ledger entry for current userIdForData:", newEntry.id);
          fetchInitialEntries(userIdForData);
          if (newEntry.type === "INVOICE") { // Example: only refetch status if an invoice changes unapproved value
            fetchInitialStatus(userIdForData);
          }
        }
      },
      error: (err: any) => { console.error("SalesLedger Subscription error:", err); setError("Subscription error. Data may not be live."); }
    });
    return () => {
      console.log("SalesLedger: Unsubscribing for owner:", userIdForData);
      sub.unsubscribe();
    };
  }, [userIdForData, fetchInitialEntries, fetchInitialStatus]);

  useEffect(() => { 
    let calculatedSLBalance = 0;
    entries.forEach(entry => { calculatedSLBalance += (entry.type === "INVOICE" || entry.type === "INCREASE_ADJUSTMENT" ? entry.amount : (entry.type === "CREDIT_NOTE" || entry.type === "DECREASE_ADJUSTMENT" || entry.type === "CASH_RECEIPT" ? -entry.amount : 0)); });
    setCurrentSalesLedgerBalance(parseFloat(calculatedSLBalance.toFixed(2)));
  }, [entries]);

  useEffect(() => { 
    let calculatedAccBalance = 0;
    currentAccountTransactions.forEach(transaction => { calculatedAccBalance += (transaction.type === "PAYMENT_REQUEST" ? transaction.amount : (transaction.type === "CASH_RECEIPT" ? -transaction.amount : 0));});
    setCalculatedCurrentAccountBalance(parseFloat(calculatedAccBalance.toFixed(2)));
  }, [currentAccountTransactions]);

  useEffect(() => { 
    const unapprovedValue = accountStatus?.totalUnapprovedInvoiceValue ?? 0;
    const grossAvail = (currentSalesLedgerBalance - unapprovedValue) * ADVANCE_RATE;
    setGrossAvailTemp(grossAvail);
  }, [currentSalesLedgerBalance, accountStatus]);

  useEffect(() => { 
    const netAvail = grossAvailTemp - calculatedCurrentAccountBalance;
    setNetAvailTemp(netAvail);
  }, [grossAvailTemp, calculatedCurrentAccountBalance]);

  useEffect(() => { setGrossAvailability(Math.max(0, parseFloat(grossAvailTemp.toFixed(2)))); }, [grossAvailTemp]);
  useEffect(() => { setNetAvailability(Math.max(0, parseFloat(netAvailTemp.toFixed(2)))); }, [netAvailTemp]);

  const handleAddLedgerEntry = async (entryData: { type: string, amount: number, description?: string }) => {
    // Use loggedInUserSub for auth context (admin's identity) but target actions using userIdForData if admin
    if (!loggedInUserSub) { setError("Your session is invalid. Cannot add entry."); return; }
    if (!userIdForData && !isAdmin) { setError("User context not available."); return; } // Should not happen if loggedInUserSub is set for non-admin
    if (isAdmin && !userIdForData) { setError("No target user selected by admin."); return; }

    setError(null);
    const effectiveTargetUserId = isAdmin && targetUserId ? targetUserId : loggedInUserSub;
    if (!effectiveTargetUserId) { setError("Target user ID is missing."); return; }


    try {
      if (isAdmin) {
        // Admin is adding for a selected user (userIdForData should be the targetUserId)
        console.log(`SalesLedger: Admin (${loggedInUserSub}) adding ledger entry FOR target user: ${userIdForData}`);
        const adminInput: AdminCreateLedgerEntryInput = { 
          type: entryData.type as LedgerEntryType,
          amount: entryData.amount,
          description: entryData.description || null,
          targetUserId: userIdForData!, // userIdForData is confirmed if isAdmin and targetUserId was set
        };
        await client.graphql<AdminCreateLedgerEntryMutation>({ 
          query: AdminCreateLedgerEntryDocument, 
          variables: { input: adminInput },
          authMode: 'userPool' 
        });
        console.log("SalesLedger: AdminCreateLedgerEntry mutation called.");
      } else {
        // Non-admin adding for themselves (userIdForData is their own loggedInUserSub)
        console.log(`SalesLedger: User (${loggedInUserSub}) adding ledger entry for themselves.`);
        const input: CreateLedgerEntryInput = {
          type: entryData.type as LedgerEntryType,
          amount: entryData.amount,
          description: entryData.description || null,
        };
        await client.graphql<CreateLedgerEntryMutation>({
          query: CreateLedgerEntryDocument,
          variables: { input: input },
          authMode: 'userPool'
        });
      }
      // Subscription for onCreateLedgerEntry (if variables match owner: userIdForData) should handle the UI update.
      // Or explicitly refetch for the currently viewed user:
      await fetchInitialEntries(effectiveTargetUserId);
      if (entryData.type === "INVOICE") { 
          await fetchInitialStatus(effectiveTargetUserId);
      }

    } catch (err: any) {
      console.error("SalesLedger: Error adding ledger entry", err);
      const errorMessages = err.errors && Array.isArray(err.errors) ? err.errors.map((e: any) => e.message).join(', ') : err.message || 'Unknown error';
      setError(`Failed to save transaction: ${errorMessages}`);
    }
  };

  const handlePaymentRequest = async (amount: number) => {
    if (!loggedInUserSub) { setError("Your session is invalid. Cannot request payment."); return; }
    if (!userIdForData && !isAdmin) { setError("User context not available."); return; }
    if (isAdmin && !userIdForData) { setError("No target user selected by admin."); return; }

    setPaymentRequestLoading(true); setPaymentRequestError(null); setPaymentRequestSuccess(null);
    
    const effectiveTargetUserId = isAdmin && targetUserId ? targetUserId : loggedInUserSub;
    if (!effectiveTargetUserId) { setError("Target user ID is missing for payment request."); setPaymentRequestLoading(false); return; }

    try {
      if (isAdmin) {
        console.log(`SalesLedger: Admin (${loggedInUserSub}) requesting payment FOR target user: ${userIdForData}`);
        const adminInput: AdminRequestPaymentForUserInput = {
            targetUserId: userIdForData!, // userIdForData confirmed
            amount: amount,
        };
        const result = await client.graphql<AdminRequestPaymentForUserMutation>({
            query: AdminRequestPaymentForUserDocument,
            variables: { input: adminInput },
            authMode: 'userPool'
        });
        const responseMessage = result.data?.adminRequestPaymentForUser;
        setPaymentRequestSuccess(responseMessage ?? 'Admin: Payment request submitted successfully for user!');
      } else {
        console.log(`SalesLedger: User (${loggedInUserSub}) requesting payment for themselves.`);
        const result = await client.graphql<SendPaymentRequestEmailMutation>({
          query: SendPaymentRequestEmailDocument,
          variables: { amount: amount }, // This mutation uses logged-in user context on backend
          authMode: 'userPool'
        });
        const responseMessage = result.data?.sendPaymentRequestEmail;
        setPaymentRequestSuccess(responseMessage ?? 'Payment request submitted successfully!');
      }
      await fetchInitialTransactions(effectiveTargetUserId); 
    } catch (err: any) {
      console.error("SalesLedger: Error requesting payment", err);
      const errorMessage = err.errors && Array.isArray(err.errors) ? err.errors.map((e:any) => e.message).join(", ") : err.message || 'Unknown error.';
      setPaymentRequestError(`Failed to submit payment request: ${errorMessage}`);
      setPaymentRequestSuccess(null);
    } finally {
      setPaymentRequestLoading(false);
    }
  };

  // --- Render Logic ---
  if (!loggedInUserSub && !error && !targetUserId) { 
    return ( <View padding="xl" textAlign="center"><Loader size="large" /> <Text>Initializing user session...</Text></View> );
  }
  if (error && ((!loggedInUserSub && !targetUserId) || (isAdmin && !targetUserId && !userIdForData))) { 
    return <Alert variation="error" heading="Session or Configuration Error">{error}</Alert>;
  }
  if (isAdmin && !targetUserId && !error ) { 
    return ( <View padding="xl"><Alert variation="info">Please select a user to view their sales ledger details.</Alert></View> );
  }
  if (!userIdForData && !error) { 
      return ( <View padding="xl" textAlign="center"><Loader size="large" /><Text>Loading user context...</Text></View> )
  }
  if (loadingEntries || loadingStatus || loadingTransactions) { // This loader shows when userIdForData is set and fetches are in progress
    return ( <View padding="xl" textAlign="center"><Loader size="large" /> <Text>Loading data for {isAdmin && targetUserId ? `user ${targetUserId.substring(0,8)}...` : 'you'}...</Text></View> );
  }
   if (error) { 
     return <Alert variation="error" isDismissible={true} onDismiss={() => setError(null)}>{error}</Alert>;
   }

  return (
    <div style={{ padding: '20px' }}>
      <h2>Sales Ledger {isAdmin && targetUserId && userIdForData === targetUserId ? `(Viewing User: ${targetUserId.substring(0,8)}...)` : ''}</h2>
      
      <CurrentBalance balance={currentSalesLedgerBalance} />
      <AvailabilityDisplay
        grossAvailability={grossAvailability}
        netAvailability={netAvailability}
        currentSalesLedgerBalance={currentSalesLedgerBalance}
        totalUnapprovedInvoiceValue={accountStatus?.totalUnapprovedInvoiceValue ?? 0}
        currentAccountBalance={calculatedCurrentAccountBalance}
      />
      
      <PaymentRequestForm
        netAvailability={netAvailability}
        onSubmitRequest={handlePaymentRequest}
        isLoading={paymentRequestLoading}
        requestError={paymentRequestError}
        requestSuccess={paymentRequestSuccess}
        // Consider disabling form or changing its behavior/label if admin is acting for another.
        // For now, handlePaymentRequest contains the logic to call the correct mutation.
      />
      <LedgerEntryForm 
        onSubmit={handleAddLedgerEntry} 
        // Similar to PaymentRequestForm, behavior for admin context is in handleAddLedgerEntry.
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