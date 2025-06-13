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
  return (
    <Card variation="outlined" padding="medium" marginBottom="medium">
      <Heading level={4} marginBottom="medium">Availability Overview</Heading>
      <Grid templateColumns={{ base: "1fr", medium: "repeat(2, 1fr)"}} gap="small">
        <View>
          <Text fontWeight="bold">Sales Ledger Balance:</Text>
          <Text>£{currentSalesLedgerBalance.toFixed(2)}</Text>
        </View>
        <View>
          <Text fontWeight="bold">- Unapproved Invoices:</Text>
          <Text>£{totalUnapprovedInvoiceValue.toFixed(2)}</Text>
        </View>
        <View>
          <Text fontWeight="bold">Gross Availability (90%):</Text>
          <Text color="blue.60">£{grossAvailability.toFixed(2)}</Text>
        </View>
        <View>
          <Text fontWeight="bold">- Current Account Balance:</Text>
          <Text>£{currentAccountBalance.toFixed(2)}</Text>
        </View>
      </Grid>
      <Flex direction="column" marginTop="medium" alignItems="center">
          <Text fontWeight="bold" fontSize="large">Net Availability:</Text>
          <Text fontSize="xl" color="green.80" fontWeight="extrabold">
            £{netAvailability.toFixed(2)}
          </Text>
        </Flex>
    </Card>
  );
}
export default AvailabilityDisplay;
