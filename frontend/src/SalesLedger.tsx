// ==========================================================
// FILE: src/SalesLedger.tsx
// ==========================================================
// This file is corrected to fetch the AccountStatus and use it in calculations.

import React, { useState, useEffect, useMemo } from 'react';
import { generateClient } from 'aws-amplify/api';
import { getCurrentUser } from 'aws-amplify/auth';
import { Hub } from 'aws-amplify/utils';
import {
  listLedgerEntries,
  listCurrentAccountTransactions,
  listAccountStatuses // Import the query
} from './graphql/operations/queries';
import {
  createLedgerEntry,
} from './graphql/operations/mutations';
import { onCreateLedgerEntry } from './graphql/operations/subscriptions';
import {
  type LedgerEntry,
  type CurrentAccountTransaction,
  type AccountStatus, // Import the type
  type CreateLedgerEntryInput,
  LedgerEntryType
} from './graphql/API';
import CurrentBalance from './CurrentBalance';
import LedgerEntryForm from './LedgerEntryForm';
import LedgerHistory from './LedgerHistory';
import AvailabilityDisplay from './AvailabilityDisplay';
import PaymentRequestForm from './PaymentRequestForm';
import { Loader, Alert, View, Text } from '@aws-amplify/ui-react';

const ADVANCE_RATE = 0.9;

type AuthStatus = 'CHECKING' | 'AUTHENTICATED' | 'GUEST';

interface SalesLedgerProps {
  loggedInUser: any;
  isAdmin?: boolean;
}

function SalesLedger({ loggedInUser, isAdmin = false }: SalesLedgerProps) {
  const [client] = useState(generateClient());
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [currentAccountTransactions, setCurrentAccountTransactions] = useState<CurrentAccountTransaction[]>([]);
  const [accountStatus, setAccountStatus] = useState<AccountStatus | null>(null); // State for the status record
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
            // Fetch all three data types in parallel
            const [ledgerRes, transactionsRes, statusRes] = await Promise.all([
                client.graphql({ query: listLedgerEntries, variables: { filter: { owner: { eq: ownerId } } } }),
                client.graphql({ query: listCurrentAccountTransactions, variables: { filter: { owner: { eq: ownerId } } } }),
                client.graphql({ query: listAccountStatuses, variables: { filter: { owner: { eq: ownerId } }, limit: 1 } })
            ]);

            if (isMounted) {
                const ledgerItems = (ledgerRes.data?.listLedgerEntries?.items || []).filter(Boolean) as LedgerEntry[];
                const transactionItems = (transactionsRes.data?.listCurrentAccountTransactions?.items || []).filter(Boolean) as CurrentAccountTransaction[];
                const statusItem = (statusRes.data?.listAccountStatuses?.items || []).filter(Boolean)[0] as AccountStatus | null;
                
                setEntries(ledgerItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
                setCurrentAccountTransactions(transactionItems);
                setAccountStatus(statusItem);
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
  }, [loggedInUser, client]);

  // --- CORRECTED Business Logic Calculations ---
  
  // 1. This is the real-time total calculated from all transactions.
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

  // 2. This is the manual value set by the admin.
  const unapprovedInvoiceTotal = accountStatus?.totalUnapprovedInvoiceValue || 0;
  
  // 3. The "approved" balance is the difference.
  const approvedSalesLedger = salesLedgerBalance - unapprovedInvoiceTotal;
  
  // 4. Current account balance calculation remains the same.
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
  
  // 5. Availability calculations now use the correct "approved" balance.
  const grossAvailability = approvedSalesLedger * ADVANCE_RATE;
  const netAvailability = grossAvailability - currentAccountBalance;

  // --- Mutation Handler (No changes) ---
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

  if (loading) return <Loader size="large" />;
  if (error) return <Alert variation="error">{error}</Alert>;

  return (
    <View>
      {/* This component now shows the correct, real-time total balance */}
      <CurrentBalance balance={salesLedgerBalance} />
      
      {/* This component now uses the corrected availability numbers */}
      <AvailabilityDisplay
        currentSalesLedgerBalance={salesLedgerBalance}
        totalUnapprovedInvoiceValue={unapprovedInvoiceTotal} // Pass the manual value
        grossAvailability={grossAvailability}
        netAvailability={netAvailability}
        currentAccountBalance={currentAccountBalance}
      />
      
      {/* The rest of the forms remain the same */}
      <PaymentRequestForm
        netAvailability={netAvailability}
        onSubmitRequest={async () => {}} // Placeholder for drawdown logic
        isLoading={false}
        requestError={null}
        requestSuccess={null}
        disabled={isAdmin}
      />
      
      <LedgerEntryForm onSubmit={handleAddLedgerEntry} />
      <LedgerHistory entries={entries} isLoading={loading} />
    </View>
  );
}

export default SalesLedger;