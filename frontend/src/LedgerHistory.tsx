// src/LedgerHistory.tsx
import React from 'react';
// Import the Schema type to understand the entry structures
import type { Schema } from '../amplify/data/resource'; // Adjust path if needed

// Define a combined type for the entries prop
type TransactionEntry = Schema['LedgerEntry'] | Schema['CurrentAccountTransaction'];

// Define the expected props
interface LedgerHistoryProps {
  entries: TransactionEntry[];
  isLoading: boolean;
  historyType: 'sales' | 'account'; // Added prop to distinguish context
}

// Helper function to format numbers as GBP currency
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value);
};

// Helper function to determine the display text and sign styling
const formatTransactionAmount = (
    entry: TransactionEntry,
    historyType: 'sales' | 'account'
): { text: string; isNegative: boolean } => {

  let displayAmount = entry.amount; // Amount stored is always positive
  let isNegative = false;
  let sign = '+'; // Default sign

  if (historyType === 'sales') {
    // Sales Ledger: Credit Notes and Decrease Adjustments are negative impacts
    switch (entry.type) {
      case 'CREDIT_NOTE':
      case 'DECREASE_ADJUSTMENT':
	  case 'CASH_RECEIPT':
        isNegative = true;
        sign = '-';
        break;
      // INVOICE and INCREASE_ADJUSTMENT use the default positive sign
      default:
        isNegative = false;
        sign = '+';
        break;
    }
  } else if (historyType === 'account') {
    // Current Account: Cash Receipts are negative impacts (reduce balance owed)
    switch (entry.type) {
      case 'CASH_RECEIPT':
        isNegative = true;
        sign = '-';
        break;
      case 'PAYMENT_REQUEST': // Payment Requests are positive impacts (increase balance owed)
        isNegative = false;
        sign = '+';
        break;
      // Default case if unexpected type somehow appears
      default:
        isNegative = false;
        sign = '?'; // Indicate unknown direction
        break;
    }
  }

  // Format the absolute amount and prepend the sign
  // Removing currency symbol from formatCurrency as we add it manually below
  const formattedValue = formatCurrency(Math.abs(displayAmount)).replace(/£/g, '');

  return {
      text: `${sign} ${formattedValue}`,
      isNegative: isNegative,
  };
};

// The LedgerHistory component
function LedgerHistory({ entries, isLoading, historyType }: LedgerHistoryProps) {
  if (isLoading) {
    return <p>Loading transaction history...</p>;
  }

  if (!entries || entries.length === 0) {
    return <p>No transactions recorded yet.</p>;
  }

  return (
    <div style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid #eee', marginTop: '10px' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9em' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid black', textAlign: 'left', position: 'sticky', top: 0, background: 'white' }}>
            <th style={{ padding: '8px' }}>Date</th>
            <th style={{ padding: '8px' }}>Type</th>
            <th style={{ padding: '8px' }}>Description</th>
            <th style={{ padding: '8px', textAlign: 'right' }}>Amount (£)</th>
          </tr>
        </thead>
        <tbody>
          {/* Map over entries, applying formatting */}
          {entries.map((entry) => {
              // Get the formatted amount string and negativity flag
              const { text: formattedAmountText, isNegative } = formatTransactionAmount(entry, historyType);
              // Style negative amounts in red, positive in green (optional)
              const amountStyle = { color: isNegative ? 'red' : 'green', textAlign: 'right' as const, padding: '8px' };
              // Format the date nicely
              const formattedDate = entry.createdAt
                  ? new Date(entry.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                  : 'N/A';

              return (
                <tr key={entry.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '8px' }}>{formattedDate}</td>
                  <td style={{ padding: '8px' }}>{entry.type}</td>
                  <td style={{ padding: '8px' }}>{entry.description ?? ''}</td>
                  <td style={amountStyle}>
                    {formattedAmountText}
                  </td>
                </tr>
              );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default LedgerHistory;