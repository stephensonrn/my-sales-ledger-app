// src/SalesLedger.tsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
import { Loader, Alert, View, Text } from '@aws-amplify/ui-react';

const ADVANCE_RATE = 0.9;

type AuthStatus = 'CHECKING_AUTH' | 'AUTHENTICATED' | 'GUEST';

interface SalesLedgerProps {
  targetUserId?: string | null;
  isAdmin?: boolean;
}

function SalesLedger({ targetUserId, isAdmin = false }: SalesLedgerProps) {
  const [client] = useState(generateClient());
  
  // Data and UI State
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [currentAccountTransactions, setCurrentAccountTransactions] = useState<CurrentAccountTransaction[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  // Authentication and Loading State Machine
  const [authStatus, setAuthStatus] = useState<AuthStatus>('CHECKING_AUTH');
  const [ownerId, setOwnerId] = useState<string | null>(null);

  // --- Main Effect Hook for Auth and Data Loading ---
  useEffect(() => {
    let isMounted = true;
    let subscription: any;

    const loadData = async (userId: string) => {
      if (!isMounted) return;
      console.log(`[SalesLedger] Auth confirmed. Loading data for owner: ${userId}`);
      setAuthStatus('AUTHENTICATED'); // Move to authenticated state
      setError(null);

      try {
        // Fetch all data with pagination
        let allLedgerEntries: LedgerEntry[] = [];
        let nextToken: string | null | undefined = null;
        do {
          const ledgerRes: any = await client.graphql({
            query: listLedgerEntries,
            variables: { filter: { owner: { eq: userId } }, limit: 100, nextToken }
          });
          const ledgerItems = ledgerRes?.data?.listLedgerEntries?.items?.filter(Boolean) || [];
          allLedgerEntries.push(...ledgerItems);
          nextToken = ledgerRes?.data?.listLedgerEntries?.nextToken;
        } while (nextToken);

        const transactionsRes: any = await client.graphql({
          query: listCurrentAccountTransactions,
          variables: { filter: { owner: { eq: userId } } }
        });
        const transactionItems = transactionsRes?.data?.listCurrentAccountTransactions?.items?.filter(Boolean) || [];
        
        if (isMounted) {
            setEntries(allLedgerEntries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
            setCurrentAccountTransactions(transactionItems);
        }

        // Setup GraphQL subscription AFTER data is loaded
        if (subscription) subscription.unsubscribe();
        subscription = client.graphql({
            query: onCreateLedgerEntry,
            variables: { owner: userId }
        }).subscribe({
            next: ({ data }) => {
                if (isMounted && data?.onCreateLedgerEntry) {
                    setEntries((prev) => [data.onCreateLedgerEntry, ...prev.filter(e => e.id !== data.onCreateLedgerEntry.id)]);
                }
            }
        });

      } catch (err) {
        if (isMounted) setError("Failed to load ledger data.");
        console.error("Error in loadData:", err);
      }
    };

    const checkCurrentUser = async () => {
        if (!isMounted) return;
        try {
            const user = await getCurrentUser();
            const currentOwnerId = isAdmin ? targetUserId : (user.username || user.attributes?.sub);
            if (currentOwnerId) {
                setOwnerId(currentOwnerId);
                await loadData(currentOwnerId);
            } else {
                setAuthStatus('GUEST');
            }
        } catch (err) {
            if (isMounted) setAuthStatus('GUEST');
        }
    };

    const hubListener = (hubData: any) => {
      const { event } = hubData.payload;
      if (event === 'signedIn') {
        console.log('[SalesLedger] Hub event: signedIn. Reloading data.');
        checkCurrentUser();
      } else if (event === 'signedOut') {
        console.log('[SalesLedger] Hub event: signedOut. Clearing data.');
        if (isMounted) {
            setAuthStatus('GUEST');
            setEntries([]);
            setCurrentAccountTransactions([]);
            setOwnerId(null);
        }
      }
    };

    const unsubscribeHub = Hub.listen('auth', hubListener);
    checkCurrentUser(); // Initial check on component mount

    // Cleanup function
    return () => {
      isMounted = false;
      unsubscribeHub();
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [isAdmin, targetUserId, client]);


  // --- Business Logic Calculations (Memoized for performance) ---
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

  // --- Mutation Handler to Add New Entries ---
  const handleAddLedgerEntry = async (newEntry: Pick<LedgerEntry, 'type' | 'amount' | 'description'>) => {
    if (!ownerId) {
        setError("Cannot add entry: User is not authenticated.");
        return;
    }
    try {
      if (isAdmin) {
        // Admin logic
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
  if (authStatus === 'CHECKING_AUTH') {
    return <Loader size="large" />;
  }
  
  if (error) {
    return <Alert variation="error" isDismissible={true} onDismiss={() => setError(null)}>{error}</Alert>;
  }
  
  if (authStatus !== 'AUTHENTICATED') {
    return <Text>Please sign in to view your sales ledger.</Text>;
  }

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
      <LedgerHistory entries={entries} isLoading={authStatus !== 'AUTHENTICATED'} />
    </View>
  );
}

export default SalesLedger;
