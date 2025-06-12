// src/SalesLedger.tsx

import React, { useState, useEffect, useCallback } from 'react';

// 1. Correct imports for AWS Amplify Gen 2 / v6+
// No longer import from 'aws-amplify'
import { generateClient } from '@aws-amplify/api'; // Correct import for API
import { getCurrentUser } from 'aws-amplify/auth';

// 2. Import your GraphQL queries, mutations, and subscriptions
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

// 3. Define your data types (recommended for TypeScript)
// Replace these properties with the actual fields from your Sales Ledger model.
interface SalesLedgerEntry {
  id: string;
  customerName: string;
  amount: number;
  date: string;
  // Other fields from your Sales Ledger model
}

interface AccountStatus {
  totalUnapprovedInvoiceValue: number;
  // Add other account status fields here
}

interface CurrentAccountTransaction {
  id: string;
  amount: number;
  type: string;
  date: string;
  // Add other transaction fields here
}

// 4. Create the API client (using the new way to create an API client in AWS Amplify v6+)
const client = generateClient();

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

  const [entries, setEntries] = useState<SalesLedgerEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [currentSalesLedgerBalance, setCurrentSalesLedgerBalance] = useState(0);

  const [accountStatus, setAccountStatus] = useState<AccountStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  const [currentAccountTransactions, setCurrentAccountTransactions] = useState<CurrentAccountTransaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(true);
  const [calculatedCurrentAccountBalance, setCalculatedCurrentAccountBalance] = useState(0);

  const [grossAvailability, setGrossAvailability] = useState(0);
  const [netAvailability, setNetAvailability] = useState(0);
  const [grossAvailTemp, setGrossAvailTemp] = useState(0);
  const [netAvailTemp, setNetAvailTemp] = useState(0);

  const [paymentRequestLoading, setPaymentRequestLoading] = useState(false);
  const [paymentRequestError, setPaymentRequestError] = useState<string | null>(null);
  const [paymentRequestSuccess, setPaymentRequestSuccess] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);

  // Fetch logged in user sub and attributes on mount
  useEffect(() => {
    async function fetchUserDetails() {
      try {
        const user = await Auth.currentAuthenticatedUser();
        setLoggedInUserSub(user.attributes.sub);
        setUserEmail(user.attributes.email ?? null);
        setUserCompanyName(user.attributes['custom:companyName'] ?? null);
        console.log("SalesLedger: User sub, email, company loaded:", user.attributes.sub, user.attributes.email, user.attributes['custom:companyName']);
      } catch (err) {
        console.error("SalesLedger: Error fetching user details:", err);
        setLoggedInUserSub(null);
        setUserEmail(null);
        setUserCompanyName(null);
        setError("Could not retrieve current user session. Please ensure you are logged in.");
      }
    }
    fetchUserDetails();
  }, []);

  // Determine userId for data based on admin/non-admin and props
  useEffect(() => {
    if (isAdmin && targetUserId) {
      setUserIdForData(targetUserId);
      console.log("SalesLedger: Admin is viewing/acting for target user:", targetUserId);
    } else if (!isAdmin && loggedInUserSub) {
      setUserIdForData(loggedInUserSub);
      console.log("SalesLedger: Non-admin is viewing/acting for their own data:", loggedInUserSub);
    } else if (isAdmin && !targetUserId) {
      setUserIdForData(null);
      setEntries([]);
      setAccountStatus(null);
      setCurrentAccountTransactions([]);
      setLoadingEntries(false);
      setLoadingStatus(false);
      setLoadingTransactions(false);
    } else {
      setUserIdForData(null);
    }
  }, [isAdmin, targetUserId, loggedInUserSub]);

  // Helper to fetch all pages of LedgerEntries
  const fetchAllLedgerEntries = useCallback(async (ownerId: string): Promise<LedgerEntry[]> => {
    let allEntries: LedgerEntry[] = [];
    let nextToken: string | undefined = undefined;
    try {
      do {
        const response = await client.graphql({
          query: listLedgerEntries,
          variables: { filter: { owner: { eq: ownerId } }, nextToken, limit: 50 },
        });
        const items = response.data?.listLedgerEntries?.items || [];
        allEntries = [...allEntries, ...items];
        nextToken = response.data?.listLedgerEntries?.nextToken || undefined;
      } while (nextToken);
      return allEntries;
    } catch (err) {
      throw err;
    }
  }, []);

  // Helper to fetch all pages of CurrentAccountTransactions
  const fetchAllCurrentAccountTransactions = useCallback(async (ownerId: string): Promise<CurrentAccountTransaction[]> => {
    let allTransactions: CurrentAccountTransaction[] = [];
    let nextToken: string | undefined = undefined;
    try {
      do {
        const response = await client.graphql({
          query: listCurrentAccountTransactions,
          variables: { filter: { owner: { eq: ownerId } }, nextToken, limit: 50 },
        });
        const items = response.data?.listCurrentAccountTransactions?.items || [];
        allTransactions = [...allTransactions, ...items];
        nextToken = response.data?.listCurrentAccountTransactions?.nextToken || undefined;
      } while (nextToken);
      return allTransactions;
    } catch (err) {
      throw err;
    }
  }, []);

  // Fetch AccountStatus (no pagination needed)
  const fetchInitialStatus = useCallback(async (ownerId: string) => {
    setLoadingStatus(true);
    setError(null);
    try {
      const response = await client.graphql({
        query: listAccountStatuses,
        variables: { filter: { owner: { eq: ownerId } }, limit: 1 },
      });
      const items = response.data?.listAccountStatuses?.items || [];
      setAccountStatus(items.length > 0 ? items[0] : null);
    } catch (err) {
      setError('Account status error: ' + (err.message || 'Unknown error.'));
      setAccountStatus(null);
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  // Centralized refresh function
  const refreshAllData = useCallback(async () => {
    if (!userIdForData) return;
    setLoadingEntries(true);
    setLoadingStatus(true);
    setLoadingTransactions(true);
    setError(null);

    try {
      const [allEntries, allTransactions] = await Promise.all([
        fetchAllLedgerEntries(userIdForData),
        fetchAllCurrentAccountTransactions(userIdForData),
        fetchInitialStatus(userIdForData),
      ]);

      setEntries(allEntries);
      setCurrentAccountTransactions(allTransactions);
    } catch (err) {
      setError('Data fetch error: ' + (err.message || 'Unknown error.'));
    } finally {
      setLoadingEntries(false);
      setLoadingTransactions(false);
      setLoadingStatus(false);
    }
  }, [userIdForData, fetchAllLedgerEntries, fetchAllCurrentAccountTransactions, fetchInitialStatus]);

  useEffect(() => {
    refreshAllData();
  }, [userIdForData, refreshAllData]);

  // Subscription for new ledger entries
  useEffect(() => {
    if (!userIdForData) return;
    const sub = client.graphql({
      query: onCreateLedgerEntry,
      variables: { owner: userIdForData },
    });

    const subscription = sub.subscribe({
      next: ({ value }) => {
        const newEntry = value.data?.onCreateLedgerEntry;
        if (newEntry) {
          refreshAllData();
        }
      },
      error: (err) => {
        setError("Subscription error: " + (err.message || 'Unknown error.'));
      },
    });
    return () => subscription.unsubscribe();
  }, [userIdForData, refreshAllData]);

  if (isLoading) {
    return <div>Loading data...</div>;
  }

  if (error) {
    return <div style={{ color: 'red' }}>Error: {error}</div>;
  }

  return (
    <div>
      <h1>Sales Ledger</h1>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Customer</th>
            <th>Amount</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(entry => (
            <tr key={entry.id}>
              <td>{entry.id}</td>
              <td>{entry.customerName}</td>
              <td>${entry.amount.toFixed(2)}</td>
              <td>{new Date(entry.date).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default SalesLedger;
