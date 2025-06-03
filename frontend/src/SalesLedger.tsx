// src/SalesLedger.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { generateClient } from 'aws-amplify/api';
import { getCurrentUser } from 'aws-amplify/auth';
import type { ObservableSubscription } from '@aws-amplify/api-graphql';

// Operation Documents from src/graphql/operations/
import {
    listLedgerEntries,
    listAccountStatuses,
    listCurrentAccountTransactions
} from './graphql/operations/queries';
import {
    createLedgerEntry,
    adminCreateLedgerEntry,
    sendPaymentRequestEmail,
    adminRequestPaymentForUser,
    updateLedgerEntry,
    deleteLedgerEntry
} from './graphql/operations/mutations';
import { onCreateLedgerEntry } from './graphql/operations/subscriptions';

// Types from src/graphql/API.ts
import {
    LedgerEntryType,
    CurrentAccountTransactionType,
    type LedgerEntry,
    type AccountStatus,
    type CurrentAccountTransaction,
    type CreateLedgerEntryInput,
    type UpdateLedgerEntryInput,
    type DeleteLedgerEntryMutationVariables,
    type AdminCreateLedgerEntryInput,
    type AdminRequestPaymentForUserInput,
    type SendPaymentRequestInput, // Ensure this type includes toEmail, subject, body
    type OnCreateLedgerEntrySubscription,
    type OnCreateLedgerEntrySubscriptionVariables,
    type ListLedgerEntriesQuery,
    type ListAccountStatusesQuery,
    type ListCurrentAccountTransactionsQuery,
    type CreateLedgerEntryMutation,
    type UpdateLedgerEntryMutation,
    type DeleteLedgerEntryMutation,
    type AdminCreateLedgerEntryMutation,
    type SendPaymentRequestEmailMutation,
    type AdminRequestPaymentForUserMutation,
    type AdminPaymentRequestResult
} from './graphql/API';

