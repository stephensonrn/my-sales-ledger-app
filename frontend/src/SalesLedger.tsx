import React, { useState, useEffect, useCallback } from 'react';
import { generateClient } from 'aws-amplify/api';
import { Auth } from 'aws-amplify'; // For session management
import {
  listLedgerEntries,
  listAccountStatuses,
  listCurrentAccountTransactions
} from './graphql/operations/queries';
import {
  createLedgerEntry,
  adminCreateLedgerEntry,
  sendPaymentRequestEmail,
  adminRequestPaymentForUser
} from './graphql/operations/mutations';
import { onCreateLedgerEntry } from './graphql/operations/subscriptions';
import {
  LedgerEntryType,
  type LedgerEntry,
  type AccountStatus,
  type CurrentAccountTransaction,
  type AdminCreateLedgerEntryInput,
  type SendPaymentRequestInput
} from './graphql/API';
import CurrentBalance from './CurrentBalance';
import LedgerEntryForm from './LedgerEntryForm';
import LedgerHistory from './LedgerHistory';
import AvailabilityDisplay from './AvailabilityDisplay';
import PaymentRequestForm from './PaymentRequestForm';
import ManageAccountStatus from './ManageAccountStatus';
import { Loader, Text, Alert, View } from '@aws-amplify/ui-react';

const ADVANCE_RATE = 0.90;

interface SalesLedgerProps {
  targetUserId?: string | null;
  isAdmin?: boolean;
  loggedInUser: any;
}

