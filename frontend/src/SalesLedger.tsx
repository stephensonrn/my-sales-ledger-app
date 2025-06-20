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

type AuthStatus = 'CHECKING' | 'AUTHENTICATED' | 'GUEST';

interface SalesLedgerProps {
  targetUserId?: string | null;
  isAdmin?: boolean;
}

function SalesLedger({ targetUserId, isAdmin = false }: SalesLedgerProps) {
  const [client] = useState(generateClient());
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [currentAccountTransactions, setCurrentAccountTransactions] = useState<CurrentAccountTransaction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus>('CHECKING');
  const [ownerId, setOwnerId] = useState<string | null>(null);

  const loadData = useCallback(async (userId: string) => {
    setError(null);
    setAuthStatus('CHECKING'); // Show loader while fetching
    try {
      console.log(`[SalesLedger] Loading data for owner: ${userId}`);
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

      setEntries(allLedgerEntries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      setCurrentAccountTransactions(transactionItems);
      setAuthStatus('AUTHENTICATED'); // Data loaded successfully
    } catch (err) {
      console.error("Error loading data:", err);
      setError("Failed to load ledger data. Please refresh.");
      setAuthStatus('GUEST'); // Fallback to guest state on error
    }
  }, [client]);

  useEffect(() => {
    const checkCurrentUser = async (isInitialMount = false) => {
      try {
        // Give Amplify a moment to settle, especially after a login redirect
        if (!isInitialMount) {
            await new Promise(resolve => setTimeout(resolve, 250));
        }
        const user = await getCurrentUser();
        const currentOwnerId = isAdmin ? targetUserId : (user.username || user.attributes?.sub);
        if (currentOwnerId) {
          setOwnerId(currentOwnerId);
        } else {
          setAuthStatus('GUEST');
        }
      } catch (err) {
        setAuthStatus('GUEST');
      }
    };

    const hubListener = (hubData: any) => {
      const { event } = hubData.payload;
      if (event === 'signedIn' || event === 'autoSignIn') {
        checkCurrentUser();
      } else if (event === 'signedOut') {
        setAuthStatus('GUEST');
        setOwnerId(null);
        setEntries([]);
        setCurrentAccountTransactions([]);
      }
    };

    const unsubscribeHub = Hub.listen('auth', hubListener);
    checkCurrentUser(true); // Initial check on mount

    return () => unsubscribeHub();
  }, [isAdmin, targetUserId]);

  useEffect(() => {
    if (ownerId) {
      loadData(ownerId);
    }
  }, [ownerId, loadData]);

  useEffect(() => {
    let subscription: any;
    if (ownerId) {
      subscription = client.graphql({
        query: onCreateLedgerEntry,
        variables: { owner: ownerId }
      }).subscribe({
        next: ({ data }) => {
          if (data?.onCreateLedgerEntry) {
            setEntries((prev) => {
              const newEntries = [data.onCreateLedgerEntry, ...prev.filter(e => e.id !== data.onCreateLedgerEntry.id)];
              return newEntries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            });
          }
        }
      });
    }
    return () => {
      if (subscription) subscription.unsubscribe();
    };
  }, [ownerId, client]);

  // --- Calculations ---
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
    if (!ownerId) {
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
  if (authStatus === 'CHECKING') {
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
