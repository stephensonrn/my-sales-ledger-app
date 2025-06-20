// FILE: src/SalesLedger.tsx (Corrected to use SUB for subscriptions)
// ==========================================================

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { generateClient } from 'aws-amplify/api';
import { getCurrentUser } from 'aws-amplify/auth';
import { Hub } from 'aws-amplify/utils';
import {
  listLedgerEntries,
  listCurrentAccountTransactions,
  listAccountStatuses
} from './graphql/operations/queries';
import {
  createLedgerEntry,
  sendPaymentRequestEmail
} from './graphql/operations/mutations';
import { onCreateLedgerEntry } from './graphql/operations/subscriptions';
import {
  type LedgerEntry,
  type CurrentAccountTransaction,
  type AccountStatus,
  type CreateLedgerEntryInput,
  type SendPaymentRequestInput,
  LedgerEntryType,
  CurrentAccountTransactionType
} from './graphql/API';
import CurrentBalance from './CurrentBalance';
import LedgerEntryForm from './LedgerEntryForm';
import LedgerHistory from './LedgerHistory';
import AvailabilityDisplay from './AvailabilityDisplay';
import PaymentRequestForm from './PaymentRequestForm';
import { Loader, Alert, View, Text, Heading, Tabs } from '@aws-amplify/ui-react';

const ADVANCE_RATE = 0.9;
const ADMIN_EMAIL = "ross@aurumif.com";

type AuthStatus = 'CHECKING' | 'AUTHENTICATED' | 'GUEST';

interface SalesLedgerProps {
  loggedInUser: any;
  isAdmin?: boolean;
  targetUserId?: string | null;
}

