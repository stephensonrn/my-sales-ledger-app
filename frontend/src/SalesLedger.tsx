// src/SalesLedger.tsx
// Refactored Version using @aws-amplify/api-graphql client

import React, { useState, useEffect } from 'react'; // Removed useCallback as it wasn't used

// --- Step 1: Update Imports ---
import { generateClient } from 'aws-amplify/api';
import type { ObservableSubscription } from '@aws-amplify/api-graphql';
import { getCurrentUser } from 'aws-amplify/auth'; // Import Auth to get user info if needed for filtering

// Import generated operations & types (Adjust paths/names if your codegen output differs)
import {
  listLedgerEntries,
  listAccountStatuses,
  listCurrentAccountTransactions,
  // getAccountStatus // Example if you have a query to get by ID
} from './graphql/queries';
import {
  createLedgerEntry as createLedgerEntryMutation,
  sendPaymentRequestEmail // Assuming this was generated from your schema/mutationDoc
} from './graphql/mutations';
import {
  onCreateLedgerEntry as onCreateLedgerEntrySubscription
} from './graphql/subscriptions';

// Import main types from generated API.ts (adjust path if needed)
import type {
  LedgerEntry,
  AccountStatus,
  CurrentAccountTransaction,
  CreateLedgerEntryInput,
  LedgerEntryType, // Import Enum type if needed for casting
  OnCreateLedgerEntrySubscription,
  // ListLedgerEntriesQuery, // Optional: For typing query results if complex
} from './graphql/API'; // Adjust path if needed

// Import sub-components (assuming these remain the same)
import CurrentBalance from './CurrentBalance';
import LedgerEntryForm from './LedgerEntryForm';
import LedgerHistory from './LedgerHistory';
import AvailabilityDisplay from './AvailabilityDisplay';
import PaymentRequestForm from './PaymentRequestForm';

// --- Step 2: Update Client Initialization ---
const client = generateClient(); // No <Schema> generic

// Define constants used in calculations
const ADVANCE_RATE = 0.90; // 90%

// Main component definition
function SalesLedger() {
  // State: Sales Ledger Entries
  const [entries, setEntries] = useState<LedgerEntry[]>([]); // Use generated type
  const [currentSalesLedgerBalance, setCurrentSalesLedgerBalance] = useState(0);
  const [loadingEntries, setLoadingEntries] = useState(true); // For initial fetch

  // State: Account Status
  const [accountStatus, setAccountStatus] = useState<AccountStatus | null>(null); // Use generated type
  const [loadingStatus, setLoadingStatus] = useState(true); // For initial fetch

  // State: Current Account Transactions & Calculated Balance
  const [currentAccountTransactions, setCurrentAccountTransactions] = useState<CurrentAccountTransaction[]>([]); // Use generated type
  const [loadingTransactions, setLoadingTransactions] = useState(true); // For initial fetch
  const [calculatedCurrentAccountBalance, setCalculatedCurrentAccountBalance] = useState(0);

  // State: Calculated Availability figures (remains the same)
  const [grossAvailability, setGrossAvailability] = useState(0);
  const [netAvailability, setNetAvailability] = useState(0);
  const [grossAvailTemp, setGrossAvailTemp] = useState(0);
  const [netAvailTemp, setNetAvailTemp] = useState(0);

  // State: Payment Request Process (remains the same)
  const [paymentRequestLoading, setPaymentRequestLoading] = useState(false);
  const [paymentRequestError, setPaymentRequestError] = useState<string | null>(null);
  const [paymentRequestSuccess, setPaymentRequestSuccess] = useState<string | null>(null);

  // State: General Errors
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null); // Store user ID if needed for filtering

  // Get User ID on mount (optional, but often needed for filtering)
  useEffect(() => {
    const fetchUserId = async () => {
      try {
        const currentUser = await getCurrentUser(); // Call the imported function directly
        setUserId(currentUser.userId); // Or currentUser.attributes.sub depending on setup
      } catch (err) {
        console.error("Error fetching user ID:", err);
        // Handle case where user might not be logged in when component mounts
      }
    };
    fetchUserId();
  }, []);

  // --- Step 3: Refactor Initial Data Fetches ---

