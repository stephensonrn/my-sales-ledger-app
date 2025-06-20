// src/SalesLedger.tsx
import React, { useState, useEffect, useMemo } from 'react';
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
  // Create the API client once.
  const [client] = useState(generateClient());

  // State for data, loading, and errors
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [currentAccountTransactions, setCurrentAccountTransactions] = useState<CurrentAccountTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // This is the main hook that controls all data loading and real-time updates.
  useEffect(() => {
    let subscription: any; // To hold the GraphQL subscription object for cleanup

    // This function contains the logic to fetch all necessary data from the backend.
    const loadDataAndSubscribe = async () => {
      setLoading(true);
      setError(null);
      try {
        const user = await getCurrentUser();
        const ownerId = isAdmin ? targetUserId : (user.username || user.attributes?.sub);

        if (!ownerId) {
          setLoading(false);
          return; // Can't proceed without an owner ID
        }
        
        // Fetch all ledger entries with pagination
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
        
        // Fetch all current account transactions
        const transactionsRes: any = await client.graphql({
          query: listCurrentAccountTransactions,
          variables: { filter: { owner: { eq: ownerId } } }
        });
        const transactionItems = transactionsRes?.data?.listCurrentAccountTransactions?.items?.filter(Boolean) || [];

        // Set state with the fetched data
        setEntries(allLedgerEntries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        setCurrentAccountTransactions(transactionItems);
        
        // Clean up any existing subscription before creating a new one
        if (subscription) {
            subscription.unsubscribe();
        }
        
        // Set up the real-time subscription for new ledger entries
        subscription = client.graphql({
            query: onCreateLedgerEntry,
            variables: { owner: ownerId }
        }).subscribe({
            next: ({ data }) => {
                const newTransaction = data?.onCreateLedgerEntry;
                if (newTransaction) {
                    // Just add the new entry; useMemo will handle recalculations.
                    setEntries((prev) => [newTransaction, ...prev]);
                }
            },
            error: (err) => console.error("Subscription error:", err)
        });

      } catch (err) {
        console.error("Error during data loading:", err);
        setError("Could not load sales ledger data. Please refresh the page.");
      } finally {
        setLoading(false);
      }
    };

    // The Hub listener reacts to authentication events to reliably trigger data loads.
    const hubListener = (data: any) => {
        switch (data.payload.event) {
            case 'signedIn':
                loadDataAndSubscribe();
                break;
            case 'signedOut':
                setEntries([]);
                setCurrentAccountTransactions([]);
                setError(null);
                break;
        }
    };

    // Start listening to the Hub
    const unsubscribeFromHub = Hub.listen('auth', hubListener);

    // Perform the initial data load when the component mounts
    loadDataAndSubscribe();

    // The cleanup function runs when the component unmounts
    return () => {
        unsubscribeFromHub(); // Correctly unsubscribe from the Hub
        if (subscription) {
            subscription.unsubscribe(); // Unsubscribe from GraphQL subscription
        }
    };
  }, [client, isAdmin, targetUserId]); // Effect dependencies

  // --- Business Logic Calculations using useMemo for efficiency ---

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
  
  // TODO: Update this once we know how to identify "Unapproved Invoices"
  const approvedSalesLedger = salesLedgerBalance;
  const grossAvailability = approvedSalesLedger * ADVANCE_RATE;
  const netAvailability = grossAvailability - currentAccountBalance;

  // --- Mutation Handler to Add New Entries ---

  const handleAddLedgerEntry = async (newEntry: Pick<LedgerEntry, 'type' | 'amount' | 'description'>) => {
    try {
      const user = await getCurrentUser();
      const ownerId = isAdmin && targetUserId ? targetUserId : (user.username || user.attributes?.sub);
      
      if (!ownerId) {
        throw new Error("Could not determine owner for the transaction.");
      }

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