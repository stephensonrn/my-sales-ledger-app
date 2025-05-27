// src/CurrentBalance.tsx
import React from 'react';
import { Heading, Text, Card } from '@aws-amplify/ui-react';

interface CurrentBalanceProps {
  balance: number;
  title?: string;
}

function CurrentBalance({ balance, title = "Current Sales Ledger Balance" }: CurrentBalanceProps) {
  return (
    <Card variation="outlined" padding="medium" marginBottom="medium">
      <Heading level={5}>{title}</Heading>
      <Text fontSize="xl" fontWeight="bold" color={balance >= 0 ? 'font.success' : 'font.error'}>
        £{balance.toFixed(2)}
      </Text>
    </Card>
  );
}
export default CurrentBalance;