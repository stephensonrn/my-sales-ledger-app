import React from 'react';
import { Heading, Text, Card } from '@aws-amplify/ui-react';

interface CurrentBalanceProps {
  balance: number;
  title?: string;
}

function CurrentBalance({ balance, title = "Current Sales Ledger Balance" }: CurrentBalanceProps) {
  // Ensure balance is a valid number before calling toFixed
  const safeBalance = isNaN(balance) ? 0 : balance; // Default to 0 if balance is not a valid number

  return (
    <Card variation="elevated" padding="medium" marginBottom="medium">
      <Heading level={4} color="font.secondary">{title}</Heading>
      <Text fontSize="xxl" fontWeight="bold" color={safeBalance >= 0 ? 'green.80' : 'red.80'}>
        £{safeBalance.toFixed(2)}
      </Text>
    </Card>
  );
}

export default CurrentBalance;
