// src/SalesLedger.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
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

  useEffect(() => {
    let subscription: any;

    const loadDataAndSubscribe = async () => {
      setLoading(true);
      setError(null);
      try {
        console.log("Attempting to load data...");
        const user = await getCurrentUser();
        const ownerId = isAdmin ? targetUserId : (user.username || user.attributes?.sub);

        if (!ownerId) {
          console.log("No ownerId found, stopping.");
          setLoading(false);
          return;
        }

        console.log(`Fetching data for owner: ${ownerId}`);
        
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

        console.log(`Fetched ${allLedgerEntries.length} ledger entries.`);
        setEntries(allLedgerEntries);
        setCurrentAccountTransactions(transactionItems);
        
        // Cleanup existing subscription before creating a new one
        if (subscription) {
            subscription.unsubscribe();
        }
        
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
        console.error("Error during data loading:", err);
        setError("Could not load user data. Please try refreshing.");
      } finally {
        setLoading(false);
      }
    };

    // This listener reacts to authentication events
    const hubListener = (data: any) => {
        switch (data.payload.event) {
            case 'signedIn':
                console.log('Hub event: signedIn');
                loadDataAndSubscribe();
                break;
            case 'signedOut':
                console.log('Hub event: signedOut');
                setEntries([]);
                setCurrentAccountTransactions([]);
                setError(null);
                break;
        }
    };

    Hub.listen('auth', hubListener);

    // Initial load when the component mounts
    loadDataAndSubscribe();

    // Cleanup function
    return () => {
        Hub.remove('auth', hubListener);
        if (subscription) {
            subscription.unsubscribe();
        }
    };
  }, [client, isAdmin, targetUserId]); // Effect dependencies

  // ... All the calculation and mutation handler code remains the same ...
  // --- Calculations ---
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
  const handleAddLedgerEntry = async (newEntry: LedgerEntry) => {
    try {
      const user = await getCurrentUser();
      const ownerId = isAdmin ? targetUserId : (user.username || user.attributes?.sub);
      if(!ownerId) throw new Error("Could not determine owner for transaction.");

      const input: CreateLedgerEntryInput = {
        amount: newEntry.amount, type: newEntry.type, description: newEntry.description
      };
      await client.graphql({ query: createLedgerEntry, variables: { input } });
      
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