function SalesLedger({ loggedInUser, isAdmin = false, targetUserId = null }: SalesLedgerProps) {
  const [client] = useState(generateClient());
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [currentAccountTransactions, setCurrentAccountTransactions] = useState<CurrentAccountTransaction[]>([]);
  const [accountStatus, setAccountStatus] = useState<AccountStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drawdownLoading, setDrawdownLoading] = useState(false);
  const [drawdownError, setDrawdownError] = useState<string | null>(null);
  const [drawdownSuccess, setDrawdownSuccess] = useState<string | null>(null);

  useEffect(() => {
    // --- THIS IS THE FIX: Determine the owner's SUB ID ---
    const ownerSub = isAdmin ? targetUserId : (loggedInUser?.attributes?.sub || loggedInUser?.userId);

    if (!ownerSub) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    let subscription: any;

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            const [ledgerRes, transactionsRes, statusRes] = await Promise.all([
                client.graphql({ query: listLedgerEntries, variables: { filter: { owner: { eq: ownerSub } } } }),
                client.graphql({ query: listCurrentAccountTransactions, variables: { filter: { owner: { eq: ownerSub } } } }),
                client.graphql({ query: listAccountStatuses, variables: { filter: { owner: { eq: ownerSub } }, limit: 1 } })
            ]);

            if (isMounted) {
                const ledgerItems = (ledgerRes.data?.listLedgerEntries?.items || []).filter(Boolean) as LedgerEntry[];
                const transactionItems = (transactionsRes.data?.listCurrentAccountTransactions?.items || []).filter(Boolean) as CurrentAccountTransaction[];
                const statusItem = (statusRes.data?.listAccountStatuses?.items || []).filter(Boolean)[0] as AccountStatus | null;
                
                setEntries(ledgerItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
                setCurrentAccountTransactions(transactionItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
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
        if (subscription) subscription.unsubscribe();
        // --- THIS IS THE FIX: Subscribe using the SUB ID ---
        subscription = client.graphql({
            query: onCreateLedgerEntry,
            variables: { owner: ownerSub }
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
  }, [loggedInUser, isAdmin, targetUserId, client]);


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

  const unapprovedInvoiceTotal = accountStatus?.totalUnapprovedInvoiceValue || 0;
  const approvedSalesLedger = salesLedgerBalance - unapprovedInvoiceTotal;
  
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
  
  const grossAvailability = approvedSalesLedger * ADVANCE_RATE;
  const netAvailability = grossAvailability - currentAccountBalance;

  // --- Mutation Handlers ---
  const handleAddLedgerEntry = async (newEntry: Pick<LedgerEntry, 'type' | 'amount' | 'description'>) => {
    if (!loggedInUser) return;
    try {
        const input: CreateLedgerEntryInput = {
          amount: newEntry.amount || 0,
          type: newEntry.type,
          description: newEntry.description || ''
        };
        await client.graphql({ query: createLedgerEntry, variables: { input } });
    } catch (err) {
      setError("Failed to add ledger entry.");
      console.error(err);
    }
  };

  const handleRequestDrawdown = async (amount: number) => {
    if (!loggedInUser) return;
    setDrawdownLoading(true);
    setDrawdownError(null);
    setDrawdownSuccess(null);
    try {
        const ownerId = loggedInUser.username || loggedInUser.attributes?.sub;
        const input: SendPaymentRequestInput = {
            amount,
            toEmail: ADMIN_EMAIL,
            subject: `Payment Request from User: ${ownerId}`,
            body: `User ${ownerId} has requested a drawdown payment of £${amount.toFixed(2)}.`,
        };
        await client.graphql({ query: sendPaymentRequestEmail, variables: { input } });
        setDrawdownSuccess(`Your request for £${amount.toFixed(2)} has been sent successfully.`);

        const newOptimisticTransaction: CurrentAccountTransaction = {
            __typename: "CurrentAccountTransaction",
            id: `local-${crypto.randomUUID()}`,
            owner: ownerId,
            type: CurrentAccountTransactionType.PAYMENT_REQUEST,
            amount: amount,
            description: "Payment Request (pending admin approval)",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        
        setCurrentAccountTransactions(prev => [newOptimisticTransaction, ...prev]);

    } catch (err) {
        setDrawdownError("Failed to send payment request. Please try again.");
        console.error("Payment request failed:", err);
    } finally {
        setDrawdownLoading(false);
    }
  };

  // --- Render Logic ---
  if (loading) return <Loader size="large" />;
  if (error) return <Alert variation="error">{error}</Alert>;

  return (
    <View>
      <CurrentBalance balance={salesLedgerBalance} />
      <AvailabilityDisplay
        currentSalesLedgerBalance={salesLedgerBalance}
        totalUnapprovedInvoiceValue={unapprovedInvoiceTotal}
        grossAvailability={grossAvailability}
        netAvailability={netAvailability}
        currentAccountBalance={currentAccountBalance}
      />
      
      {!isAdmin && (
          <PaymentRequestForm
            netAvailability={netAvailability}
            onSubmitRequest={handleRequestDrawdown}
            isLoading={drawdownLoading}
            requestError={drawdownError}
            requestSuccess={drawdownSuccess}
          />
      )}
      
      {!isAdmin && (
          <LedgerEntryForm onSubmit={handleAddLedgerEntry} />
      )}

      <View marginTop="large">
        <Tabs
            defaultValue="salesLedger"
            items={[
                {
                    label: 'Sales Ledger',
                    value: 'salesLedger',
                    content: <LedgerHistory entries={entries} isLoading={loading} />
                },
                {
                    label: 'Current Account',
                    value: 'currentAccount',
                    content: <LedgerHistory entries={currentAccountTransactions} isLoading={loading} />
                }
            ]}
        />
      </View>
    </View>
  );
}

export default SalesLedger;



// ==========================================================
// FILE: CreateLedgerEntry.pipeline.req.vtl (Review for correctness)
// ==========================================================

#set( $input = $context.args.input )
#set( $userId = $context.identity.sub )
#set( $now = $util.time.nowISO8601() )

#if( $util.isNullOrBlank($userId) )
    $util.error("User identity is missing.", "AuthenticationError")
#end

#set( $ledgerEntryItem = {
    "id": $util.autoId(),
    "owner": $userId,
    "type": $input.type,
    "amount": $input.amount,
    "description": $util.defaultIfNull($input.description, ""),
    "createdAt": $now,
    "updatedAt": $now,
    "__typename": "LedgerEntry"
})

$util.qr($ctx.stash.put("ledgerEntryItem", $ledgerEntryItem))

#set( $delta = 0 )
#if( $input.type == "INVOICE" || $input.type == "INCREASE_ADJUSTMENT" )
    #set( $delta = $input.amount )
#elseif( $input.type == "CREDIT_NOTE" || $input.type == "DECREASE_ADJUSTMENT" )
    #set( $delta = $input.amount * -1 )
#end

$util.qr($ctx.stash.put("balanceDelta", $delta))
$util.qr($ctx.stash.put("ownerId", $userId))

{}
