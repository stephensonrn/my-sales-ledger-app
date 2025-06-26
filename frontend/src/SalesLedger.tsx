// src/SalesLedger.tsx
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { generateClient } from 'aws-amplify/api';
import { fetchUserAttributes } from 'aws-amplify/auth';
// --- THIS IS NEW (Part 1): Import the Storage utility ---
import { Storage } from 'aws-amplify/storage';
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
import { Loader, Alert, View, Text, Heading, Tabs, Button, Flex } from '@aws-amplify/ui-react';
import { StorageManager } from '@aws-amplify/ui-react-storage';

const ADVANCE_RATE = 0.9;
const ADMIN_EMAIL = "ross@aurumif.com";

interface SalesLedgerProps {
  loggedInUser: any;
  isAdmin?: boolean;
  targetUserId?: string | null;
  refreshKey?: number;
}

function SalesLedger({ loggedInUser, isAdmin = false, targetUserId = null, refreshKey = 0 }: SalesLedgerProps) {
  const [client] = useState(generateClient());
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [currentAccountTransactions, setCurrentAccountTransactions] = useState<CurrentAccountTransaction[]>([]);
  const [accountStatus, setAccountStatus] = useState<AccountStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drawdownLoading, setDrawdownLoading] = useState(false);
  const [drawdownError, setDrawdownError] = useState<string | null>(null);
  const [drawdownSuccess, setDrawdownSuccess] = useState<string | null>(null);

  // --- THIS IS NEW (Part 2): State for the manual upload test ---
  const [testFile, setTestFile] = useState<File | null>(null);
  const [testUploadStatus, setTestUploadStatus] = useState('');

  const ownerSub = isAdmin ? targetUserId : (loggedInUser?.attributes?.sub || loggedInUser?.userId);

  useEffect(() => {
    if (!ownerSub) {
      setLoading(false);
      return;
    }
    // ... (rest of the useEffect is the same)
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
  }, [loggedInUser, isAdmin, targetUserId, client, refreshKey, ownerSub]);

  // --- Calculations ---
  const salesLedgerBalance = useMemo(() => entries.reduce((acc, entry) => {
      const amount = entry.amount || 0;
      switch (entry.type) {
        case LedgerEntryType.INVOICE: case LedgerEntryType.INCREASE_ADJUSTMENT: return acc + amount;
        case LedgerEntryType.CREDIT_NOTE: case LedgerEntryType.DECREASE_ADJUSTMENT: case LedgerEntryType.CASH_RECEIPT: return acc - amount;
        default: return acc;
      }
    }, 0), [entries]);
  const unapprovedInvoiceTotal = accountStatus?.totalUnapprovedInvoiceValue || 0;
  const approvedSalesLedger = salesLedgerBalance - unapprovedInvoiceTotal;
  const currentAccountBalance = useMemo(() => currentAccountTransactions.reduce((acc, tx) => {
      const amount = tx.amount || 0;
      switch (tx.type) {
        case 'PAYMENT_REQUEST': return acc + amount;
        case 'CASH_RECEIPT': return acc - amount;
        default: return acc;
      }
    }, 0), [currentAccountTransactions]);
  const grossAvailability = approvedSalesLedger * ADVANCE_RATE;
  const netAvailability = grossAvailability - currentAccountBalance;

  // --- THIS IS NEW (Part 3): Handler for the manual upload test ---
  const handleManualUpload = async () => {
    if (!testFile) {
        setTestUploadStatus('Please choose a file first.');
        return;
    }
    if (!ownerSub) {
        setTestUploadStatus('Error: Cannot determine user folder.');
        return;
    }
    setTestUploadStatus(`Uploading ${testFile.name}...`);
    try {
        const result = await Storage.put(`${testFile.name}`, testFile, {
            level: 'private', // This ensures it goes into private/USER_SUB_ID/
            contentType: testFile.type,
        });
        console.log('Manual upload success:', result);
        setTestUploadStatus(`Success! File uploaded: ${result.key}`);
    } catch (error) {
        console.error('Manual upload error:', error);
        setTestUploadStatus(`Error: ${error.message}`);
    }
  };

  // --- Mutation Handlers ---
  const handleAddLedgerEntry = async (newEntry: Pick<LedgerEntry, 'type' | 'amount' | 'description'>) => { /* ... existing code ... */ };
  const handleRequestDrawdown = async (amount: number) => { /* ... existing code ... */ };

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
      {!isAdmin && <PaymentRequestForm netAvailability={netAvailability} onSubmitRequest={handleRequestDrawdown} isLoading={drawdownLoading} requestError={drawdownError} requestSuccess={drawdownSuccess} />}
      {!isAdmin && <LedgerEntryForm onSubmit={handleAddLedgerEntry} />}
      <View marginTop="large">
        <Tabs
            defaultValue="salesLedger"
            items={[
                { label: 'Sales Ledger', value: 'salesLedger', content: <LedgerHistory entries={entries} isLoading={loading} /> },
                { label: 'Current Account', value: 'currentAccount', content: <LedgerHistory entries={currentAccountTransactions} isLoading={loading} /> },
                {
                    label: 'Documents',
                    value: 'documents',
                    content: (
                        <View paddingTop="medium">
                            {/* --- THIS IS NEW (Part 4): The manual upload test UI --- */}
                            <Card variation="outlined" marginBottom="large">
                                <Heading level={5}>Manual Upload Test</Heading>
                                <Flex direction="column" gap="small" marginTop="small">
                                    <input type="file" onChange={(e) => setTestFile(e.target.files ? e.target.files[0] : null)} />
                                    <Button onClick={handleManualUpload}>Upload Test File</Button>
                                    {testUploadStatus && <Text>{testUploadStatus}</Text>}
                                </Flex>
                            </Card>

                            <Heading level={5} marginBottom="small">File Cabinet</Heading>
                            <StorageManager
                                path={`private/${ownerSub}/`}
                                maxFileCount={10}
                                acceptedFileTypes={['image/*', '.pdf', '.doc', '.docx', '.xls', '.xlsx']}
                                isResumable
                            />
                        </View>
                    )
                }
            ]}
        />
      </View>
    </View>
  );
}

export default SalesLedger;