// Fetch Initial Ledger Entries
useEffect(() => {
  const fetchInitialEntries = async () => {
    // Optional: If filtering by userId, ensure it's available first
    // if (!userId) {
    //   console.log("Skipping initial fetch, userId not available yet.");
    //   setLoadingEntries(false);
    //   return;
    // }
    setLoadingEntries(true);
    setError(null);
    console.log("FETCH_INIT: Attempting to fetch initial ledger entries...");
    try {
      // Make sure listLedgerEntries is the correct imported query name
      const response = await client.graphql({
        query: listLedgerEntries,
        authMode: 'userPool'
        // If you need to filter by owner here (and your resolver supports it):
        // variables: { filter: { owner: { eq: userId } } }
      });

      // Log the entire raw response from AppSync
      console.log("FETCH_INIT: Raw listLedgerEntries response:", JSON.stringify(response, null, 2));

      // Process the response
      const items = response.data?.listLedgerEntries?.items || [];
      const validItems = items.filter(item => item !== null) as LedgerEntry[]; // Filter out nulls and cast
      const sortedItems = [...validItems]
                       .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      // Update state
      setEntries(sortedItems);
      console.log(`Workspace_INIT: Fetched and set ${sortedItems.length} initial ledger entries.`);

    } catch (err: any) {
      // Log any errors during the fetch
      console.error("FETCH_INIT: Error fetching initial ledger entries:", err);
      const errors = err.errors || [err];
      const message = errors[0]?.message || 'Unknown error';
      setError(`Initial Ledger history error: ${message}`);
      setEntries([]); // Clear entries on error
    } finally {
      setLoadingEntries(false);
    }
  };

  fetchInitialEntries();
  // Dependency array: If you filter by userId, include it here.
  // If you want ALL entries for the logged-in user based on context identity in the resolver,
  // use an empty array [] so it only runs once on mount.
}, [userId]); // Adjust dependency array based on your filtering logic

  // Fetch Initial Account Status
  useEffect(() => {
    const fetchInitialStatus = async () => {
      // If accountStatus ID is the same as user ID:
      if (!userId) return; // Need user ID to fetch specific status
      setLoadingStatus(true);
      setError(null);
      console.log("Fetching initial AccountStatus...");
      try {
         // Option 1: Use list and filter client-side (or use filter variable if available)
         const response = await client.graphql({
             query: listAccountStatuses, // Use imported query
             variables: { filter: { owner: { eq: userId } } }, // Example filter
             authMode: 'userPool'
         });
         const items = response.data?.listAccountStatuses?.items || [];
         const userStatus = items.find(item => item?.owner === userId); // Ensure we get the right one

         // Option 2: If you have a getAccountStatus query by ID (assuming ID === userId)
         /*
         const response = await client.graphql({
            query: getAccountStatus,
            variables: { id: userId },
            authMode: 'userPool'
         });
         const userStatus = response.data?.getAccountStatus;
         */

        setAccountStatus(userStatus ? userStatus as AccountStatus : null);
        console.log("Fetched initial AccountStatus:", userStatus);

      } catch (err: any) {
        console.error("Error fetching initial AccountStatus:", err);
        setError(`Initial Account status error: ${err.message || JSON.stringify(err)}`);
        setAccountStatus(null);
      } finally {
        setLoadingStatus(false);
      }
    };
     if (userId) { // Only fetch if userId is available
        fetchInitialStatus();
     } else {
        // Handle case where user ID isn't loaded yet, maybe keep loading
        setLoadingStatus(false); // Or manage differently
        setAccountStatus(null);
     }
  }, [userId]); // Depend on userId

  // Fetch Initial Current Account Transactions
  useEffect(() => {
    const fetchInitialTransactions = async () => {
      // Optional: Only fetch if user ID is known, if filtering by owner
      // if (!userId) return;
      setLoadingTransactions(true);
      setError(null);
      console.log("Fetching initial CurrentAccountTransactions...");
      try {
        const response = await client.graphql({
          query: listCurrentAccountTransactions,
          authMode: 'userPool',
          // Example: Filter initial fetch by owner
          // variables: { filter: { owner: { eq: userId } } }
        });
        const items = response.data?.listCurrentAccountTransactions?.items || [];
        const sortedItems = [...items as CurrentAccountTransaction[]]
          .filter(item => item !== null)
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        setCurrentAccountTransactions(sortedItems);
        console.log("Fetched initial CurrentAccountTransactions:", sortedItems.length);
      } catch (err: any) {
        console.error("Error fetching initial CurrentAccountTransactions:", err);
        setError(`Initial Account transaction error: ${err.message || JSON.stringify(err)}`);
      } finally {
        setLoadingTransactions(false);
      }
    };
    // Consider dependency on userId if filtering by it
    fetchInitialTransactions();
  }, [userId]); // Add userId dependency if filtering by it


 // --- Step 4: Refactor Real-time Subscription (LedgerEntry only) ---
  useEffect(() => {
    // Don't run subscription setup until user ID is known if filtering by owner
    // if (!userId) return;

    setError(null);
    console.log("Setting up LedgerEntry subscription.");

    let sub: ZenObservable.Subscription | null = null; // Define sub variable

    try {
        sub = client.graphql<ObservableSubscription<OnCreateLedgerEntrySubscription>>({
        query: onCreateLedgerEntrySubscription,
        authMode: 'userPool'
        // If filtering subscription by owner:
        // variables: { owner: userId }
      }).subscribe({
        next: ({ data }) => {
          const newEntry = data?.onCreateLedgerEntry;
          console.log('Subscription received new LedgerEntry:', newEntry);
          if (newEntry) {
            setEntries(prevEntries => {
              if (prevEntries.some(entry => entry.id === newEntry.id)) {
                return prevEntries; // Avoid duplicates
              }
              return [...prevEntries, newEntry as LedgerEntry]
                .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
            });
          }
        },
        error: (err: any) => { console.error("LedgerEntry subscription error:", err); setError(`Ledger subscription error: ${err.message || JSON.stringify(err)}`); }
      });
      console.log("LedgerEntry subscription established.");
    } catch (err: any) {
        console.error("Failed to establish LedgerEntry subscription", err);
        setError(`Ledger subscription setup error: ${err.message || JSON.stringify(err)}`);
    }

    // Cleanup function
    return () => {
      if (sub) {
         console.log("Cleaning up LedgerEntry subscription.");
         sub.unsubscribe();
      }
    }
  }, [userId]); // Add userId dependency if filtering subscription


  // --- Effect Hooks for Calculations (Should be OK, check dependencies) ---
  // These calculate based on the state variables which are now populated
  // by the initial fetches and the ledger entry subscription.

  // Calculate Sales Ledger Balance (Now includes CASH_RECEIPT)
