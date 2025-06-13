// src/CurrentBalance.tsx
import React from 'react';
import { Heading, Text, Card } from '@aws-amplify/ui-react';

interface CurrentBalanceProps {
  balance: number;
  title?: string;
}

function CurrentBalance({ balance, title = "Current Sales Ledger Balance" }: CurrentBalanceProps) {
  // Use fallback value (0) if balance is undefined or null
  const safeBalance = balance ?? 0; // Ensure balance is a valid number

  return (
    <Card variation="elevated" padding="medium" marginBottom="medium">
      <Heading level={4} color="font.secondary">{title}</Heading>
      <Text fontSize="xxl" fontWeight="bold" color={safeBalance >= 0 ? 'green.80' : 'red.80'}>
        £{safeBalance.toFixed(2)} {/* Format as currency with 2 decimal places */}
      </Text>
    </Card>
  );
}

export default CurrentBalance;