function SalesLedger({ targetUserId, isAdmin = false, loggedInUser }: SalesLedgerProps) {
  const client = generateClient();
  const [loggedInUserSub, setLoggedInUserSub] = useState<string | null>(loggedInUser.username);
  const [userEmail, setUserEmail] = useState<string | null>(loggedInUser.attributes?.email ?? null);
  const [userCompanyName, setUserCompanyName] = useState<string | null>(loggedInUser.attributes?.['custom:company_name'] ?? null);
  const [userIdForData, setUserIdForData] = useState<string | null>(null);

  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [accountStatus, setAccountStatus] = useState<AccountStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [currentAccountTransactions, setCurrentAccountTransactions] = useState<CurrentAccountTransaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(true);

  const [paymentRequestLoading, setPaymentRequestLoading] = useState(false);
  const [paymentRequestError, setPaymentRequestError] = useState<string | null>(null);
  const [paymentRequestSuccess, setPaymentRequestSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAdmin && targetUserId) {
      setUserIdForData(targetUserId);
    } else if (!isAdmin && loggedInUserSub) {
      setUserIdForData(loggedInUserSub);
    } else {
      setUserIdForData(null);
    }
  }, [isAdmin, targetUserId, loggedInUserSub]);

  const fetchAllLedgerEntries = useCallback(async (ownerId: string): Promise<LedgerEntry[]> => {
    let allEntries: LedgerEntry[] = [];
    let nextToken: string | undefined = undefined;
    try {
      do {
        const response = await client.graphql({
          query: listLedgerEntries,
          variables: { filter: { owner: { eq: ownerId } }, nextToken, limit: 50 },
          authMode: 'userPool',
        });
        const items = response?.data?.listLedgerEntries?.items?.filter(Boolean) as LedgerEntry[] || [];
        allEntries = [...allEntries, ...items];
        nextToken = response?.data?.listLedgerEntries?.nextToken || undefined;
      } while (nextToken);
      return allEntries;
    } catch (err) {
      setError("Failed to load ledger entries.");
      throw err;
    }
  }, [client]);

  const refreshAllData = useCallback(async () => {
    if (!userIdForData) return;
    setLoadingEntries(true);
    try {
      const entriesResponse = await fetchAllLedgerEntries(userIdForData);
      setEntries(entriesResponse);
    } catch (err) {
      setError("Failed to load ledger history.");
    } finally {
      setLoadingEntries(false);
    }

    setLoadingStatus(true);
    try {
      const statusResponse = await client.graphql({
        query: listAccountStatuses,
        variables: { owner: userIdForData, limit: 1 },
        authMode: 'userPool',
      });
      const statusItem = statusResponse?.data?.listAccountStatuses?.items?.[0] || null;
      setAccountStatus(statusItem);
    } catch (err) {
      setError("Failed to load account status.");
    } finally {
      setLoadingStatus(false);
    }

    setLoadingTransactions(true);
    try {
      const transactionsResponse = await client.graphql({
        query: listCurrentAccountTransactions,
        variables: { filter: { owner: { eq: userIdForData } } },
        authMode: 'userPool',
      });
      const transactionItems = transactionsResponse?.data?.listCurrentAccountTransactions?.items?.filter(Boolean) as CurrentAccountTransaction[] || [];
      setCurrentAccountTransactions(transactionItems);
    } catch (err) {
      setError("Failed to load account transactions.");
    } finally {
      setLoadingTransactions(false);
    }
  }, [userIdForData, fetchAllLedgerEntries, client]);

  useEffect(() => {
    refreshAllData();
  }, [userIdForData, refreshAllData]);

  useEffect(() => {
    if (!userIdForData) return;
    const fetchAuthToken = async () => {
      try {
        const session = await Auth.currentSession();
        const idToken = session.getIdToken().getJwtToken(); 
        const sub = client.graphql({
          query: onCreateLedgerEntry,
          variables: { owner: userIdForData },
          authMode: 'userPool',
          headers: { Authorization: idToken },
        }).subscribe({
          next: ({ data }) => {
            const newEntry = data.onCreateLedgerEntry;
            if (newEntry) {
              setEntries(prevEntries => [newEntry, ...prevEntries]);
            }
          },
          error: (subscriptionError) => console.error("Subscription error:", subscriptionError)
        });
        return () => sub.unsubscribe();
      } catch (error) {
        console.error('Error fetching session:', error);
      }
    };
    fetchAuthToken();
  }, [userIdForData, client]);

  const handlePaymentRequest = async () => {
    setPaymentRequestLoading(true);
    setPaymentRequestError(null);
    setPaymentRequestSuccess(null);
    try {
      if (!userEmail) throw new Error("User email is not available for payment request.");
      const amountToRequest = accountStatus?.totalUnapprovedInvoiceValue * ADVANCE_RATE || 0;
      if (amountToRequest <= 0) {
        throw new Error("Calculated amount for payment request is zero or negative.");
      }

      const input: SendPaymentRequestInput = {
        amount: amountToRequest,
        toEmail: userEmail,
      };
      await client.graphql({
        query: sendPaymentRequestEmail,
        variables: { input },
        authMode: 'userPool',
      });
      setPaymentRequestSuccess("Payment request sent successfully!");
    } catch (error) {
      setPaymentRequestError("Failed to submit payment request: " + (error as Error).message);
    } finally {
      setPaymentRequestLoading(false);
    }
  };

  const handleAddLedgerEntry = async (newEntry: LedgerEntry) => {
    try {
      if (!userIdForData) {
        setError("Cannot add entry: User ID for data not available.");
        return;
      }
      const input: AdminCreateLedgerEntryInput = {
        amount: newEntry.amount || 0,
        description: newEntry.description || '',
        type: newEntry.type,
        targetUserId: userIdForData,
      };
      await client.graphql({
        query: adminCreateLedgerEntry,
        variables: { input },
        authMode: 'userPool',
      });
      refreshAllData();
    } catch (err) {
      setError("Failed to add ledger entry. Please try again.");
    }
  };

  if (loadingEntries || loadingStatus || loadingTransactions) {
    return (
      <View className="sales-ledger-loader">
        <Loader variation="linear" size="large" />
        <Text>Loading ledger data...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="sales-ledger-error">
        <Alert variation="error">
          <Text>{error}</Text>
        </Alert>
      </View>
    );
  }

  return (
    <View className="sales-ledger-container">
      <h2>Sales Ledger for {userCompanyName || 'Your Business'}</h2>
      <CurrentBalance balance={accountStatus?.totalUnapprovedInvoiceValue || 0} />
      <AvailabilityDisplay currentBalance={accountStatus?.totalUnapprovedInvoiceValue || 0} advanceRate={ADVANCE_RATE} />
      <LedgerEntryForm onSubmit={handleAddLedgerEntry} />
      <PaymentRequestForm
        onSubmitRequest={handlePaymentRequest}
        isLoading={paymentRequestLoading}
        requestError={paymentRequestError}
        requestSuccess={paymentRequestSuccess}
        calculatedAdvance={accountStatus ? accountStatus.totalUnapprovedInvoiceValue * ADVANCE_RATE : 0}
      />
      <ManageAccountStatus selectedOwnerSub={userIdForData} />
      <LedgerHistory entries={entries} isLoading={loadingEntries} />
    </View>
  );
}

export default SalesLedger;
