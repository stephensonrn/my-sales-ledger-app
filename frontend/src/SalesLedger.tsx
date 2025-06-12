import React, { useState, useEffect, useCallback } from 'react';
import { generateClient } from 'aws-amplify/api';
import { getCurrentUser } from 'aws-amplify/auth'; // Correct import for getCurrentUser
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
}

function SalesLedger({ targetUserId, isAdmin = false }: SalesLedgerProps) {
  const [loggedInUserSub, setLoggedInUserSub] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userCompanyName, setUserCompanyName] = useState<string | null>(null);
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
    async function fetchUserDetails() {
      try {
        const user = await getCurrentUser();
        setLoggedInUserSub(user.username);
        setUserEmail(user.attributes.email ?? null);
        setUserCompanyName(user.attributes['custom:companyName'] ?? null);
      } catch (err) {
        setError("Could not retrieve current user session. Please ensure you are logged in.");
      }
    }
    fetchUserDetails();
  }, []);

  useEffect(() => {
    if (isAdmin && targetUserId) {
      setUserIdForData(targetUserId);
    } else if (!isAdmin && loggedInUserSub) {
      setUserIdForData(loggedInUserSub);
    }
  }, [isAdmin, targetUserId, loggedInUserSub]);

  const fetchAllLedgerEntries = useCallback(async (ownerId: string): Promise<LedgerEntry[]> => {
    let allEntries: LedgerEntry[] = [];
    let nextToken: string | undefined = undefined;
    try {
      do {
        const response = await generateClient().graphql({
          query: listLedgerEntries,
          variables: {
            filter: { owner: { eq: ownerId } },
            nextToken,
            limit: 50,
          }
        });
        const items = response.data?.listLedgerEntries?.items?.filter(Boolean) as LedgerEntry[] || [];
        allEntries = [...allEntries, ...items];
        nextToken = response.data?.listLedgerEntries?.nextToken || undefined;
      } while (nextToken);
      return allEntries;
    } catch (err) {
      throw err;
    }
  }, []);

  const handlePaymentRequest = async () => {
    setPaymentRequestLoading(true);
    setPaymentRequestError(null);
    setPaymentRequestSuccess(null);
    try {
      const input: SendPaymentRequestInput = {
        amount: 0, // Adjust calculation as needed
        toEmail: userEmail,
      };
      await generateClient().graphql({
        query: sendPaymentRequestEmail,
        variables: { input },
      });
      setPaymentRequestSuccess("Payment request sent successfully!");
    } catch (error) {
      setPaymentRequestError("Failed to submit payment request. Please try again.");
    } finally {
      setPaymentRequestLoading(false);
    }
  };

  const handleAddLedgerEntry = async (newEntry: LedgerEntry) => {
    try {
      const input: AdminCreateLedgerEntryInput = {
        amount: newEntry.amount,
        description: newEntry.description,
        type: newEntry.type,
        createdAt: new Date().toISOString(),
        owner: userIdForData,
      };
      await generateClient().graphql({
        query: adminCreateLedgerEntry,
        variables: { input },
      });
      refreshAllData();
    } catch (err) {
      setError("Failed to add ledger entry. Please try again.");
    }
  };

  return (
    <div>
      <h2>Sales Ledger</h2>
      <CurrentBalance balance={0} />  {/* Assuming you populate this dynamically */}
      <LedgerEntryForm onSubmit={handleAddLedgerEntry} />
      <PaymentRequestForm onSubmitRequest={handlePaymentRequest} isLoading={paymentRequestLoading} requestError={paymentRequestError} requestSuccess={paymentRequestSuccess} />
    </div>
  );
}

export default SalesLedger;
