// src/LedgerHistory.tsx
import React from 'react';
import {
  Text,
  Loader,
  View,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Badge
} from '@aws-amplify/ui-react';

type HistoryEntry = Pick<LedgerEntry | CurrentAccountTransaction,
  'id' | 'createdAt' | 'type' | 'description' | 'amount'
>;

interface LedgerHistoryProps {
  entries: HistoryEntry[];
  isLoading: boolean;
}

// GBP currency formatter
const currencyFormatter = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  minimumFractionDigits: 2,
});

function LedgerHistory({ entries, isLoading }: LedgerHistoryProps) {
  if (isLoading) {
    return <Loader />;
  }

  if (!entries || entries.length === 0) {
    return <Text>No transactions to display.</Text>;
  }

  return (
    <View style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid #ddd' }}>
      <Table highlightOnHover size="small">
        <TableHead>
          <TableRow>
            <TableCell as="th">Date</TableCell>
            <TableCell as="th">Type</TableCell>
            <TableCell as="th">Description</TableCell>
            <TableCell as="th" textAlign="right">Amount (£)</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {entries.map((entry) => {
            const amount = typeof entry.amount === 'number' && !isNaN(entry.amount) ? entry.amount : 0;
            const createdAt = entry.createdAt
              ? new Date(entry.createdAt).toLocaleDateString()
              : '—';

            let badgeVariation: 'info' | 'warning' | 'success' | undefined = undefined;
            if (entry.type?.includes('INVOICE') || entry.type?.includes('INCREASE') || entry.type?.includes('PAYMENT_REQUEST')) {
              badgeVariation = 'info';
            } else if (entry.type?.includes('CREDIT') || entry.type?.includes('DECREASE')) {
              badgeVariation = 'warning';
            } else if (entry.type?.includes('CASH_RECEIPT')) {
              badgeVariation = 'success';
            }

            return (
              <TableRow key={entry.id}>
                <TableCell>{createdAt}</TableCell>
                <TableCell>
                  <Badge variation={badgeVariation}>
                    {entry.type?.replace(/_/g, ' ') ?? 'Unknown'}
                  </Badge>
                </TableCell>
                <TableCell>{entry.description || '—'}</TableCell>
                <TableCell textAlign="right">{currencyFormatter.format(amount)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </View>
  );
}

export default LedgerHistory;
