import React from 'react';
import { Flex, Text, Card, Heading, Grid, View } from '@aws-amplify/ui-react';

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
  // Helper function to handle undefined or null values safely
  const formatAmount = (amount: number | undefined | null): string => {
    if (amount === undefined || amount === null) {
      return '£0.00'; // Return a default value if the amount is invalid
    }
    return `£${amount.toFixed(2)}`;
  };

  return (
    <Card variation="outlined" padding="medium" marginBottom="medium">
      <Heading level={4} marginBottom="medium">Availability Overview</Heading>
      <Grid templateColumns={{ base: "1fr", medium: "repeat(2, 1fr)"}} gap="small">
        <View>
          <Text fontWeight="bold">Sales Ledger Balance:</Text>
          <Text>{formatAmount(currentSalesLedgerBalance)}</Text>
        </View>
        <View>
          <Text fontWeight="bold">- Unapproved Invoices:</Text>
          <Text>{formatAmount(totalUnapprovedInvoiceValue)}</Text>
        </View>
        <View>
          <Text fontWeight="bold">Gross Availability (90%):</Text>
          <Text color="blue.60">{formatAmount(grossAvailability)}</Text>
        </View>
        <View>
          <Text fontWeight="bold">- Current Account Balance:</Text>
          <Text>{formatAmount(currentAccountBalance)}</Text>
        </View>
      </Grid>
      <Flex direction="column" marginTop="medium" alignItems="center">
        <Text fontWeight="bold" fontSize="large">Net Availability:</Text>
        <Text fontSize="xl" color="green.80" fontWeight="extrabold">
          {formatAmount(netAvailability)}
        </Text>
      </Flex>
    </Card>
  );
}

export default AvailabilityDisplay;
