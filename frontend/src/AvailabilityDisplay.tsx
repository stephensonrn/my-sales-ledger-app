// src/AvailabilityDisplay.tsx
import React from 'react';
import { Flex, Text, Card, Heading, Grid, View } from '@aws-amplify/ui-react';

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

function AvailabilityDisplay({
  grossAvailability,
  netAvailability,
  currentSalesLedgerBalance,
  totalUnapprovedInvoiceValue,
  currentAccountBalance,
}: AvailabilityDisplayProps) {
  return (
    <Card variation="outlined" padding="medium" marginBottom="medium">
      <Heading level={4} marginBottom="medium">Availability Overview</Heading>
      <Grid templateColumns={{ base: "1fr", medium: "repeat(2, 1fr)"}} gap="small">
        <View>
          <Text fontWeight="bold">Sales Ledger Balance:</Text>
          <Text>£{formatCurrency(currentSalesLedgerBalance)}</Text>
        </View>
        <View>
          <Text fontWeight="bold">- Unapproved Invoices:</Text>
          <Text>£{formatCurrency(totalUnapprovedInvoiceValue)}</Text>
        </View>
        <View>
          <Text fontWeight="bold">Gross Availability (90%):</Text>
          <Text color="blue.60">£{formatCurrency(grossAvailability)}</Text>
        </View>
        <View>
          <Text fontWeight="bold">- Current Account Balance:</Text>
          <Text>£{formatCurrency(currentAccountBalance)}</Text>
        </View>
      </Grid>
      <Flex direction="column" marginTop="medium" alignItems="center">
        <Text fontWeight="bold" fontSize="large">Net Availability:</Text>
        <Text fontSize="xl" color="green.80" fontWeight="extrabold">
          £{formatCurrency(netAvailability)}
        </Text>
      </Flex>
    </Card>
  );
}

export default AvailabilityDisplay;
