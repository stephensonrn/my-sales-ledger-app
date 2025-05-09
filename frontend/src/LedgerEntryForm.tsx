// src/LedgerEntryForm.tsx
import React, { useState } from 'react';

// Define Props interface for the component
interface LedgerEntryFormProps {
  // Function passed from the parent component (SalesLedger) to handle the form data on submission
  onSubmit: (data: { type: string, amount: number, description?: string }) => void;
}

// Functional component definition
function LedgerEntryForm({ onSubmit }: LedgerEntryFormProps) {
  // State variables to manage the form inputs
  const [type, setType] = useState('INVOICE'); // Default type when form loads/resets
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');

  // Function to handle the form's submit event
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); // Prevent the default browser form submission (page reload)

    // Validate the amount input
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      alert("Please enter a valid positive amount."); // Simple browser alert for validation
      return; // Stop submission if validation fails
    }

    // Call the onSubmit function passed via props, sending the form data
    onSubmit({
      type: type, // The selected type (e.g., "INVOICE")
      amount: numericAmount, // The parsed numeric amount
      description: description || undefined // Use the description, or undefined if empty
    });

    // Reset the form fields to their initial state after submission
    setAmount('');
    setDescription('');
    setType('INVOICE');
  };

  // JSX structure for the form
  return (
    <form onSubmit={handleSubmit} style={{ margin: '20px 0', border: '1px solid #ccc', padding: '15px' }}>
      <h4>Add New Transaction</h4>
      <div>
        <label htmlFor="entry-type" style={{ marginRight: '10px' }}>Type:</label>
        <select
          id="entry-type"
          value={type} // Controlled component: value linked to state
          onChange={(e) => setType(e.target.value)} // Update state on change
          required // HTML5 validation: field must be selected
        >
          {/* --- Options available to the end-user --- */}
          {/* --- CASH_RECEIPT is intentionally excluded --- */}
          <option value="INVOICE">Invoice (+)</option>
          <option value="CREDIT_NOTE">Credit Note (-)</option>
          <option value="INCREASE_ADJUSTMENT">Increase Adjustment (+)</option>
          <option value="DECREASE_ADJUSTMENT">Decrease Adjustment (-)</option>
        </select>
      </div>
      <div style={{ marginTop: '10px' }}>
        <label htmlFor="entry-amount" style={{ marginRight: '10px' }}>Amount:</label>
        <input
          id="entry-amount"
          type="number"
          step="0.01" // Allow decimal input (e.g., for pounds and pence)
          min="0.01"  // HTML5 validation: minimum positive value
          value={amount} // Controlled component
          onChange={(e) => setAmount(e.target.value)} // Update state on change
          required // HTML5 validation: field is required
          placeholder="e.g., 100.50"
          style={{ width: '150px' }}
        />
      </div>
       <div style={{ marginTop: '10px' }}>
        <label htmlFor="entry-description" style={{ marginRight: '10px' }}>Description (Optional):</label>
        <input
          id="entry-description"
          type="text"
          value={description} // Controlled component
          onChange={(e) => setDescription(e.target.value)} // Update state on change
          placeholder="e.g., Invoice #123"
        />
      </div>
      <button type="submit" style={{ marginTop: '15px' }}>
        Add Entry
      </button>
      {/* Note: No loading state handling here; the parent SalesLedger handles async logic */}
    </form>
  );
}

// Export the component as the default export for this file
export default LedgerEntryForm;