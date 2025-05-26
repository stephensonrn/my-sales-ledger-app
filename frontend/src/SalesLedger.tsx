// frontend/src/SalesLedger.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { generateClient } from 'aws-amplify/api';
import { getCurrentUser } from 'aws-amplify/auth';
import type { ObservableSubscription } from '@aws-amplify/api-graphql';

// Corrected imports for GraphQL documents and types
import { 
    ListLedgerEntriesDocument, 
    ListAccountStatusesDocument, 
    ListCurrentAccountTransactionsDocument,
    CreateLedgerEntryDocument,
    SendPaymentRequestEmailDocument,
    OnCreateLedgerEntryDocument
} from './graphql/queries'; // Assuming OnCreateLedgerEntry is also generated here or in subscriptions.ts
                            // If they are split, adjust accordingly.
                            // For this example, assuming documents might be grouped by operation type
                            // or that your codegen produces them in a way that queries.ts exports all.
                            // More typically:
                            // import { ListLedgerEntriesDocument, ... } from './graphql/queries';
                            // import { CreateLedgerEntryDocument, ... } from './graphql/mutations';
                            // import { OnCreateLedgerEntryDocument } from './graphql/subscriptions';

// Let's be more specific based on typical Amplify Codegen output with docsFilePath: "src/graphql"
import { ListLedgerEntriesDocument, ListAccountStatusesDocument, ListCurrentAccountTransactionsDocument } from './graphql/queries';
import { 
    CreateLedgerEntryDocument, 
    AdminCreateLedgerEntryDocument,  // NEW
    SendPaymentRequestEmailDocument,
    AdminRequestPaymentForUserDocument // NEW
} from './graphql/mutations';
import { OnCreateLedgerEntryDocument } from './graphql/subscriptions';

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
} from './API'; // Types come from API.ts

import CurrentBalance from './CurrentBalance';
import LedgerEntryForm from './LedgerEntryForm';
import LedgerHistory from './LedgerHistory';
import AvailabilityDisplay from './AvailabilityDisplay';
import PaymentRequestForm from './PaymentRequestForm';
import { Loader, Text, Alert, View } from '@aws-amplify/ui-react';

