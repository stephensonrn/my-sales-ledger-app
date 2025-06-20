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
  sendPaymentRequestEmail // Import the mutation for drawdowns
} from './graphql/operations/mutations';
import { onCreateLedgerEntry } from './graphql/operations/subscriptions';
import {
  type LedgerEntry,
  type CurrentAccountTransaction,
  type CreateLedgerEntryInput,
  type SendPaymentRequestInput, // Import the input type
  LedgerEntryType
} from './graphql/API';
import CurrentBalance from './CurrentBalance';
import LedgerEntryForm from './LedgerEntryForm';
import LedgerHistory from './LedgerHistory';
import AvailabilityDisplay from './AvailabilityDisplay';
import PaymentRequestForm from './PaymentRequestForm'; // Import the form component
import { Loader, Alert, View, Text } from '@aws-amplify/ui-react';

const ADVANCE_RATE = 0.9;
// Define a central email for drawdown requests
const ADMIN_EMAIL = "ross@aurumif.com"; // <-- IMPORTANT: Change this to your admin's email

type AuthStatus = 'CHECKING' | 'AUTHENTICATED' | 'GUEST';

interface SalesLedgerProps {
  targetUserId?: string | null;
  isAdmin?: boolean;
}

function SalesLedger({ targetUserId, isAdmin = false }: SalesLedgerProps) {
  const [client] = useState(generateClient());
  
  // Data State
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [currentAccountTransactions, setCurrentAccountTransactions] = useState<CurrentAccountTransaction[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  // State for the Payment Request Form
  const [drawdownLoading, setDrawdownLoading] = useState(false);
  const [drawdownError, setDrawdownError] = useState<string | null>(null);
  const [drawdownSuccess, setDrawdownSuccess] = useState<string | null>(null);
  
  // Auth State
  const [authStatus, setAuthStatus] = useState<AuthStatus>('CHECKING');
  const [ownerId, setOwnerId] = useState<string | null>(null);

  // --- Effect 1: Manages Authentication State ---
  useEffect(() => {
    const checkCurrentUser = async () => {
      try {
        const user = await getCurrentUser();
        const currentOwnerId = isAdmin ? targetUserId : (user.username || user.attributes?.sub);
        if (currentOwnerId) {
            setOwnerId(currentOwnerId);
            setAuthStatus('AUTHENTICATED');
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
    checkCurrentUser();

    return () => unsubscribeHub();
  }, [isAdmin, targetUserId]);

  // --- Effect 2: Reacts to Authentication State to Load Data ---
  useEffect(() => {
    let subscription: any;
    
    const loadData = async () => {
        if (authStatus !== 'AUTHENTICATED' || !ownerId) return;
        
        setError(null);
        try {
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

            subscription = client.graphql({
                query: onCreateLedgerEntry,
                variables: { owner: ownerId }
            }).subscribe({
                next: ({ data }) => {
                    if (data?.onCreateLedgerEntry) {
                        setEntries((prev) => [data.onCreateLedgerEntry, ...prev.filter(e => e.id !== data.onCreateLedgerEntry.id)]);
                    }
                }
            });

        } catch (err) {
            setError("Failed to load ledger data.");
            console.error("Error in loadData effect:", err);
        }
    };

    loadData();

    return () => {
        if (subscription) subscription.unsubscribe();
    };
  }, [authStatus, ownerId, client]);

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

  // --- Mutation Handlers ---
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

  // --- NEW: Handler for the Payment Request Form ---
  const handleRequestDrawdown = async (amount: number) => {
    setDrawdownLoading(true);
    setDrawdownError(null);
    setDrawdownSuccess(null);
    try {
        const input: SendPaymentRequestInput = {
            amount,
            toEmail: ADMIN_EMAIL,
            subject: `Payment Request from User: ${ownerId}`,
            body: `User ${ownerId} has requested a drawdown payment of £${amount.toFixed(2)}.`,
        };
        await client.graphql({ query: sendPaymentRequestEmail, variables: { input } });
        setDrawdownSuccess(`Your request for £${amount.toFixed(2)} has been sent successfully.`);
    } catch (err) {
        console.error("Payment request failed:", err);
        setDrawdownError("Failed to send payment request. Please try again.");
    } finally {
        setDrawdownLoading(false);
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
      
      {/* --- REINSTATED PAYMENT REQUEST FORM --- */}
      <PaymentRequestForm
        netAvailability={netAvailability}
        onSubmitRequest={handleRequestDrawdown}
        isLoading={drawdownLoading}
        requestError={drawdownError}
        requestSuccess={drawdownSuccess}
        disabled={isAdmin} // Disable for admins if they can't request for themselves
      />
      
      <LedgerEntryForm onSubmit={handleAddLedgerEntry} />
      <LedgerHistory entries={entries} isLoading={false} />
    </View>
  );
}

export default SalesLedger;
