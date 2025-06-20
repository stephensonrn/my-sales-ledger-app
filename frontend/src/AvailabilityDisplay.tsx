// src/AvailabilityDisplay.tsx
import React from 'react';
import { Flex, Text, Card, Heading, View, Divider } from '@aws-amplify/ui-react';

interface AvailabilityDisplayProps {
  grossAvailability: number;
  netAvailability: number;
  currentSalesLedgerBalance: number;
  totalUnapprovedInvoiceValue: number;
  currentAccountBalance: number;
}

const formatCurrency = (value: number | null | undefined) =>
  typeof value === 'number' && !isNaN(value)
    ? value.toFixed(2)
    : '0.00';

// A small component to create a consistent row for the calculation
const CalculationRow = ({ label, value, isSubtracted = false, isBold = false, color }: { label: string, value: number, isSubtracted?: boolean, isBold?: boolean, color?: string }) => (
    <Flex justifyContent="space-between" width="100%" maxWidth="300px">
        <Text fontWeight={isBold ? 'bold' : 'normal'}>
            {isSubtracted ? `less ${label}:` : `${label}:`}
        </Text>
        <Text fontWeight={isBold ? 'bold' : 'normal'} color={color}>
            £{formatCurrency(value)}
        </Text>
    </Flex>
);

function AvailabilityDisplay({
  grossAvailability,
  netAvailability,
  currentSalesLedgerBalance,
  totalUnapprovedInvoiceValue,
  currentAccountBalance,
}: AvailabilityDisplayProps) {
  
  // This calculates the approved balance for display purposes
  const approvedSalesLedger = currentSalesLedgerBalance - totalUnapprovedInvoiceValue;

  return (
    <Card variation="outlined" padding="medium" marginBottom="medium">
      {/* 1. Renamed Heading */}
      <Heading level={4} marginBottom="medium" textAlign="center">
        Availability Calculation
      </Heading>
      
      {/* 2. Replaced Grid with a centered Flex column */}
      <Flex direction="column" alignItems="center" gap="xs">
        
        {/* 3. Display figures in the correct order with updated labels */}
        <CalculationRow label="Sales Ledger Balance" value={currentSalesLedgerBalance} />
        <CalculationRow label="Unapproved Invoices" value={totalUnapprovedInvoiceValue} isSubtracted={true} />
        
        {/* Divider to show the sub-total */}
        <Divider size="small" width="300px" />
        <CalculationRow label="Approved Sales Ledger" value={approvedSalesLedger} isBold={true} />
        <Divider size="small" width="300px" />

        <CalculationRow label="Gross Availability (90%)" value={grossAvailability} />
        <CalculationRow label="Current Account Balance" value={currentAccountBalance} isSubtracted={true} />
        
        {/* Divider for the final calculation */}
        <Divider size="large" width="300px" marginTop="small" marginBottom="small"/>
        
        {/* Final Net Availability */}
        <Flex justifyContent="space-between" width="100%" maxWidth="300px">
            <Text fontWeight="bold" fontSize="large">Net Availability</Text>
            <Text fontSize="large" color="green.80" fontWeight="extrabold">
                £{formatCurrency(netAvailability)}
            </Text>
        </Flex>

      </Flex>
    </Card>
  );
}

export default AvailabilityDisplay;