const client = generateClient();
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
      setEntries([]);
      setAccountStatus(null);
      setCurrentAccountTransactions([]);
    } else {
      setUserIdForData(null); 
    }
  }, [isAdmin, targetUserId, loggedInUserSub]);

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
      if (response.errors) throw response.errors;
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
      variables: { owner: userIdForData } as OnCreateLedgerEntrySubscriptionVariables,
      authMode: 'userPool'
    }).subscribe({
      next: ({ data }) => {
        const newEntry = data?.onCreateLedgerEntry;
        console.log("SalesLedger: Subscription received data:", newEntry);
        if (newEntry && newEntry.owner === userIdForData) { 
          console.log("SalesLedger: Subscription received new ledger entry for current userIdForData:", newEntry.id);
          fetchInitialEntries(userIdForData);
          if (newEntry.type === "INVOICE") { 
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

  // Calculation useEffects
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

  // --- MODIFIED Action Handlers ---
  const handleAddLedgerEntry = async (entryData: { type: string, amount: number, description?: string }) => {
    if (!loggedInUserSub) { setError("Your session is invalid. Cannot add entry."); return; }
    // userIdForData will be the target if admin is viewing, otherwise it's loggedInUserSub for non-admins
    if (!userIdForData) { setError("User context for action is not available."); return;}

    setError(null);
    try {
      if (isAdmin && targetUserId && targetUserId === userIdForData) { // Ensure admin is acting on the target user
        console.log(`SalesLedger: Admin (${loggedInUserSub}) adding ledger entry FOR target user: ${targetUserId}`);
        const adminInput: AdminCreateLedgerEntryInput = { 
          type: entryData.type as LedgerEntryType,
          amount: entryData.amount,
          description: entryData.description || null,
          targetUserId: targetUserId, 
        };
        await client.graphql<AdminCreateLedgerEntryMutation>({ 
          query: AdminCreateLedgerEntryDocument, 
          variables: { input: adminInput },
          authMode: 'userPool' 
        });
        console.log("SalesLedger: AdminCreateLedgerEntry mutation called.");
      } else {
        console.log(`SalesLedger: User (${loggedInUserSub}) adding ledger entry for themselves (userIdForData: ${userIdForData}).`);
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
      // Refetch data for the user whose ledger was affected (userIdForData)
      // The subscription should also trigger this, but an explicit call ensures immediate UI feedback.
      await fetchInitialEntries(userIdForData);
      if (entryData.type === "INVOICE") { 
          await fetchInitialStatus(userIdForData);
      }
    } catch (err: any) {
      console.error("SalesLedger: Error adding ledger entry", err);
      const errorMessages = err.errors && Array.isArray(err.errors) ? err.errors.map((e: any) => e.message).join(', ') : err.message || 'Unknown error';
      setError(`Failed to save transaction: ${errorMessages}`);
    }
  };

  const handlePaymentRequest = async (amount: number) => {
    if (!loggedInUserSub) { setError("Your session is invalid. Cannot request payment."); return; }
    if (!userIdForData) { setError("User context for action is not available."); return;}
    
    setPaymentRequestLoading(true); setPaymentRequestError(null); setPaymentRequestSuccess(null);
    
    try {
      if (isAdmin && targetUserId && targetUserId === userIdForData) {
        console.log(`SalesLedger: Admin (${loggedInUserSub}) requesting payment FOR target user: ${targetUserId}`);
        const adminInput: AdminRequestPaymentForUserInput = {
            targetUserId: targetUserId,
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
        console.log(`SalesLedger: User (${loggedInUserSub}) requesting payment for themselves (userIdForData: ${userIdForData}).`);
        const result = await client.graphql<SendPaymentRequestEmailMutation>({
          query: SendPaymentRequestEmailDocument,
          variables: { amount: amount }, 
          authMode: 'userPool'
        });
        const responseMessage = result.data?.sendPaymentRequestEmail;
        setPaymentRequestSuccess(responseMessage ?? 'Payment request submitted successfully!');
      }
      // Refetch transactions for the user whose account was affected.
      await fetchInitialTransactions(userIdForData); 
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
  // (Slightly adjusted loading state logic for clarity)
  if (!loggedInUserSub && !targetUserId) { // Still waiting for loggedInUserSub and not an admin viewing a target initially
    if (error) return <Alert variation="error" heading="Session Error">{error}</Alert>; // Show error if loggedInUserSub fetch failed
    return ( <View padding="xl" textAlign="center"><Loader size="large" /> <Text>Initializing user session...</Text></View> );
  }

  if (isAdmin && !targetUserId) { // Admin page, but no specific user selected to view
    if (error) return <Alert variation="error" heading="Error">{error}</Alert>; // General error for admin page
    return ( <View padding="xl"><Alert variation="info">Please select a user to view their sales ledger details.</Alert></View> );
  }
  
  if (!userIdForData) { // Waiting for userIdForData to be determined from props/loggedInUserSub
    if (error) return <Alert variation="error" heading="Error">{error}</Alert>;
      return ( <View padding="xl" textAlign="center"><Loader size="large" /><Text>Loading user context...</Text></View> )
  }

  // If userIdForData is set, but data is loading for that user:
  if (loadingEntries || loadingStatus || loadingTransactions) {
    return ( <View padding="xl" textAlign="center"><Loader size="large" /> <Text>Loading data for {isAdmin && targetUserId ? `user ${targetUserId.substring(0,8)}...` : 'you'}...</Text></View> );
  }

   // If there was an error during data fetching for userIdForData (and not initial session error)
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
      />
      <LedgerEntryForm 
        onSubmit={handleAddLedgerEntry} 
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