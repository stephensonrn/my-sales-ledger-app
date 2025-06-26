// FILE: src/MonthlyStatisticsTable.tsx (New File)
// ==========================================================

import React, { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/api';
import { View, Text, Loader, Alert, Table, TableHead, TableRow, TableCell, TableBody } from '@aws-amplify/ui-react';

// This is a placeholder for the real query we will create in the backend steps.
const getTwelveMonthStatistics = /* GraphQL */ `
  query GetTwelveMonthStatistics($userId: ID!) {
    getTwelveMonthStatistics(userId: $userId) {
      month
      totalInvoices
      totalCreditNotes
      totalIncreaseAdjustments
      totalDecreaseAdjustments
      totalPaymentRequests
      totalCashReceipts
      monthEndSalesLedgerBalance
      monthEndCurrentAccountBalance
      daysSalesOutstanding
    }
  }
`;

const client = generateClient();

interface MonthlyStatisticsTableProps {
  userId: string;
}

const formatCurrency = (value: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value);
const formatNumber = (value: number) => new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 }).format(value);

function MonthlyStatisticsTable({ userId }: MonthlyStatisticsTableProps) {
  const [stats, setStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      if (!userId) return;
      setLoading(true);
      setError(null);
      try {
        const response: any = await client.graphql({
          query: getTwelveMonthStatistics,
          variables: { userId },
        });
        
        const statistics = response.data?.getTwelveMonthStatistics || [];
        // The data comes in chronological order, we want to display it reverse-chronological
        setStats(statistics.reverse()); 

      } catch (err) {
        console.error("Error fetching monthly statistics:", err);
        setError("Could not load 12-month statistics. The backend may not be configured for this feature yet.");
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [userId]);

  if (loading) return <Loader>Loading monthly statistics...</Loader>;
  if (error) return <Alert variation="warning">{error}</Alert>;
  if (stats.length === 0) return <Text>No monthly statistics available for this user.</Text>;

  const tableStyle: React.CSSProperties = { width: '100%', tableLayout: 'fixed' };
  const thStyle: React.CSSProperties = { padding: '8px', textAlign: 'left', fontWeight: 'bold', borderBottom: '2px solid black' };
  const tdStyle: React.CSSProperties = { padding: '8px', textAlign: 'right', borderBottom: '1px solid #ddd' };

  return (
    <View style={{ overflowX: 'auto' }}>
        <Table highlightOnHover size="small" style={tableStyle}>
            <TableHead>
                <TableRow>
                    <TableCell as="th" style={{...thStyle, textAlign: 'left'}}>Metric</TableCell>
                    {stats.map(monthStat => (
                        <TableCell as="th" key={monthStat.month} style={{...thStyle, textAlign: 'right'}}>
                            {monthStat.month}
                        </TableCell>
                    ))}
                </TableRow>
            </TableHead>
            <TableBody>
                <TableRow>
                    <TableCell style={{...tdStyle, textAlign: 'left', fontWeight: 'bold'}}>Invoices</TableCell>
                    {stats.map(s => <TableCell key={s.month} style={tdStyle}>{formatCurrency(s.totalInvoices)}</TableCell>)}
                </TableRow>
                <TableRow>
                    <TableCell style={{...tdStyle, textAlign: 'left', fontWeight: 'bold'}}>Credit Notes</TableCell>
                    {stats.map(s => <TableCell key={s.month} style={tdStyle}>{formatCurrency(s.totalCreditNotes)}</TableCell>)}
                </TableRow>
                <TableRow>
                    <TableCell style={{...tdStyle, textAlign: 'left', fontWeight: 'bold'}}>Increase Adjustments</TableCell>
                    {stats.map(s => <TableCell key={s.month} style={tdStyle}>{formatCurrency(s.totalIncreaseAdjustments)}</TableCell>)}
                </TableRow>
                <TableRow>
                    <TableCell style={{...tdStyle, textAlign: 'left', fontWeight: 'bold'}}>Decrease Adjustments</TableCell>
                    {stats.map(s => <TableCell key={s.month} style={tdStyle}>{formatCurrency(s.totalDecreaseAdjustments)}</TableCell>)}
                </TableRow>
                <TableRow>
                    <TableCell style={{...tdStyle, textAlign: 'left', fontWeight: 'bold'}}>Payment Requests</TableCell>
                    {stats.map(s => <TableCell key={s.month} style={tdStyle}>{formatNumber(s.totalPaymentRequests)}</TableCell>)}
                </TableRow>
                <TableRow>
                    <TableCell style={{...tdStyle, textAlign: 'left', fontWeight: 'bold'}}>Cash Receipts</TableCell>
                    {stats.map(s => <TableCell key={s.month} style={tdStyle}>{formatCurrency(s.totalCashReceipts)}</TableCell>)}
                </TableRow>
                <TableRow>
                    <TableCell style={{...tdStyle, textAlign: 'left', fontWeight: 'bold', borderTop: '2px solid black'}}>Month End Sales Ledger</TableCell>
                    {stats.map(s => <TableCell key={s.month} style={{...tdStyle, fontWeight: 'bold', borderTop: '2px solid black'}}>{formatCurrency(s.monthEndSalesLedgerBalance)}</TableCell>)}
                </TableRow>
                <TableRow>
                    <TableCell style={{...tdStyle, textAlign: 'left', fontWeight: 'bold'}}>Month End Current Acct</TableCell>
                    {stats.map(s => <TableCell key={s.month} style={{...tdStyle, fontWeight: 'bold'}}>{formatCurrency(s.monthEndCurrentAccountBalance)}</TableCell>)}
                </TableRow>
                <TableRow>
                    <TableCell style={{...tdStyle, textAlign: 'left', fontWeight: 'bold'}}>DSO (Days)</TableCell>
                    {stats.map(s => <TableCell key={s.month} style={{...tdStyle, fontWeight: 'bold'}}>{formatNumber(s.daysSalesOutstanding)}</TableCell>)}
                </TableRow>
            </TableBody>
        </Table>
    </View>
  );
}

export default MonthlyStatisticsTable;