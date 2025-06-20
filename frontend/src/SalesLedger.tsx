// src/SalesLedger.tsx
import React, { useState, useEffect, useMemo, useCallback } from 'react'; // Add useCallback
import { generateClient } from 'aws-amplify/api';
import { getCurrentUser } from 'aws-amplify/auth';
import { Hub } from 'aws-amplify/utils';
import {
  listLedgerEntries,
  listCurrentAccountTransactions
} from './graphql/operations/queries';
import {
  createLedgerEntry,
  adminCreateLedgerEntry,
} from './graphql/operations/mutations';
import { onCreateLedgerEntry } from './graphql/operations/subscriptions';
import {
  type LedgerEntry,
  type CurrentAccountTransaction,
  type CreateLedgerEntryInput,
  type AdminCreateLedgerEntryInput,
  LedgerEntryType
} from './graphql/API';
import CurrentBalance from './CurrentBalance';
import LedgerEntryForm from './LedgerEntryForm';
import LedgerHistory from './LedgerHistory';
import AvailabilityDisplay from './AvailabilityDisplay';
import { Loader, Alert, View } from '@aws-amplify/ui-react';

const ADVANCE_RATE = 0.9;

interface SalesLedgerProps {
  targetUserId?: string | null;
  isAdmin?: boolean;
}

function SalesLedger({ targetUserId, isAdmin = false }: SalesLedgerProps) {
  const [client] = useState(generateClient());
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [currentAccountTransactions, setCurrentAccountTransactions] = useState<CurrentAccountTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- This function now wrapped in useCallback for stability ---
  const loadDataAndSubscribe = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const user = await getCurrentUser();
      const ownerId = isAdmin ? targetUserId : (user.username || user.attributes?.sub);

      if (!ownerId) {
        setLoading(false);
        return;
      }
      
      let allLedgerEntries: LedgerEntry[] = [];
      let nextToken: string | null | undefined = null;
      do {
        const ledgerRes: any = await client.graphql({
          query: listLedgerEntries,
          variables: { filter: { owner: { eq: ownerId } }, limit: 100, nextToken }
        });
        const ledgerItems = ledgerRes?.data?.listLedgerEntries?.items?.filter(Boolean) || [];
        allLedgerEntries.push(...ledgerItems);
        nextToken = ledgerRes?.data?.listLedgerEntries?.nextToken;
      } while (nextToken);
      
      const transactionsRes: any = await client.graphql({
        query: listCurrentAccountTransactions,
        variables: { filter: { owner: { eq: ownerId } } }
      });
      const transactionItems = transactionsRes?.data?.listCurrentAccountTransactions?.items?.filter(Boolean) || [];

      setEntries(allLedgerEntries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      setCurrentAccountTransactions(transactionItems);
      
    } catch (err) {
      // It's possible to fail if session isn't ready. Don't show an error for this.
      console.error("Data loading failed, likely a timing issue:", err);
    } finally {
      setLoading(false);
    }
  }, [client, isAdmin, targetUserId]); // Dependencies for the data loading function

  // --- Main useEffect Hook ---
  useEffect(() => {
    let subscription: any;
    let isMounted = true; // Prevent state updates on unmounted component

    const setupSubscriptions = async () => {
        try {
            const user = await getCurrentUser();
            const ownerId = isAdmin ? targetUserId : (user.username || user.attributes?.sub);
            if (!ownerId || !isMounted) return;

            subscription = client.graphql({
                query: onCreateLedgerEntry,
                variables: { owner: ownerId }
            }).subscribe({
                next: ({ data }) => {
                    const newTransaction = data?.onCreateLedgerEntry;
                    if (newTransaction && isMounted) {
                        setEntries((prev) => [newTransaction, ...prev.filter(e => e.id !== newTransaction.id)]);
                    }
                },
                error: (err) => console.error("Subscription error:", err)
            });
        } catch (error) {
            // User not signed in
        }
    }

    const hubListener = (data: any) => {
      switch (data.payload.event) {
        case 'signedIn':
          loadDataAndSubscribe();
          setupSubscriptions();
          break;
        case 'signedOut':
          setEntries([]);
          setCurrentAccountTransactions([]);
          setError(null);
          break;
      }
    };

    const unsubscribeFromHub = Hub.listen('auth', hubListener);

    loadDataAndSubscribe(); // Initial load
    setupSubscriptions(); // Initial subscription setup

    return () => {
      isMounted = false;
      unsubscribeFromHub();
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [isAdmin, targetUserId, loadDataAndSubscribe]); // Correct, stable dependencies

  // ... (The rest of the component remains exactly the same)

  // --- Business Logic Calculations ---
  const salesLedgerBalance = useMemo(() => {
    return entries.reduce((acc, entry) => {
      const amount = entry.amount || 0;
      switch (entry.type) {
        case LedgerEntryType.INVOICE:
        case LedgerEntryType.INCREASE_ADJUSTMENT:
          return acc + amount;
        case LedgerEntryType.CREDIT_NOTE:
        case LedgerEntryType.DECREASE_ADJUSTMENT:
        case LedgerEntryType.CASH_RECEIPT:
          return acc - amount;
        default:
          return acc;
      }
    }, 0);
  }, [entries]);

  const currentAccountBalance = useMemo(() => {
    return currentAccountTransactions.reduce((acc, tx) => {
      const amount = tx.amount || 0;
      switch (tx.type) {
        case 'PAYMENT_REQUEST':
          return acc + amount;
        case 'CASH_RECEIPT':
          return acc - amount;
        default:
          return acc;
      }
    }, 0);
  }, [currentAccountTransactions]);
  
  const approvedSalesLedger = salesLedgerBalance;
  const grossAvailability = approvedSalesLedger * ADVANCE_RATE;
  const netAvailability = grossAvailability - currentAccountBalance;

  // --- Mutation Handler ---
  const handleAddLedgerEntry = async (newEntry: Pick<LedgerEntry, 'type' | 'amount' | 'description'>) => {
    try {
      const user = await getCurrentUser();
      const ownerId = isAdmin && targetUserId ? targetUserId : (user.username || user.attributes?.sub);
      
      if (!ownerId) throw new Error("Could not determine owner for the transaction.");

      if (isAdmin) {
        const input: AdminCreateLedgerEntryInput = {
          targetUserId: ownerId,
          amount: newEntry.amount || 0,
          type: newEntry.type,
          description: newEntry.description || ''
        };
        await client.graphql({ query: adminCreateLedgerEntry, variables: { input } });
      } else {
        const input: CreateLedgerEntryInput = {
          amount: newEntry.amount || 0,
          type: newEntry.type,
          description: newEntry.description || ''
        };
        await client.graphql({ query: createLedgerEntry, variables: { input } });
      }
    } catch (err) {
      console.error("Add entry failed:", err);
      setError("Failed to add ledger entry.");
    }
  };

  // --- Render Logic ---
  if (loading) return <Loader />;
  if (error) return <Alert variation="error" isDismissible={true} onDismiss={() => setError(null)}>{error}</Alert>;

  return (
    <View>
      <CurrentBalance balance={salesLedgerBalance} />
      <AvailabilityDisplay
        currentSalesLedgerBalance={salesLedgerBalance}
        totalUnapprovedInvoiceValue={salesLedgerBalance}
        grossAvailability={grossAvailability}
        netAvailability={netAvailability}
        currentAccountBalance={currentAccountBalance}
      />
      <LedgerEntryForm onSubmit={handleAddLedgerEntry} />
      <LedgerHistory entries={entries} isLoading={false} />
    </View>
  );
}

export default SalesLedger;