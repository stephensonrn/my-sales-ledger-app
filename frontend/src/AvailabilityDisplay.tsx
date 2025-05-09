// src/AvailabilityDisplay.tsx
import React from 'react';

interface AvailabilityDisplayProps {
  grossAvailability: number;
  netAvailability: number;
  currentSalesLedgerBalance: number; // Pass this for context if needed
  totalUnapprovedInvoiceValue: number;
  currentAccountBalance: number;
}

// Helper to format currency
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value);
}

function AvailabilityDisplay({
  grossAvailability,
  netAvailability,
  currentSalesLedgerBalance,
  totalUnapprovedInvoiceValue,
  currentAccountBalance,
}: AvailabilityDisplayProps) {
  return (
    <div style={{ border: '1px solid #eee', padding: '15px', margin: '20px 0' }}>
      <h4>Availability Calculation</h4>
      <p>Current Sales Ledger: {formatCurrency(currentSalesLedgerBalance)}</p>
      <p>Less: Total Unapproved Value: {formatCurrency(totalUnapprovedInvoiceValue)}</p>
      <p>Approved Sales Ledger: {formatCurrency(currentSalesLedgerBalance - totalUnapprovedInvoiceValue)}</p>
      <p>Multiply by Advance Rate (90%):</p>
      <p><strong>Gross Availability: {formatCurrency(grossAvailability)}</strong></p>
      <p>Less: Current Account Balance: {formatCurrency(currentAccountBalance)}</p>
      <p><strong>Net Availability: {formatCurrency(netAvailability)}</strong></p>
    </div>
  );
}

export default AvailabilityDisplay;