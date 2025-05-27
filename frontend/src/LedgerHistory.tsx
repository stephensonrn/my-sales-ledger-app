// src/LedgerHistory.tsx
import React from 'react';
import { Text, Loader, View } from '@aws-amplify/ui-react';
import { LedgerEntry, CurrentAccountTransaction } from './graphql/API'; // Assuming types are here

interface LedgerHistoryProps {
  entries: (LedgerEntry | CurrentAccountTransaction)[]; // Array of transactions/entries
  historyType: 'sales' | 'account'; // To differentiate styling or columns if needed
  isLoading: boolean;
}

function LedgerHistory({ entries, isLoading }: LedgerHistoryProps) {
  const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', marginTop: '10px', fontSize: '0.9em' };
  const thTdStyle: React.CSSProperties = { border: '1px solid #ddd', padding: '8px', textAlign: 'left' };
  const thStyle: React.CSSProperties = { ...thTdStyle, backgroundColor: '#f4f4f4', fontWeight: 'bold' };

  if (isLoading) {
    return <Loader />;
  }

  if (entries.length === 0) {
    return <Text>No transactions to display.</Text>;
  }

  return (
    <View style={{ maxHeight: '400px', overflowY: 'auto' }}>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>Date</th>
            <th style={thStyle}>Type</th>
            <th style={thStyle}>Description</th>
            <th style={thStyle} align="right">Amount (£)</th>
            {/* <th style={thStyle}>ID</th> */}
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id}>
              <td style={thTdStyle}>{new Date(entry.createdAt).toLocaleDateString()}</td>
              <td style={thTdStyle}>{entry.type}</td>
              <td style={thTdStyle}>{entry.description || '-'}</td>
              <td style={{...thTdStyle, textAlign: 'right'}}>{(entry.amount || 0).toFixed(2)}</td>
              {/* <td style={thTdStyle}><code>{entry.id.substring(0,8)}</code></td> */}
            </tr>
          ))}
        </tbody>
      </table>
    </View>
  );
}
export default LedgerHistory;