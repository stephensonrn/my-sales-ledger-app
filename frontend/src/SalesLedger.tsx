// src/SalesLedger.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { generateClient } from 'aws-amplify/api';
import { getCurrentUser } from 'aws-amplify/auth';
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
  // We only need one client instance.
  const [client] = useState(generateClient());

  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [currentAccountTransactions, setCurrentAccountTransactions] = useState<CurrentAccountTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // This single, robust useEffect handles initialization, data fetching, and subscriptions.
  useEffect(() => {
    let subscription: any; // To hold the subscription object for cleanup

    const initialize = async () => {
      setLoading(true);
      try {
        // 1. Get the current user to determine whose data to fetch
        const user = await getCurrentUser();
        const ownerId = isAdmin ? targetUserId : (user.username || user.attributes?.sub);

        if (!ownerId) {
          // If we can't determine an owner, stop.
          setLoading(false);
          return;
        }

        // 2. Fetch all data, with pagination for ledger entries
        let allLedgerEntries: LedgerEntry[] = [];
        let nextToken: string | null | undefined = null;
        do {
          const ledgerRes: any = await client.graphql({
            query: listLedgerEntries,
            variables: { filter: { owner: { eq: ownerId } }, limit: 100, nextToken }
          });
          const items = ledgerRes?.data?.listLedgerEntries?.items?.filter(Boolean) || [];
          allLedgerEntries.push(...items);
          nextToken = ledgerRes?.data?.listLedgerEntries?.nextToken;
        } while (nextToken);
        
        const transactionsRes: any = await client.graphql({
          query: listCurrentAccountTransactions,
          variables: { filter: { owner: { eq: ownerId } } }
        });
        const transactionItems = transactionsRes?.data?.listCurrentAccountTransactions?.items?.filter(Boolean) || [];

        // 3. Set all state at once
        setEntries(allLedgerEntries);
        setCurrentAccountTransactions(transactionItems);
        
        // 4. Now that initial data is loaded, set up the real-time subscription
        subscription = client.graphql({
            query: onCreateLedgerEntry,
            variables: { owner: ownerId }
        }).subscribe({
            next: ({ data }) => {
                const newTransaction = data?.onCreateLedgerEntry;
                if (newTransaction) {
                    setEntries((prev) => [newTransaction, ...prev]);
                }
            },
            error: (err) => console.error("Subscription error:", err)
        });

      } catch (err) {
        console.error("Error during initialization:", err);
        setError("Failed to load sales ledger data.");
      } finally {
        setLoading(false);
      }
    };

    initialize();

    // 5. Cleanup function: runs when the component unmounts
    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [client, isAdmin, targetUserId]); // This effect will re-run if the user context changes

  // --- Calculations (These are now correct from our last step) ---
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
  
  const approvedSalesLedger = salesLedgerBalance; // Placeholder
  const grossAvailability = approvedSalesLedger * ADVANCE_RATE;
  const netAvailability = grossAvailability - currentAccountBalance;

  // --- Mutation Handler (No changes needed here) ---
  const handleAddLedgerEntry = async (newEntry: LedgerEntry) => {
    // This function now correctly assumes a user context is established.
    try {
      const user = await getCurrentUser();
      const ownerId = isAdmin ? targetUserId : (user.username || user.attributes?.sub);
      if(!ownerId) throw new Error("Could not determine owner for transaction.");

      if (isAdmin) {
        // ... Admin logic
      } else {
        const input: CreateLedgerEntryInput = {
          amount: newEntry.amount, type: newEntry.type, description: newEntry.description
        };
        await client.graphql({ query: createLedgerEntry, variables: { input } });
      }
    } catch (err) {
      console.error("Add entry failed:", err);
      setError("Failed to add ledger entry.");
    }
  };

  if (loading) return <Loader />;
  if (error) return <Alert variation="error">{error}</Alert>;

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