useEffect(() => {
  let calculatedSLBalance = 0;
  entries.forEach(entry => {
    if (!entry) return;
    switch (entry.type) {
      case 'INVOICE':
      case 'INCREASE_ADJUSTMENT':
        calculatedSLBalance += entry.amount;
        break;
      case 'CREDIT_NOTE':
      case 'DECREASE_ADJUSTMENT':
      case 'CASH_RECEIPT': // <-- ADD CASH_RECEIPT HERE
        calculatedSLBalance -= entry.amount;
        break;
      default:
        break; // Ignore other types if any
    }
  });
  setCurrentSalesLedgerBalance(parseFloat(calculatedSLBalance.toFixed(2)));
}, [entries]);

  // Calculate Current Account Balance
  useEffect(() => {
    let calculatedAccBalance = 0;
    currentAccountTransactions.forEach(transaction => {
        // Add null check for transaction just in case
      if (!transaction) return;
      switch (transaction.type) {
        case 'PAYMENT_REQUEST': calculatedAccBalance += transaction.amount; break;
        case 'CASH_RECEIPT': calculatedAccBalance -= transaction.amount; break;
        default: break;
      }
    });
    setCalculatedCurrentAccountBalance(parseFloat(calculatedAccBalance.toFixed(2)));
    console.log("Calculated Current Account Balance:", calculatedAccBalance.toFixed(2));
  }, [currentAccountTransactions]);

  // Refactored Availability Calculation Effects (seem ok, depend on calculated states)
   useEffect(() => {
     const unapprovedValue = accountStatus?.totalUnapprovedInvoiceValue ?? 0;
     const currentAccountBalance = calculatedCurrentAccountBalance;
     const grossAvail = (currentSalesLedgerBalance - unapprovedValue) * ADVANCE_RATE;
     const netAvail = grossAvail - currentAccountBalance;
     setGrossAvailTemp(grossAvail);
     setNetAvailTemp(netAvail);
     console.log("Intermediate availability calculated");
   }, [currentSalesLedgerBalance, accountStatus, calculatedCurrentAccountBalance]);

   useEffect(() => {
     console.log("Setting Gross Availability based on temp value:", grossAvailTemp);
     setGrossAvailability(Math.max(0, parseFloat(grossAvailTemp.toFixed(2))));
   }, [grossAvailTemp]);

   useEffect(() => {
     console.log("Setting Net Availability based on temp value:", netAvailTemp);
     setNetAvailability(Math.max(0, parseFloat(netAvailTemp.toFixed(2))));
   }, [netAvailTemp]);


  // --- Step 5: Refactor Handler Functions (Mutations) ---

  // Add Ledger Entry
