// src/SalesLedger.tsx
import React, { useState, useEffect } from 'react';
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
  CurrentAccountTransactionType,
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
  const [grossAvailTemp, setGrossAvailTemp] = useState(0);
  const [netAvailTemp, setNetAvailTemp] = useState(0);

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
        setError("Could not retrieve user session.");
      }
    };
    fetchUserId();
  }, []);

  useEffect(() => {
    if (!userId) { setLoadingEntries(false); setEntries([]); return; }
    const fetchInitialEntries = async () => {
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
    fetchInitialEntries();
  }, [userId]);

  useEffect(() => {
    if (!userId) { setLoadingStatus(false); setAccountStatus(null); return; }
    const fetchInitialStatus = async () => {
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
    fetchInitialStatus();
  }, [userId]);

  useEffect(() => {
    if (!userId) { setLoadingTransactions(false); setCurrentAccountTransactions([]); return; }
    const fetchInitialTransactions = async () => {
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
    fetchInitialTransactions();
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const sub = client.graphql<ObservableSubscription<OnCreateLedgerEntrySubscription, OnCreateLedgerEntrySubscriptionVariables>>({
      query: OnCreateLedgerEntryDocument,
      variables: { owner: userId },
      authMode: 'userPool'
    }).subscribe({
      next: ({ data }) => {
        const newEntry = data?.onCreateLedgerEntry;
        if (newEntry) {
          setEntries(prevEntries => {
            if (prevEntries.some(entry => entry.id === newEntry.id)) return prevEntries;
            return [...prevEntries, newEntry as LedgerEntry].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
          });
        }
      },
      error: (err: any) => { console.error("SalesLedger Subscription error:", err); }
    });
    return () => sub.unsubscribe();
  }, [userId]);

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
      switch (transaction.type as string) { // Using string literals for enum comparison
        case "PAYMENT_REQUEST": calculatedAccBalance += transaction.amount; break;
        case "CASH_RECEIPT": calculatedAccBalance -= transaction.amount; break;
        default: break;
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
    setError(null);
    try {
      const input: CreateLedgerEntryInput = {
        type: entryData.type as LedgerEntryType,
        amount: entryData.amount,
        description: entryData.description || null
      };
      await client.graphql<CreateLedgerEntryMutation>({
        query: CreateLedgerEntryDocument,
        variables: { input: input },
        authMode: 'userPool'
      });
    } catch (err: any) {
      const errors = err.errors || [err];
      setError(`Failed to save transaction: ${errors[0]?.message || 'Unknown error'}`);
    }
  };

  const handlePaymentRequest = async (amount: number) => {
    setPaymentRequestLoading(true); setPaymentRequestError(null); setPaymentRequestSuccess(null);
    try {
      const result = await client.graphql<SendPaymentRequestEmailMutation>({
        query: SendPaymentRequestEmailDocument,
        variables: { amount: amount },
        authMode: 'userPool'
      });
      const responseMessage = result.data?.sendPaymentRequestEmail;
      if (result.errors) throw result.errors[0];
      setPaymentRequestSuccess(responseMessage ?? 'Request submitted successfully!');
    } catch (err: any) {
      const errors = err.errors || [err];
      setPaymentRequestError(`Failed to submit request: ${errors[0]?.message || 'Unknown error'}`);
      setPaymentRequestSuccess(null);
    } finally { setPaymentRequestLoading(false); }
  };

  if (userId === null && !error) { // Show loader if userId is null AND there's no auth error yet
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Loader size="large" /> <Text marginLeft="small">Initializing session...</Text>
      </div>
    );
  }
  if (error && userId === null) { // If there was an error fetching userId (e.g. not logged in)
     return <Alert variation="error">{error}</Alert>;
  }
  // Show main loader if userId is present but data is still loading
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
      {/* Display general errors not caught by specific loaders */}
      {error && !loadingEntries && !loadingStatus && !loadingTransactions && (
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
        <LedgerHistory entries={currentAccountTransactions} historyType="account" isLoading={loadingTransactions} />
      </div>
    </div>
  );
}
export default SalesLedger;