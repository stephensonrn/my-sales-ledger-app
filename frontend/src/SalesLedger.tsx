// ==========================================================
// FILE: src/SalesLedger.tsx
// ==========================================================

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { generateClient } from 'aws-amplify/api';
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
import { Loader, Alert, View, Text } from '@aws-amplify/ui-react';

const ADVANCE_RATE = 0.9;

interface SalesLedgerProps {
  // This component now receives the full user object.
  loggedInUser: any; 
  isAdmin?: boolean; // isAdmin is now managed by the parent
}

function SalesLedger({ loggedInUser, isAdmin = false }: SalesLedgerProps) {
  const [client] = useState(generateClient());
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [currentAccountTransactions, setCurrentAccountTransactions] = useState<CurrentAccountTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // This is the main effect that loads data and sets up subscriptions.
  // It relies on the loggedInUser prop, which is guaranteed to be present.
  useEffect(() => {
    // If there's no user object, do nothing.
    if (!loggedInUser) {
        setLoading(false);
        return;
    }

    const ownerId = loggedInUser.username || loggedInUser.attributes?.sub;
    if (!ownerId) {
        setLoading(false);
        return;
    }

    let isMounted = true;
    let subscription: any;

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            // Fetch all data...
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

            if (isMounted) {
                setEntries(allLedgerEntries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
                setCurrentAccountTransactions(transactionItems);
            }
        } catch (err) {
            console.error("Error loading data:", err);
            if (isMounted) setError("Failed to load ledger data.");
        } finally {
            if (isMounted) setLoading(false);
        }
    };

    const setupSubscription = () => {
        subscription = client.graphql({
            query: onCreateLedgerEntry,
            variables: { owner: ownerId }
        }).subscribe({
            next: ({ data }) => {
                if (isMounted && data?.onCreateLedgerEntry) {
                    setEntries((prev) => [data.onCreateLedgerEntry, ...prev.filter(e => e.id !== data.onCreateLedgerEntry.id)]);
                }
            }
        });
    };

    loadData();
    setupSubscription();

    return () => {
        isMounted = false;
        if (subscription) subscription.unsubscribe();
    };
  }, [loggedInUser, client]); // The effect now depends on the stable loggedInUser prop.


  // --- Business Logic Calculations ---
  const salesLedgerBalance = useMemo(() => {
    return entries.reduce((acc, entry) => {
      const amount = entry.amount || 0;
      switch (entry.type) {
        case LedgerEntryType.INVOICE: case LedgerEntryType.INCREASE_ADJUSTMENT:
          return acc + amount;
        case LedgerEntryType.CREDIT_NOTE: case LedgerEntryType.DECREASE_ADJUSTMENT: case LedgerEntryType.CASH_RECEIPT:
          return acc - amount;
        default: return acc;
      }
    }, 0);
  }, [entries]);

  const currentAccountBalance = useMemo(() => {
    return currentAccountTransactions.reduce((acc, tx) => {
      const amount = tx.amount || 0;
      switch (tx.type) {
        case 'PAYMENT_REQUEST': return acc + amount;
        case 'CASH_RECEIPT': return acc - amount;
        default: return acc;
      }
    }, 0);
  }, [currentAccountTransactions]);
  
  const approvedSalesLedger = salesLedgerBalance;
  const grossAvailability = approvedSalesLedger * ADVANCE_RATE;
  const netAvailability = grossAvailability - currentAccountBalance;

  // --- Mutation Handler ---
  const handleAddLedgerEntry = async (newEntry: Pick<LedgerEntry, 'type' | 'amount' | 'description'>) => {
    if (!loggedInUser) {
        setError("Cannot add entry: User is not authenticated.");
        return;
    }
    try {
        const input: CreateLedgerEntryInput = {
          amount: newEntry.amount || 0,
          type: newEntry.type,
          description: newEntry.description || ''
        };
        await client.graphql({ query: createLedgerEntry, variables: { input } });
    } catch (err) {
      console.error("Add entry failed:", err);
      setError("Failed to add ledger entry.");
    }
  };

  // --- Render Logic ---
  if (loading) return <Loader size="large" />;
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
      <LedgerHistory entries={entries} isLoading={loading} />
    </View>
  );
}

export default SalesLedger;