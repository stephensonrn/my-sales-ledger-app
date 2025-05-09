// src/CurrentBalance.jsx
import React from 'react';

interface CurrentBalanceProps {
  balance: number;
}

function CurrentBalance({ balance }: CurrentBalanceProps) {
  // Format balance for display (e.g., using browser's built-in Intl)
  const formattedBalance = new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP' // Adjust currency as needed
  }).format(balance);

  return (
    <div>
      <h3>Current Balance: {formattedBalance}</h3>
    </div>
  );
}
export default CurrentBalance;