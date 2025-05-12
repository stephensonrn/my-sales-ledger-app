// src/SalesLedger.tsx
import React, { useState, useEffect, useCallback } from 'react'; // Added useCallback for completeness if needed, though not strictly used for the fix
import { generateClient } from 'aws-amplify/api';
import { getCurrentUser } from 'aws-amplify/auth';
import type { ObservableSubscription } from '@aws-amplify/api-graphql';

// --- UPDATED IMPORTS from ./graphql/generated/graphql.ts ---
// Verify these names match your generated file
import {
  ListLedgerEntriesDocument,
  ListAccountStatusesDocument,
  ListCurrentAccountTransactionsDocument,
  CreateLedgerEntryDocument,
  SendPaymentRequestEmailDocument,
  OnCreateLedgerEntryDocument
} from './graphql/generated/graphql';
import type {
  LedgerEntry,
  AccountStatus,
  CurrentAccountTransaction,
  CreateLedgerEntryInput,
  LedgerEntryType,
//   CurrentAccountTransactionType, // This was in your original, but not used in the provided snippet. Keep if used elsewhere.
  OnCreateLedgerEntrySubscription,
  OnCreateLedgerEntrySubscriptionVariables, // Verify if this exact name is generated
  ListLedgerEntriesQuery,
  ListAccountStatusesQuery,
  ListCurrentAccountTransactionsQuery,
  CreateLedgerEntryMutation,
  SendPaymentRequestEmailMutation
} from './graphql/generated/graphql';
// --- END UPDATED IMPORTS ---

import CurrentBalance from './CurrentBalance';
import LedgerEntryForm from './LedgerEntryForm';
import LedgerHistory from './LedgerHistory';
import AvailabilityDisplay from './AvailabilityDisplay';
import PaymentRequestForm from './PaymentRequestForm';
import { Loader, Text, Alert } from '@aws-amplify/ui-react';

const client = generateClient();
const ADVANCE_RATE = 0.90;

