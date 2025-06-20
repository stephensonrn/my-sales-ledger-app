// src/SalesLedger.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react'; // Added useMemo
import { generateClient } from 'aws-amplify/api';
import {
  listLedgerEntries,
  listAccountStatuses,
  listCurrentAccountTransactions
} from './graphql/operations/queries';
import {
  createLedgerEntry,
  adminCreateLedgerEntry,
} from './graphql/operations/mutations';
import { onCreateLedgerEntry } from './graphql/operations/subscriptions';
import {
  type LedgerEntry,
  type AccountStatus,
  type CurrentAccountTransaction,
  type CreateLedgerEntryInput,
  type AdminCreateLedgerEntryInput,
  LedgerEntryType // Import the enum
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
  loggedInUser: any;
}

function SalesLedger({ targetUserId, isAdmin = false, loggedInUser }: SalesLedgerProps) {
  const [client, setClient] = useState<any>(null);
  const [userIdForData, setUserIdForData] = useState<string | null>(null);

  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [currentAccountTransactions, setCurrentAccountTransactions] = useState<CurrentAccountTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- Data Fetching (No Changes Here) ---
  useEffect(() => {
    const setupClient = async () => {
      const { getCurrentUser } = await import('aws-amplify/auth');
      try {
        const user = await getCurrentUser();
        if (user) {
          setClient(generateClient());
          const sub = user?.username || user?.attributes?.sub;
          setUserIdForData(isAdmin ? targetUserId : sub);
        }
      } catch (err) {
        console.error("Failed to get current user:", err);
      }
    };
    setupClient();
  }, [isAdmin, targetUserId]);

  const fetchAllData = useCallback(async () => {
    if (!client || !userIdForData) return;
    setLoading(true);
    try {
      const [ledger, transactions] = await Promise.all([
        // This function now fetches ALL ledger entries, which is correct
        client.graphql({
          query: listLedgerEntries,
          variables: { filter: { owner: { eq: userIdForData } } }
        }),
        client.graphql({
          query: listCurrentAccountTransactions,
          variables: { filter: { owner: { eq: userIdForData } } }
        })
      ]);

      setEntries(ledger?.data?.listLedgerEntries?.items?.filter(Boolean) || []);
      setCurrentAccountTransactions(transactions?.data?.listCurrentAccountTransactions?.items?.filter(Boolean) || []);

    } catch (err) {
      console.error(err);
      setError("Failed to refresh data.");
    } finally {
      setLoading(false);
    }
  }, [client, userIdForData]);

  useEffect(() => {
    if (client && userIdForData) fetchAllData();
  }, [client, userIdForData, fetchAllData]);

  // --- Real-Time Subscriptions (Simplified) ---
  useEffect(() => {
    if (!client || !userIdForData) return;

    const sub = client.graphql({
      query: onCreateLedgerEntry,
      variables: { owner: userIdForData }
    }).subscribe({
      next: ({ data }) => {
        const newTransaction = data?.onCreateLedgerEntry;
        if (newTransaction) {
          // The subscription just needs to add the new entry.
          // The calculations will automatically re-run.
          setEntries((prev) => [newTransaction, ...prev]);
        }
      },
      error: (err) => console.error("Subscription error:", err)
    });

    return () => sub.unsubscribe();
  }, [client, userIdForData]);

  // --- NEW: Business Logic Calculations ---
  const salesLedgerBalance = useMemo(() => {
    return entries.reduce((acc, entry) => {
      const amount = entry.amount || 0;
      switch (entry.type) {
        case LedgerEntryType.INVOICE:
        case LedgerEntryType.INCREASE_ADJUSTMENT:
          return acc + amount;
        case LedgerEntryType.CREDIT_NOTE:
        case LedgerEntryType.DECREASE_ADJUSTMENT:
        case LedgerEntryType.CASH_RECEIPT: // Cash receipt reduces sales ledger
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
        case 'PAYMENT_REQUEST': // This is a drawdown, increasing what the user owes
          return acc + amount;
        case 'CASH_RECEIPT': // Cash receipt pays down the current account
          return acc - amount;
        default:
          return acc;
      }
    }, 0);
  }, [currentAccountTransactions]);

  // --- Availability Calculations (Updated) ---
  // TODO: Update this once we know how to identify "Unapproved Invoices"
  const approvedSalesLedger = salesLedgerBalance; // Placeholder
  const grossAvailability = approvedSalesLedger * ADVANCE_RATE;
  const netAvailability = grossAvailability - currentAccountBalance;


  // --- Mutation Handler (No changes here) ---
  const handleAddLedgerEntry = async (newEntry: LedgerEntry) => {
    if (!client || !userIdForData) return;
    try {
      if (isAdmin) {
        const input: AdminCreateLedgerEntryInput = {
          targetUserId: userIdForData,
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


  if (loading) return <Loader />;
  if (error) return <Alert variation="error">{error}</Alert>;

  return (
    <View>
      <CurrentBalance balance={salesLedgerBalance} />
      <AvailabilityDisplay
        currentSalesLedgerBalance={salesLedgerBalance}
        totalUnapprovedInvoiceValue={salesLedgerBalance} // Kept for prop compatibility
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