import CurrentBalance from './CurrentBalance';
import LedgerEntryForm from './LedgerEntryForm';
import LedgerHistory from './LedgerHistory';
import AvailabilityDisplay from './AvailabilityDisplay';
import PaymentRequestForm from './PaymentRequestForm';
import { Loader, Text, Alert, View, Flex, Heading } from '@aws-amplify/ui-react'; // Added Flex and Heading here

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
      console.log("SalesLedger: Admin view, but no targetUserId. Clearing data and loaders.");
      setUserIdForData(null);
      setEntries([]);
      setAccountStatus(null);
      setCurrentAccountTransactions([]);
      setLoadingEntries(false);
      setLoadingStatus(false);
      setLoadingTransactions(false);
    } else {
      setUserIdForData(null);
    }
  }, [isAdmin, targetUserId, loggedInUserSub]);

  const fetchInitialEntries = useCallback(async (idToFetch: string) => {
    setLoadingEntries(true); setError(null);
    console.log("SALESLEDGER.TSX: Attempting to fetchInitialEntries for user:", idToFetch);
    try {
      const response = await client.graphql<ListLedgerEntriesQuery>({
        query: listLedgerEntries,
        variables: { filter: { owner: { eq: idToFetch } } },
        authMode: 'userPool'
      });
      console.log("SalesLedger: ListLedgerEntries response:", response);
      if (response.errors) throw response.errors;
      const items = response.data?.listLedgerEntries?.items?.filter(item => item !== null) as LedgerEntry[] || [];
      setEntries(items.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
    } catch (err: any) {
      console.error("SalesLedger: Ledger history error for user", idToFetch, err);
      const errorMessages = err.errors && Array.isArray(err.errors) ? err.errors.map((e: any) => e.message).join(', ') : err.message || 'Unknown error fetching ledger history.';
      setError(`Ledger history error: ${errorMessages}`); setEntries([]);
    } finally { setLoadingEntries(false); }
  }, []);

  const fetchInitialStatus = useCallback(async (idToFetch: string) => {
    setLoadingStatus(true); setError(null);
    console.log("SALESLEDGER.TSX: Attempting to fetchInitialStatus for user:", idToFetch);
    try {
      const response = await client.graphql<ListAccountStatusesQuery>({
        query: listAccountStatuses,
        variables: { filter: { owner: { eq: idToFetch } }, limit: 1 },
        authMode: 'userPool'
      });
      console.log("SalesLedger: ListAccountStatuses response:", response);
      if (response.errors) throw response.errors;
      const items = response.data?.listAccountStatuses?.items?.filter(item => item !== null) as AccountStatus[] || [];
      setAccountStatus(items.length > 0 ? items[0] : null);
    } catch (err: any) {
      console.error(`SalesLedger: Account status error for user ${idToFetch}`, err);
      const errorMessages = err.errors && Array.isArray(err.errors) ? err.errors.map((e: any) => e.message).join(', ') : err.message || 'Unknown error fetching account status.';
      setError(`Account status error: ${errorMessages}`); setAccountStatus(null);
    } finally { setLoadingStatus(false); }
  }, []);

  const fetchInitialTransactions = useCallback(async (idToFetch: string) => {
    setLoadingTransactions(true); setError(null);
    console.log("SALESLEDGER.TSX: Attempting to fetchInitialTransactions for user:", idToFetch);
    try {
      const response = await client.graphql<ListCurrentAccountTransactionsQuery>({
        query: listCurrentAccountTransactions,
        variables: { filter: { owner: { eq: idToFetch } } },
        authMode: 'userPool'
      });
      console.log("SalesLedger: ListCurrentAccountTransactions response:", response);
      if (response.errors) throw response.errors;
      const items = response.data?.listCurrentAccountTransactions?.items?.filter(item => item !== null) as CurrentAccountTransaction[] || [];
      setCurrentAccountTransactions(items.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
    } catch (err: any) {
      console.error("SalesLedger: Account transaction error for user", idToFetch, err);
      const errorMessages = err.errors && Array.isArray(err.errors) ? err.errors.map((e: any) => e.message).join(', ') : err.message || 'Unknown error fetching account transactions.';
      setError(`Account transaction error: ${errorMessages}`); setCurrentAccountTransactions([]);
    } finally { setLoadingTransactions(false); }
  }, []);

  useEffect(() => {
    console.log("SalesLedger: Data Fetch Effect triggered. userIdForData:", userIdForData);
    if (userIdForData) {
      setLoadingEntries(true);
      setLoadingStatus(true);
      setLoadingTransactions(true);
      setError(null);

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
      query: onCreateLedgerEntry,
      variables: { owner: userIdForData } as OnCreateLedgerEntrySubscriptionVariables,
      authMode: 'userPool'
    }).subscribe({
      next: ({ data }) => {
        const newEntry = data?.onCreateLedgerEntry;
        console.log("SalesLedger: Subscription received data:", newEntry);
        if (newEntry && newEntry.owner === userIdForData) {
          console.log("SalesLedger: Subscription received new ledger entry for current userIdForData:", newEntry.id);
          fetchInitialEntries(userIdForData);
          if (newEntry.type === LedgerEntryType.INVOICE) {
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
    entries.forEach(entry => {
      if (entry.type === LedgerEntryType.INVOICE || entry.type === LedgerEntryType.INCREASE_ADJUSTMENT) {
        calculatedSLBalance += entry.amount;
      } else if (entry.type === LedgerEntryType.CREDIT_NOTE || entry.type === LedgerEntryType.DECREASE_ADJUSTMENT || entry.type === LedgerEntryType.CASH_RECEIPT) {
        calculatedSLBalance -= entry.amount;
      }
    });
    setCurrentSalesLedgerBalance(parseFloat(calculatedSLBalance.toFixed(2)));
  }, [entries]);

  useEffect(() => {
    let calculatedAccBalance = 0;
    currentAccountTransactions.forEach(transaction => {
      if (transaction.type === CurrentAccountTransactionType.PAYMENT_REQUEST) {
        calculatedAccBalance += transaction.amount;
      } else if (transaction.type === CurrentAccountTransactionType.CASH_RECEIPT) {
        calculatedAccBalance -= transaction.amount;
      }
    });
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
    if (!loggedInUserSub) { setError("Your session is invalid. Cannot add entry."); return; }
    if (!userIdForData && !isAdmin) { setError("User context not available for action."); return; }
    if (isAdmin && !targetUserId && !userIdForData) { setError("No target user selected by admin for action."); return; }

    const effectiveUserIdForDisplayRefresh = userIdForData;
    if(!effectiveUserIdForDisplayRefresh) { setError("Target user for display refresh is unclear."); return; }

    setError(null);
    try {
      if (isAdmin && targetUserId && targetUserId === userIdForData) {
        console.log(`SalesLedger: Admin (${loggedInUserSub}) adding ledger entry FOR target user: ${targetUserId}`);
        const adminInput: AdminCreateLedgerEntryInput = {
          type: entryData.type as LedgerEntryType,
          amount: entryData.amount,
          description: entryData.description || undefined,
          targetUserId: targetUserId,
        };
        await client.graphql<AdminCreateLedgerEntryMutation>({
          query: adminCreateLedgerEntry,
          variables: { input: adminInput },
          authMode: 'userPool'
        });
        console.log("SalesLedger: AdminCreateLedgerEntry mutation called successfully.");
      } else {
        console.log(`SalesLedger: User (${loggedInUserSub}) adding ledger entry for themselves (acting for user ID: ${userIdForData}).`);
        const input: CreateLedgerEntryInput = {
          type: entryData.type as LedgerEntryType,
          amount: entryData.amount,
          description: entryData.description || undefined,
        };
        await client.graphql<CreateLedgerEntryMutation>({
          query: createLedgerEntry,
          variables: { input: input },
          authMode: 'userPool'
        });
        console.log("SalesLedger: CreateLedgerEntry mutation called successfully.");
      }
      
      await fetchInitialEntries(effectiveUserIdForDisplayRefresh);
      if (entryData.type === LedgerEntryType.INVOICE) {
        await fetchInitialStatus(effectiveUserIdForDisplayRefresh);
      }

    } catch (err: any) {
      console.error("SalesLedger: Error adding ledger entry", err);
      const errorMessages = err.errors && Array.isArray(err.errors) ? err.errors.map((e: any) => e.message).join(', ') : err.message || 'Unknown error while adding entry.';
      setError(`Failed to save transaction: ${errorMessages}`);
    }
  };

  const handlePaymentRequest = async (amount: number) => {
    if (!loggedInUserSub) { 
        setError("Your session is invalid. Cannot request payment."); 
        setPaymentRequestLoading(false); // Also reset loading if returning early
        return; 
    }
    // Ensure userIdForData is available for non-admins or matches targetUserId for admins
    if (!userIdForData) {
        setError("User context for action is not available. Please select a user or ensure you are logged in.");
        setPaymentRequestLoading(false);
        return;
    }
    // For admins, targetUserId must be set if they intend to act on behalf of someone.
    // If isAdmin is true, and targetUserId is what they're acting on, userIdForData should equal targetUserId.
    if (isAdmin && (!targetUserId || targetUserId !== userIdForData)) {
        setError("Admin action: Target user context is unclear or does not match. Please select a user.");
        setPaymentRequestLoading(false);
        return;
    }
    
    setPaymentRequestLoading(true); setPaymentRequestError(null); setPaymentRequestSuccess(null);
    
    const effectiveUserIdForDisplayRefresh = userIdForData; 

    try {
      if (isAdmin && targetUserId && targetUserId === userIdForData) {
        console.log(`SalesLedger: Admin (${loggedInUserSub}) requesting payment FOR target user: ${targetUserId}`);
        const adminInput: AdminRequestPaymentForUserInput = {
            targetUserId: targetUserId,
            amount: amount,
            paymentDescription: `Payment request for user ${targetUserId} initiated by admin ${loggedInUserSub}`
        };
        const result = await client.graphql<AdminRequestPaymentForUserMutation>({
            query: adminRequestPaymentForUser,
            variables: { input: adminInput },
            authMode: 'userPool'
        });
        console.log("SalesLedger: AdminRequestPaymentForUser response:", result);
        if(result.errors) throw result.errors;
        const responseData = result.data?.adminRequestPaymentForUser;
        if (responseData?.success) {
            setPaymentRequestSuccess(responseData.message || `Admin: Payment request for user ${targetUserId.substring(0,8)}... submitted successfully! Transaction ID: ${responseData.transactionId || 'N/A'}`);
        } else {
            throw new Error(responseData?.message || "Admin payment request failed without specific message from backend.");
        }
      } else { // Non-admin user requesting for themselves
        console.log(`SalesLedger: User (${loggedInUserSub}) requesting payment for themselves (acting for user ID: ${userIdForData}).`);
        
        const toEmailValue = "ross@aurumif.com"; // Hardcoded as requested
        const subjectValue = `Payment Request - Amount: £${amount.toFixed(2)} from user ${loggedInUserSub}`;
        const bodyValue = `User (sub: ${loggedInUserSub}, acting for data of user ID: ${userIdForData}) has requested a payment of £${amount.toFixed(2)}. Thank you.`;

        const input: SendPaymentRequestInput = { 
          amount: amount,
          toEmail: toEmailValue,
          subject: subjectValue,
          body: bodyValue
        }; 
        
        const result = await client.graphql<SendPaymentRequestEmailMutation>({
          query: sendPaymentRequestEmail,
          variables: { input: input }, 
          authMode: 'userPool'
        });
        console.log("SalesLedger: SendPaymentRequestEmail response:", result);
        if(result.errors) throw result.errors;
        const responseMessage = result.data?.sendPaymentRequestEmail;
        setPaymentRequestSuccess(responseMessage ?? 'Payment request submitted successfully!');
      }
      await fetchInitialTransactions(effectiveUserIdForDisplayRefresh); 
    } catch (err: any) {
      console.error("SalesLedger: Error requesting payment", err);
      const errorMessage = err.errors && Array.isArray(err.errors) ? err.errors.map((e:any) => e.message).join(", ") : err.message || 'Unknown error processing payment request.';
      setPaymentRequestError(`Failed to submit payment request: ${errorMessage}`);
      setPaymentRequestSuccess(null);
    } finally {
      setPaymentRequestLoading(false);
    }
  };

  // --- Render Logic ---
  if (!loggedInUserSub && !targetUserId && !isAdmin) { 
    if (error && error.startsWith("Could not retrieve current user session")) {
        return <Alert variation="error" heading="Session Error">{error}</Alert>; 
    }
    return ( <View padding="xl" textAlign="center"><Loader size="large" /> <Text>Initializing user session...</Text></View> );
  }

  if (isAdmin && !targetUserId) { 
    if (error) { 
        return <Alert variation="error" heading="Admin Page Error">{error}</Alert>; 
    }
    return ( <View padding="xl"><Alert variation="info">Please select a user from the list on the Admin Page to view their sales ledger details.</Alert></View> );
  }
  
  if (!userIdForData) { 
    if (error) { 
        return <Alert variation="error" heading="Error">{error}</Alert>;
    }
      return ( <View padding="xl" textAlign="center"><Loader size="large" /><Text>Loading user context...</Text></View> )
  }

   if (error && !loadingEntries && !loadingStatus && !loadingTransactions) { 
     return <Alert variation="error" isDismissible={true} onDismiss={() => setError(null)}>{error}</Alert>;
   }

  if (loadingEntries || loadingStatus || loadingTransactions) {
    return ( <View padding="xl" textAlign="center"><Loader size="large" /> <Text>Loading data for {isAdmin && targetUserId ? `user ${targetUserId.substring(0,8)}...` : 'you'}...</Text></View> );
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
        <LedgerHistory entries={currentAccountTransactions as any} historyType="account" isLoading={loadingTransactions} />
      </div>
    </div>
  );
}
export default SalesLedger;