const handleAddLedgerEntry = async (entryData: { type: string, amount: number, description?: string }) => {
  setError(null);
  try {
    const input: CreateLedgerEntryInput = {
      type: entryData.type as LedgerEntryType, // Cast needed if form type isn't enum
      amount: entryData.amount,
      description: entryData.description || null
    };
    console.log("Attempting to create LedgerEntry with input:", input); // Log input

    const result = await client.graphql({
      query: createLedgerEntryMutation,
      variables: { input: input },
      authMode: 'userPool'
    });

    console.log("GraphQL Mutation Result:", JSON.stringify(result, null, 2)); // Log the full result

    // Explicitly check for errors in the response object
    if (result.errors) {
      console.error("GraphQL errors returned from createLedgerEntry mutation:", result.errors);
      // Throw the first error to be caught below, or handle differently
      throw result.errors[0];
    }

    // Check if data or the specific field is null/undefined even without errors
    if (!result.data?.createLedgerEntry) {
      console.warn("createLedgerEntry mutation returned null or undefined data, even without GraphQL errors.");
      // Maybe the resolver logic completed but didn't return the item?
      setError("Failed to save transaction: Server did not return the created item.");
    } else {
       console.log("Ledger entry creation successful (data):", result.data.createLedgerEntry);
    }

  } catch (err: any) {
    // This will catch network errors and errors thrown from the 'if (result.errors)' block
    const errors = err.errors || (Array.isArray(err) ? err : [err]);
    const message = errors[0]?.message || 'Unknown error processing request';
    setError(`Failed to save transaction: ${message}`);
    console.error("Error caught saving ledger entry:", errors);
  }
};

  // Payment Request
  const handlePaymentRequest = async (amount: number) => {
    setPaymentRequestLoading(true); setPaymentRequestError(null); setPaymentRequestSuccess(null);
    // Ensure 'sendPaymentRequestEmail' matches the generated mutation name
    // The variables also need to match the mutation definition in schema.graphql
    // Your schema had: sendPaymentRequestEmail(amount: Float!): String
    const variables = { amount: amount }; // Direct argument, not nested in 'input'
    console.log('Calling sendPaymentRequestEmail mutation via client.graphql with variables:', variables);

    try {
        // Use the imported mutation if available and correctly generated
        const result = await client.graphql({
            query: sendPaymentRequestEmail, // Use imported mutation document
            variables: variables,
            authMode: 'userPool'
        });
        // Assuming the mutation 'sendPaymentRequestEmail' directly returns the string message
        const responseMessage = result.data?.sendPaymentRequestEmail;
        const errors = result.errors; // Check for GraphQL level errors

        if (errors) throw errors[0]; // Throw the first GraphQL error if present

        setPaymentRequestSuccess(responseMessage ?? 'Request submitted successfully!');

    } catch (err: any) {
        console.error("Error object submitting payment request:", err);
        // Handle both network errors and GraphQL errors
        let displayError = 'Unknown error during payment request.';
        if (Array.isArray(err?.errors) && err.errors.length > 0 && err.errors[0].message) {
            // Handle GraphQL error array
            displayError = err.errors[0].message;
        } else if (err?.message) {
             // Handle generic error or first GraphQL error if not array
            displayError = err.message;
        }
        setPaymentRequestError(`Failed to submit request: ${displayError}`);
        setPaymentRequestSuccess(null);
    } finally {
        setPaymentRequestLoading(false);
    }
  };

  // --- Step 6: Update Loading State Check ---
  if (loadingEntries || loadingStatus || loadingTransactions) {
    return <p>Loading application data...</p>;
  }


  // --- Main Render Output (JSX remains the same) ---
  return (
    <div style={{ padding: '20px' }}>
      <h2>Sales Ledger</h2>
      {error && <p style={{ color: 'red', border: '1px solid red', padding: '10px' }}>Error: {error}</p>}

      {/* Display Balances and Availability */}
      <CurrentBalance balance={currentSalesLedgerBalance} />
      <AvailabilityDisplay
        grossAvailability={grossAvailability}
        netAvailability={netAvailability}
        currentSalesLedgerBalance={currentSalesLedgerBalance}
        totalUnapprovedInvoiceValue={accountStatus?.totalUnapprovedInvoiceValue ?? 0}
        currentAccountBalance={calculatedCurrentAccountBalance}
      />

      {/* Display Payment Request Form */}
      <PaymentRequestForm
        netAvailability={netAvailability}
        onSubmitRequest={handlePaymentRequest}
        isLoading={paymentRequestLoading}
        requestError={paymentRequestError}
        requestSuccess={paymentRequestSuccess}
      />

      {/* Ledger Entry Form (for Sales Ledger items) */}
      <LedgerEntryForm onSubmit={handleAddLedgerEntry} />

      {/* Sales Ledger History Section */}
<div style={{marginTop: '30px'}}>
  <h3>Sales Ledger Transaction History</h3>
  {/* Pass the *full* entries list now */}
  <LedgerHistory entries={entries} historyType="sales" isLoading={loadingEntries} /> {/* <-- Change salesLedgerEntries to entries */}
</div>

      {/* Current Account History Section */}
      <div style={{ marginTop: '30px' }}>
        <h3>Current Account Transaction History</h3>
        <LedgerHistory entries={currentAccountTransactions} historyType="account" isLoading={loadingTransactions} />
      </div>

    </div>
  );

}

export default SalesLedger;