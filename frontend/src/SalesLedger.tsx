// src/SalesLedger.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { API, graphqlOperation } from 'aws-amplify';
import type { ObservableSubscription } from '@aws-amplify/api-graphql';
import * as Auth from '@aws-amplify/auth';

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
  type ListLedgerEntriesQuery,
  type ListAccountStatusesQuery,
  type ListCurrentAccountTransactionsQuery,
  type AdminCreateLedgerEntryInput,
  type AdminRequestPaymentForUserInput,
  type SendPaymentRequestInput,
  type AdminCreateLedgerEntryMutation,
  type AdminRequestPaymentForUserMutation,
  type SendPaymentRequestEmailMutation,
  type OnCreateLedgerEntrySubscription,
  type OnCreateLedgerEntrySubscriptionVariables,
} from './graphql/API';

import CurrentBalance from './CurrentBalance';
import LedgerEntryForm from './LedgerEntryForm';
import LedgerHistory from './LedgerHistory';
import AvailabilityDisplay from './AvailabilityDisplay';
import PaymentRequestForm from './PaymentRequestForm';
import ManageAccountStatus from './ManageAccountStatus'; // <-- Import ManageAccountStatus
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
        const response = await API.graphql(graphqlOperation(listLedgerEntries, {
          filter: { owner: { eq: ownerId } },
          nextToken,
          limit: 50,
        })) as { data: ListLedgerEntriesQuery; errors?: any[] };
        if (response.errors) throw response.errors;
        const items = response.data?.listLedgerEntries?.items?.filter(Boolean) as LedgerEntry[] || [];
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
        const response = await API.graphql(graphqlOperation(listCurrentAccountTransactions, {
          filter: { owner: { eq: ownerId } },
          nextToken,
          limit: 50,
        })) as { data: ListCurrentAccountTransactionsQuery; errors?: any[] };
        if (response.errors) throw response.errors;
        const items = response.data?.listCurrentAccountTransactions?.items?.filter(Boolean) as CurrentAccountTransaction[] || [];
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
      const response = await API.graphql(graphqlOperation(listAccountStatuses, {
        filter: { owner: { eq: ownerId } },
        limit: 1,
      })) as { data: ListAccountStatusesQuery; errors?: any[] };
      if (response.errors) throw response.errors;
      const items = response.data?.listAccountStatuses?.items?.filter(Boolean) as AccountStatus[] || [];
      setAccountStatus(items.length > 0 ? items[0] : null);
    } catch (err: any) {
      const errorMessages = err.errors && Array.isArray(err.errors) ? err.errors.map((e: any) => e.message).join(', ') : err.message || 'Unknown error fetching account status.';
      setError(`Account status error: ${errorMessages}`);
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

      setEntries(allEntries.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
      setCurrentAccountTransactions(allTransactions.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
    } catch (err: any) {
      const errorMessages = err.errors && Array.isArray(err.errors)
        ? err.errors.map((e: any) => e.message).join(', ')
        : err.message || 'Unknown error fetching sales ledger data.';
      setError(`Data fetch error: ${errorMessages}`);
      setEntries([]);
      setCurrentAccountTransactions([]);
      setAccountStatus(null);
    } finally {
      setLoadingEntries(false);
      setLoadingTransactions(false);
      setLoadingStatus(false);
    }
  }, [userIdForData, fetchAllLedgerEntries, fetchAllCurrentAccountTransactions, fetchInitialStatus]);

  // Use centralized refresh function on userIdForData change
  useEffect(() => {
    refreshAllData();
  }, [userIdForData, refreshAllData]);

  // Subscription for new ledger entries
  useEffect(() => {
    if (!userIdForData) return;
    const sub = API.graphql({
      query: onCreateLedgerEntry,
      variables: { owner: userIdForData },
      authMode: 'AMAZON_COGNITO_USER_POOLS'
    }) as ObservableSubscription<OnCreateLedgerEntrySubscription, OnCreateLedgerEntrySubscriptionVariables>;

    const subscription = sub.subscribe({
      next: ({ value }) => {
        const newEntry = value.data?.onCreateLedgerEntry;
        if (newEntry && newEntry.owner === userIdForData) {
          refreshAllData();
        }
      },
      error: (err) => {
        console.error("SalesLedger Subscription error:", err);
        setError("Subscription error. Data may not be live.");
      }
    });
    return () => subscription.unsubscribe();
  }, [userIdForData, refreshAllData]);

  // Calculate Current Sales Ledger Balance based on all entries
  useEffect(() => {
    let calculatedSLBalance = 0;
    entries.forEach(entry => {
      const type = (entry.type || '').toUpperCase();
      const amount = parseFloat(entry.amount ?? 0);
      if (type === 'INVOICE' || type === 'INCREASE_ADJUSTMENT') {
        calculatedSLBalance += amount;
      } else if (['CREDIT_NOTE', 'DECREASE_ADJUSTMENT', 'CASH_RECEIPT'].includes(type)) {
        calculatedSLBalance -= amount;
      }
    });
    setCurrentSalesLedgerBalance(parseFloat(calculatedSLBalance.toFixed(2)));
  }, [entries]);

  // Calculate Current Account Balance based on all transactions
  useEffect(() => {
    let calculatedAccBalance = 0;
    currentAccountTransactions.forEach(transaction => {
      const type = (transaction.type || '').toUpperCase();
      const amount = parseFloat(transaction.amount ?? 0);
      if (type === 'PAYMENT_REQUEST') {
        calculatedAccBalance += amount;
      } else if (type === 'CASH_RECEIPT') {
        calculatedAccBalance -= amount;
      }
    });
    setCalculatedCurrentAccountBalance(parseFloat(calculatedAccBalance.toFixed(2)));
  }, [currentAccountTransactions]);

  // Calculate gross and net availability
  useEffect(() => {
    const unapprovedValue = accountStatus?.totalUnapprovedInvoiceValue ?? 0;
    const grossAvail = (currentSalesLedgerBalance - unapprovedValue) * ADVANCE_RATE;
    setGrossAvailTemp(grossAvail);
  }, [currentSalesLedgerBalance, accountStatus]);

  useEffect(() => {
    const netAvail = grossAvailTemp - calculatedCurrentAccountBalance;
    setNetAvailTemp(netAvail);
  }, [grossAvailTemp, calculatedCurrentAccountBalance]);

  useEffect(() => { setGrossAvailability(Math.max(0, parseFloat(grossAvailTemp.toFixed(2)))); }, [grossAvailTemp]);
  useEffect(() => { setNetAvailability(Math.max(0, parseFloat(netAvailTemp.toFixed(2)))); }, [netAvailTemp]);

  // Handler to add ledger entries
  const handleAddLedgerEntry = async (entryData: { type: string; amount: number; description?: string }) => {
    if (!loggedInUserSub) {
      setError("Your session is invalid. Cannot add entry.");
      return;
    }
    if (!userIdForData && !isAdmin) {
      setError("User context not available for action.");
      return;
    }
    if (isAdmin && !targetUserId && !userIdForData) {
      setError("No target user selected by admin for action.");
      return;
    }

    setError(null);
    try {
      if (isAdmin && targetUserId && targetUserId === userIdForData) {
        const adminInput: AdminCreateLedgerEntryInput = {
          type: entryData.type as LedgerEntryType,
          amount: entryData.amount,
          description: entryData.description || undefined,
          targetUserId: targetUserId,
        };
        await API.graphql(graphqlOperation(adminCreateLedgerEntry, { input: adminInput }));
      } else {
        const input = {
          type: entryData.type as LedgerEntryType,
          amount: entryData.amount,
          description: entryData.description || undefined,
        };
        await API.graphql(graphqlOperation(createLedgerEntry, { input }));
      }

      await refreshAllData();

    } catch (err: any) {
      const errorMessages = err.errors && Array.isArray(err.errors)
        ? err.errors.map((e: any) => e.message).join(', ')
        : err.message || 'Unknown error while adding entry.';
      setError(`Failed to save transaction: ${errorMessages}`);
    }
  };

  // Handler to submit payment requests
  const handlePaymentRequest = async (amount: number) => {
    if (!loggedInUserSub) {
      setError("Your session is invalid. Cannot request payment.");
      setPaymentRequestLoading(false);
      return;
    }
    if (!userIdForData) {
      setError("User context for action is not available.");
      setPaymentRequestLoading(false);
      return;
    }
    if (isAdmin && (!targetUserId || targetUserId !== userIdForData)) {
      setError("Admin action: Target user context is unclear or does not match.");
      setPaymentRequestLoading(false);
      return;
    }

    setPaymentRequestLoading(true);
    setPaymentRequestError(null);
    setPaymentRequestSuccess(null);

    try {
      if (isAdmin && targetUserId && targetUserId === userIdForData) {
        const adminInput: AdminRequestPaymentForUserInput = {
          targetUserId: targetUserId,
          amount: amount,
          paymentDescription: `Payment request for user ${targetUserId} with email address ${userEmail ?? "N/A"} and from ${userCompanyName ?? "Unknown Company"} initiated by admin ${loggedInUserSub}`,
        };
        const result = await API.graphql<AdminRequestPaymentForUserMutation>(graphqlOperation(adminRequestPaymentForUser, { input: adminInput }));
        if (result.errors) throw result.errors;
        const responseData = result.data?.adminRequestPaymentForUser;
        if (responseData?.success) {
          setPaymentRequestSuccess(responseData.message || `Admin: Payment request submitted successfully! Transaction ID: ${responseData.transactionId || 'N/A'}`);
        } else {
          throw new Error(responseData?.message || "Admin payment request failed.");
        }
      } else {
        const toEmailValue = "ross@aurumif.com";
        const subjectValue = `Payment Request - Amount: £${amount.toFixed(2)} from user ${userEmail ?? loggedInUserSub}`;
        const bodyValue = `User (sub: ${loggedInUserSub}) with email address ${userEmail ?? "N/A"} and from ${userCompanyName ?? "Unknown Company"} requested payment of £${amount.toFixed(2)}.`;

        const input: SendPaymentRequestInput = {
          amount,
          toEmail: toEmailValue,
          subject: subjectValue,
          body: bodyValue,
        };

        const result = await API.graphql<SendPaymentRequestEmailMutation>(graphqlOperation(sendPaymentRequestEmail, { input }));
        if (result.errors) throw result.errors;
        setPaymentRequestSuccess(result.data?.sendPaymentRequestEmail ?? 'Payment request submitted successfully!');
      }

      await refreshAllData();

    } catch (err: any) {
      const errorMessage = err.errors && Array.isArray(err.errors)
        ? err.errors.map((e: any) => e.message).join(", ")
        : err.message || 'Unknown error processing payment request.';
      setPaymentRequestError(`Failed to submit payment request: ${errorMessage}`);
      setPaymentRequestSuccess(null);
    } finally {
      setPaymentRequestLoading(false);
    }
  };

  // --- Render Logic ---
  if (!loggedInUserSub && !targetUserId && !isAdmin) {
    if (error && error.startsWith("Could not retrieve current user session")) {
      return <Alert variation="error" heading="Session Error">{error}</Alert>;
    }
    return (<View padding="xl" textAlign="center"><Loader size="large" /> <Text>Initializing user session...</Text></View>);
  }

  if (isAdmin && !targetUserId) {
    if (error) {
      return <Alert variation="error" heading="Admin Page Error">{error}</Alert>;
    }
    return (<View padding="xl"><Alert variation="info">Please select a user from the list on the Admin Page to view their sales ledger details.</Alert></View>);
  }

  if (!userIdForData) {
    if (error) {
      return <Alert variation="error" heading="Error">{error}</Alert>;
    }
    return (<View padding="xl" textAlign="center"><Loader size="large" /><Text>Loading user context...</Text></View>);
  }

  if (error && !loadingEntries && !loadingStatus && !loadingTransactions) {
    return <Alert variation="error" isDismissible={true} onDismiss={() => setError(null)}>{error}</Alert>;
  }

  if (loadingEntries || loadingStatus || loadingTransactions) {
    return (<View padding="xl" textAlign="center"><Loader size="large" /> <Text>Loading data for {isAdmin && targetUserId ? `user ${targetUserId.substring(0, 8)}...` : 'you'}...</Text></View>);
  }

  return (
    <div style={{ padding: '20px' }}>
      <h2>Sales Ledger {isAdmin && targetUserId && userIdForData === targetUserId ? `(Viewing User: ${targetUserId.substring(0, 8)}...)` : ''}</h2>

      <CurrentBalance balance={currentSalesLedgerBalance} />
      <AvailabilityDisplay
        grossAvailability={grossAvailability}
        netAvailability={netAvailability}
        currentSalesLedgerBalance={currentSalesLedgerBalance}
        totalUnapprovedInvoiceValue={accountStatus?.totalUnapprovedInvoiceValue ?? 0}
        currentAccountBalance={calculatedCurrentAccountBalance}
      />

      {isAdmin && userIdForData && (
        <ManageAccountStatus
          selectedOwnerSub={userIdForData}
          targetUserName={targetUserId ?? undefined}
          onStatusUpdated={refreshAllData} // <-- Pass refresh callback here
        />
      )}

      <PaymentRequestForm
        netAvailability={netAvailability}
        onSubmitRequest={handlePaymentRequest}
        isLoading={paymentRequestLoading}
        requestError={paymentRequestError}
        requestSuccess={paymentRequestSuccess}
      />

      <LedgerEntryForm
        onSubmit={handleAddLedgerEntry}
      />

      <div style={{ marginTop: '30px' }}>
        <h3>Sales Ledger Transaction History</h3>
        <LedgerHistory entries={entries} historyType="sales" isLoading={loadingEntries} />
      </div>
      <div style={{ marginTop: '30px' }}>
        <h3>Current Account Transaction History</h3>
        <LedgerHistory entries={currentAccountTransactions as any} historyType="account" isLoading={loadingTransactions} />
      </div>
    </div>
  );
}

export default SalesLedger;
