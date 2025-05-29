// src/CurrentBalance.tsx
import React from 'react';
import { Heading, Text, Card } from '@aws-amplify/ui-react';

interface CurrentBalanceProps {
  balance: number;
  title?: string;
}

function CurrentBalance({ balance, title = "Current Sales Ledger Balance" }: CurrentBalanceProps) {
  return (
    <Card variation="elevated" padding="medium" marginBottom="medium">
      <Heading level={4} color="font.secondary">{title}</Heading>
      <Text fontSize="xxl" fontWeight="bold" color={balance >= 0 ? 'green.80' : 'red.80'}>
        £{balance.toFixed(2)}
      </Text>
    </Card>
  );
}
export default CurrentBalance;