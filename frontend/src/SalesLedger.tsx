// src/SalesLedger.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { generateClient } from 'aws-amplify/api';
import {
  listLedgerEntries,
  listAccountStatuses,
  listCurrentAccountTransactions
} from './graphql/operations/queries';
import {
  createLedgerEntry,
  adminCreateLedgerEntry,
  sendPaymentRequestEmail
} from './graphql/operations/mutations';
import { onCreateLedgerEntry } from './graphql/operations/subscriptions';
import {
  type LedgerEntry,
  type AccountStatus,
  type CurrentAccountTransaction,
  type CreateLedgerEntryInput,
  type AdminCreateLedgerEntryInput,
  type SendPaymentRequestInput
} from './graphql/API';
import CurrentBalance from './CurrentBalance';
import LedgerEntryForm from './LedgerEntryForm';
import LedgerHistory from './LedgerHistory';
import AvailabilityDisplay from './AvailabilityDisplay';
import PaymentRequestForm from './PaymentRequestForm';
import ManageAccountStatus from './ManageAccountStatus';
import { Loader, Text, Alert, View, Card, Heading } from '@aws-amplify/ui-react';

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
  const [accountStatus, setAccountStatus] = useState<AccountStatus | null>(null);
  const [currentAccountTransactions, setCurrentAccountTransactions] = useState<CurrentAccountTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const fetchAllLedgerEntries = useCallback(async (ownerId: string): Promise<LedgerEntry[]> => {
    if (!client) return [];
    let all: LedgerEntry[] = [];
    let nextToken: string | undefined = undefined;

    do {
      const res = await client.graphql({
        query: listLedgerEntries,
        variables: {
          filter: { owner: { eq: ownerId } },
          nextToken,
          limit: 50,
        },
        authMode: 'userPool'
      });
      const items = res?.data?.listLedgerEntries?.items?.filter(Boolean) || [];
      all.push(...items);
      nextToken = res?.data?.listLedgerEntries?.nextToken;
    } while (nextToken);
    return all;
  }, [client]);

  const refreshAllData = useCallback(async () => {
    if (!client || !userIdForData) return;
    setLoading(true);
    try {
      const [ledger, status, transactions] = await Promise.all([
        fetchAllLedgerEntries(userIdForData),
        client.graphql({
          query: listAccountStatuses,
          variables: { filter: { owner: { eq: userIdForData } }, limit: 1 },
          authMode: 'userPool'
        }),
        client.graphql({
          query: listCurrentAccountTransactions,
          variables: { filter: { owner: { eq: userIdForData } } },
          authMode: 'userPool'
        })
      ]);

      setEntries(ledger);
      setAccountStatus(status?.data?.listAccountStatuses?.items?.[0] || null);
      setCurrentAccountTransactions(transactions?.data?.listCurrentAccountTransactions?.items || []);
    } catch (err) {
      console.error(err);
      setError("Failed to refresh data.");
    } finally {
      setLoading(false);
    }
  }, [client, userIdForData, fetchAllLedgerEntries]);

  useEffect(() => {
    if (client && userIdForData) refreshAllData();
  }, [client, userIdForData, refreshAllData]);

  useEffect(() => {
    if (!client || !userIdForData) return;

    const sub = client.graphql({
      query: onCreateLedgerEntry,
      variables: { owner: userIdForData },
      authMode: 'userPool'
    }).subscribe({
      next: ({ data }) => {
        const newTransaction = data?.onCreateLedgerEntry;

        if (newTransaction) {
          // 1. Update the transaction list (This part is already working)
          setEntries((prev) => [newTransaction, ...prev]);

          // 2. NEW: Update the account status and balance
          setAccountStatus((prevStatus) => {
            // If there's no previous status, we can't update it.
            if (!prevStatus) return null;

            let newBalance = prevStatus.totalUnapprovedInvoiceValue;
            const amount = newTransaction.amount || 0;

            // This logic determines how the balance changes.
            // Please verify this matches your business rules.
            switch (newTransaction.type) {
              case 'INVOICE':
              case 'INCREASE_ADJUSTMENT':
                newBalance += amount;
                break;
              
              case 'CREDIT_NOTE':
              case 'DECREASE_ADJUSTMENT':
              case 'CASH_RECEIPT': // Assuming cash receipt reduces the outstanding balance
                newBalance -= amount;
                break;

              default:
                // Do nothing for transaction types that don't affect the balance
                break;
            }

            // Return a new accountStatus object with the updated balance
            return {
              ...prevStatus,
              totalUnapprovedInvoiceValue: newBalance,
            };
          });
        }
      },
      error: (err) => console.error("Subscription error:", err)
    });

    return () => sub.unsubscribe();
  }, [client, userIdForData]);

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
        await client.graphql({
          query: adminCreateLedgerEntry,
          variables: { input },
          authMode: 'userPool'
        });
      } else {
        const input: CreateLedgerEntryInput = {
          amount: newEntry.amount || 0,
          type: newEntry.type,
          description: newEntry.description || ''
        };
        await client.graphql({
          query: createLedgerEntry,
          variables: { input },
          authMode: 'userPool'
        });
      }
    } catch (err) {
      console.error("Add entry failed:", err);
      setError("Failed to add ledger entry.");
    }
  };

  if (loading) return <Loader />;
  if (error) return <Alert variation="error">{error}</Alert>;

  const balance = accountStatus?.totalUnapprovedInvoiceValue || 0;
  const currentAccount = accountStatus?.currentAccountBalance || 0;
  const gross = balance * ADVANCE_RATE;
  const net = gross - currentAccount;

  return (
    <View>
      <CurrentBalance balance={balance} />
      <AvailabilityDisplay
        currentSalesLedgerBalance={balance}
        totalUnapprovedInvoiceValue={balance}
        grossAvailability={gross}
        netAvailability={net}
        currentAccountBalance={currentAccount}
      />
      <LedgerEntryForm onSubmit={handleAddLedgerEntry} />
      <LedgerHistory entries={entries} isLoading={false} />
    </View>
  );
}

export default SalesLedger;
