import React from 'react';
import { Text, Loader, View, Table, TableHead, TableRow, TableCell, TableBody, Badge } from '@aws-amplify/ui-react';

// Corrected imports from the single generated API file
import type { LedgerEntry, CurrentAccountTransaction } from './graphql/API'; 

// Define a common shape or use a union type more explicitly if fields differ significantly
type HistoryEntry = Pick<LedgerEntry | CurrentAccountTransaction, 
    'id' | 'createdAt' | 'type' | 'description' | 'amount'
>;

interface LedgerHistoryProps {
  entries: HistoryEntry[]; 
  historyType: 'sales' | 'account'; 
  isLoading: boolean;
}

function LedgerHistory({ entries, isLoading }: LedgerHistoryProps) {
  if (isLoading) {
    return <Loader />;
  }

  if (!entries || entries.length === 0) {
    return <Text>No transactions to display.</Text>;
  }

  // Helper function for formatting amounts
  const formatAmount = (amount: number): string => {
    return isNaN(amount) ? '£0.00' : `£${amount.toFixed(2)}`;
  };

  // Helper function for date formatting
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  return (
    <View style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid #ddd' }}>
      <Table highlightOnHover={true} size="small">
        <TableHead>
          <TableRow>
            <TableCell as="th">Date</TableCell>
            <TableCell as="th">Type</TableCell>
            <TableCell as="th">Description</TableCell>
            <TableCell as="th" textAlign="right">Amount (£)</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {entries.map((entry) => (
            <TableRow key={entry.id}>
              <TableCell>{formatDate(entry.createdAt)}</TableCell>
              <TableCell>
                <Badge 
                    variation={
                        entry.type.includes('INVOICE') || entry.type.includes('INCREASE') || entry.type.includes('PAYMENT_REQUEST') ? 'info' :
                        entry.type.includes('CREDIT') || entry.type.includes('DECREASE') ? 'warning' :
                        entry.type.includes('CASH_RECEIPT') ? 'success' : undefined
                    }
                >
                    {entry.type.replace('_', ' ')}
                </Badge>
              </TableCell>
              <TableCell>{entry.description || '-'}</TableCell>
              <TableCell textAlign="right">{formatAmount(entry.amount || 0)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </View>
  );
}

export default LedgerHistory;
