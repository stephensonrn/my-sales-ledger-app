// src/CurrentBalance.tsx
import React from 'react';
import { Heading, Text, Card } from '@aws-amplify/ui-react';

interface CurrentBalanceProps {
  balance: number | null | undefined;
  title?: string;
}

// Currency formatter for GBP
const formatter = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  minimumFractionDigits: 2,
});

function CurrentBalance({ balance, title = "Current Sales Ledger Balance" }: CurrentBalanceProps) {
  // Ensure balance is a valid number
  const safeBalance = typeof balance === 'number' && !isNaN(balance) ? balance : 0;

  return (
    <Card variation="elevated" padding="medium" marginBottom="medium">
      <Heading level={4} color="font.secondary">{title}</Heading>
      <Text fontSize="xxl" fontWeight="bold" color={safeBalance >= 0 ? 'green.80' : 'red.80'}>
        {formatter.format(safeBalance)}
      </Text>
    </Card>
  );
}

export default CurrentBalance;
