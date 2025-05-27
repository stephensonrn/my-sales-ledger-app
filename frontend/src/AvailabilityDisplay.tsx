// src/AvailabilityDisplay.tsx
import React from 'react';
import { Flex, Text, Card, Heading, Grid } from '@aws-amplify/ui-react';

interface AvailabilityDisplayProps {
  grossAvailability: number;
  netAvailability: number;
  currentSalesLedgerBalance: number;
  totalUnapprovedInvoiceValue: number;
  currentAccountBalance: number;
}

function AvailabilityDisplay({
  grossAvailability,
  netAvailability,
  currentSalesLedgerBalance,
  totalUnapprovedInvoiceValue,
  currentAccountBalance,
}: AvailabilityDisplayProps) {
  return (
    <Card variation="outlined" padding="medium" marginBottom="medium">
      <Heading level={5} marginBottom="small">Availability Overview</Heading>
      <Grid templateColumns={{ base: "1fr", medium: "1fr 1fr"}} gap="small">
        <Flex direction="column">
          <Text fontWeight="bold">Sales Ledger Balance:</Text>
          <Text>£{currentSalesLedgerBalance.toFixed(2)}</Text>
        </Flex>
        <Flex direction="column">
          <Text fontWeight="bold">Less Unapproved Invoices:</Text>
          <Text>£{totalUnapprovedInvoiceValue.toFixed(2)}</Text>
        </Flex>
        <Flex direction="column">
          <Text fontWeight="bold">Gross Availability (90%):</Text>
          <Text color="font.info">£{grossAvailability.toFixed(2)}</Text>
        </Flex>
        <Flex direction="column">
          <Text fontWeight="bold">Less Current Account Balance:</Text>
          <Text>£{currentAccountBalance.toFixed(2)}</Text>
        </Flex>
        <Flex direction="column" style={{ gridColumn: "span 2" }}>
          <Text fontWeight="bold" fontSize="large">Net Availability:</Text>
          <Text fontSize="large" color="font.success" fontWeight="bold">
            £{netAvailability.toFixed(2)}
          </Text>
        </Flex>
      </Grid>
    </Card>
  );
}
export default AvailabilityDisplay;