function SalesLedger() {
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
  const [grossAvailTemp, setGrossAvailTemp] = useState(0); // Intermediate state for calculation
  const [netAvailTemp, setNetAvailTemp] = useState(0);     // Intermediate state for calculation

  const [paymentRequestLoading, setPaymentRequestLoading] = useState(false);
  const [paymentRequestError, setPaymentRequestError] = useState<string | null>(null);
  const [paymentRequestSuccess, setPaymentRequestSuccess] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserId = async () => {
      try {
        const { userId: sub } = await getCurrentUser();
        setUserId(sub);
      } catch (err) {
        console.error("SalesLedger: Error fetching user details:", err);
        setUserId(null);
        setError("Could not retrieve user session. Please ensure you are logged in.");
      }
    };
    fetchUserId();
  }, []);

  // Define fetch functions - these might be memoized with useCallback if dependencies become complex,
  // but for now, defining them here is fine as their dependencies are primarily 'userId' for the queries.

  const fetchInitialEntries = async () => {
    if (!userId) { setLoadingEntries(false); setEntries([]); return; }
    setLoadingEntries(true); setError(null);
    try {
      const response = await client.graphql<ListLedgerEntriesQuery>({
        query: ListLedgerEntriesDocument,
        variables: { filter: { owner: { eq: userId } } },
        authMode: 'userPool'
      });
      const items = response.data?.listLedgerEntries?.items?.filter(item => item !== null) as LedgerEntry[] || [];
      setEntries(items.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
    } catch (err: any) {
      const errorMessages = (err.errors as any[])?.map(e => e.message).join(', ') || err.message || 'Unknown error';
      setError(`Ledger history error: ${errorMessages}`); setEntries([]);
    } finally { setLoadingEntries(false); }
  };

  const fetchInitialStatus = async () => {
    if (!userId) { setLoadingStatus(false); setAccountStatus(null); return; }
    setLoadingStatus(true); setError(null);
    try {
      const response = await client.graphql<ListAccountStatusesQuery>({
        query: ListAccountStatusesDocument,
        variables: { filter: { owner: { eq: userId } }, limit: 1 },
        authMode: 'userPool'
      });
      const items = response.data?.listAccountStatuses?.items?.filter(item => item !== null) as AccountStatus[] || [];
      setAccountStatus(items.length > 0 ? items[0] : null);
    } catch (err: any) {
      const errorMessages = (err.errors as any[])?.map(e => e.message).join(', ') || err.message || 'Unknown error';
      setError(`Account status error: ${errorMessages}`); setAccountStatus(null);
    } finally { setLoadingStatus(false); }
  };

  const fetchInitialTransactions = async () => {
    if (!userId) { setLoadingTransactions(false); setCurrentAccountTransactions([]); return; }
    setLoadingTransactions(true); setError(null);
    try {
      const response = await client.graphql<ListCurrentAccountTransactionsQuery>({
        query: ListCurrentAccountTransactionsDocument,
        variables: { filter: { owner: { eq: userId } } },
        authMode: 'userPool'
      });
      const items = response.data?.listCurrentAccountTransactions?.items?.filter(item => item !== null) as CurrentAccountTransaction[] || [];
      setCurrentAccountTransactions(items.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
    } catch (err: any) {
      const errorMessages = (err.errors as any[])?.map(e => e.message).join(', ') || err.message || 'Unknown error';
      setError(`Account transaction error: ${errorMessages}`); setCurrentAccountTransactions([]);
    } finally { setLoadingTransactions(false); }
  };


  useEffect(() => {
    if (userId) {
      fetchInitialEntries();
      fetchInitialStatus();
      fetchInitialTransactions();
    }
  }, [userId]); // Removed individual fetch functions from here to avoid direct call in this effect

  useEffect(() => {
    if (!userId) return;
    const clientInstance = generateClient(); // Ensure client is fresh if needed for subscription
    const subscription = clientInstance.graphql<ObservableSubscription<OnCreateLedgerEntrySubscription, OnCreateLedgerEntrySubscriptionVariables>>({
      query: OnCreateLedgerEntryDocument,
      variables: { owner: userId } as OnCreateLedgerEntrySubscriptionVariables, // Explicitly cast if type mismatch
      authMode: 'userPool'
    }).subscribe({
      next: ({ data }) => {
        const newEntry = data?.onCreateLedgerEntry;
        if (newEntry) {
          console.log("Subscription received new ledger entry:", newEntry);
          // Re-fetch entries to ensure all data is consistent, or update intelligently
          fetchInitialEntries();
          // Optionally, if a new entry could affect status (e.g. unapproved invoice value changes on backend)
          // fetchInitialStatus();
        }
      },
      error: (err: any) => { console.error("SalesLedger Subscription error:", err); setError("Subscription error, please refresh.") }
    });
    return () => subscription.unsubscribe();
  }, [userId]); // Removed fetchInitialEntries from dependency array to avoid re-subscribing on every entries change


  useEffect(() => {
    let calculatedSLBalance = 0;
    entries.forEach(entry => {
      if (!entry) return;
      switch (entry.type as string) { // Using string literals for enum comparison
        case "INVOICE": case "INCREASE_ADJUSTMENT": calculatedSLBalance += entry.amount; break;
        case "CREDIT_NOTE": case "DECREASE_ADJUSTMENT": case "CASH_RECEIPT": calculatedSLBalance -= entry.amount; break;
        default: break;
      }
    });
    setCurrentSalesLedgerBalance(parseFloat(calculatedSLBalance.toFixed(2)));
  }, [entries]);

  useEffect(() => {
    let calculatedAccBalance = 0;
    currentAccountTransactions.forEach(transaction => {
      if (!transaction) return;
      // Assuming CurrentAccountTransactionType has similar enum values as LedgerEntryType
      // Adjust case strings if CurrentAccountTransactionType enums are different
      switch (transaction.type as string) {
        case "PAYMENT_REQUEST": calculatedAccBalance += transaction.amount; break; // Money drawn by user increases this balance
        case "CASH_RECEIPT": calculatedAccBalance -= transaction.amount; break; // Cash receipt on current account reduces drawn amount
        default: break;
      }
    });
    setCalculatedCurrentAccountBalance(parseFloat(calculatedAccBalance.toFixed(2)));
  }, [currentAccountTransactions]);

  useEffect(() => {
    const unapprovedValue = accountStatus?.totalUnapprovedInvoiceValue ?? 0;
    const grossAvail = (currentSalesLedgerBalance - unapprovedValue) * ADVANCE_RATE;
    setGrossAvailTemp(grossAvail);
  }, [currentSalesLedgerBalance, accountStatus, ADVANCE_RATE]); // Added ADVANCE_RATE as it's used

  useEffect(() => {
    const netAvail = grossAvailTemp - calculatedCurrentAccountBalance;
    setNetAvailTemp(netAvail);
  }, [grossAvailTemp, calculatedCurrentAccountBalance]);

  useEffect(() => { setGrossAvailability(Math.max(0, parseFloat(grossAvailTemp.toFixed(2)))); }, [grossAvailTemp]);
  useEffect(() => { setNetAvailability(Math.max(0, parseFloat(netAvailTemp.toFixed(2)))); }, [netAvailTemp]);

  const handleAddLedgerEntry = async (entryData: { type: string, amount: number, description?: string }) => {
    if (!userId) { setError("User not identified. Cannot add entry."); return;} // Guard for userId
    setError(null);
    try {
      const input: CreateLedgerEntryInput = {
        type: entryData.type as LedgerEntryType, // Ensure LedgerEntryType covers all string values
        amount: entryData.amount,
        description: entryData.description || null,
        // owner: userId, // If your schema requires owner on create, it's often handled by resolver or you add it
      };
      await client.graphql<CreateLedgerEntryMutation>({
        query: CreateLedgerEntryDocument,
        variables: { input: input },
        authMode: 'userPool'
      });
      // Subscription should handle UI update, but if not, call fetchInitialEntries() here.
      // await fetchInitialEntries(); // Consider if needed if subscription is unreliable or for immediate feedback
      // await fetchInitialStatus(); // If new entries affect account status (e.g. unapproved invoice total)
    } catch (err: any) {
      const errors = err.errors || [err];
      setError(`Failed to save transaction: ${errors[0]?.message || 'Unknown error'}`);
    }
  };

  // --- MODIFIED FUNCTION ---
  const handlePaymentRequest = async (amount: number) => {
    setPaymentRequestLoading(true);
    setPaymentRequestError(null);
    setPaymentRequestSuccess(null);
    try {
      // API Call to submit the payment request
      const result = await client.graphql<SendPaymentRequestEmailMutation>({
        query: SendPaymentRequestEmailDocument,
        variables: { amount: amount }, // 'owner' might be inferred by backend based on Cognito identity
        authMode: 'userPool'
      });
      const responseMessage = result.data?.sendPaymentRequestEmail;

      // Robust error checking from GraphQL response
      if (result.errors && result.errors.length > 0) {
        console.error("GraphQL errors on payment request:", result.errors);
        throw result.errors[0]; // Throw the first GraphQL error to be caught by the catch block
      }

      setPaymentRequestSuccess(responseMessage ?? 'Request submitted successfully!');
      console.log("Payment request successful, now refreshing data...");

      // --- KEY CHANGE: Re-fetch data after successful submission ---
      // This will update currentAccountTransactions, which in turn updates netAvailability through useEffects
      await fetchInitialTransactions();

      // Optional: Consider if other data also needs refreshing.
      // If a payment request could somehow impact the overall AccountStatus directly
      // (e.g., if the backend updates a limit or flag on AccountStatus upon payment):
      // await fetchInitialStatus();

    } catch (err: any) {
      // This catch block will handle errors thrown from client.graphql or manually thrown GraphQL errors
      const errorMessage = err.message || (err.errors && err.errors[0]?.message) || 'Unknown error during payment request.';
      setPaymentRequestError(`Failed to submit request: ${errorMessage}`);
      setPaymentRequestSuccess(null); // Clear any optimistic success message
      console.error("Payment request error details:", err);
    } finally {
      setPaymentRequestLoading(false);
    }
  };
  // --- END MODIFIED FUNCTION ---


  if (userId === null && !error) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Loader size="large" /> <Text marginLeft="small">Initializing session...</Text>
      </div>
    );
  }
  if (error && userId === null) {
     return <Alert variation="error" heading="Session Error">{error}</Alert>;
  }
  // Show main loader if userId is present but initial data is still loading
  if (loadingEntries || loadingStatus || loadingTransactions) {
     return (
       <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
         <Loader size="large" /> <Text marginLeft="small">Loading application data...</Text>
       </div>
     );
  }

  return (
    <div style={{ padding: '20px' }}>
      <h2>Sales Ledger</h2>
      {error && !loadingEntries && !loadingStatus && !loadingTransactions && ( // Display general errors only if not in initial loading state
         <Alert variation="error" isDismissible={true} onDismiss={() => setError(null)}>{error}</Alert>
      )}
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
      <LedgerEntryForm onSubmit={handleAddLedgerEntry} />
      <div style={{marginTop: '30px'}}>
        <h3>Sales Ledger Transaction History</h3>
        <LedgerHistory entries={entries} historyType="sales" isLoading={loadingEntries} />
      </div>
      <div style={{marginTop: '30px'}}>
        <h3>Current Account Transaction History</h3>
        {/* Assuming CurrentAccountTransaction can be displayed by LedgerHistory or a similar component */}
        <LedgerHistory entries={currentAccountTransactions as unknown as LedgerEntry[]} historyType="account" isLoading={loadingTransactions} />
      </div>
    </div>
  );
}
export default SalesLedger;