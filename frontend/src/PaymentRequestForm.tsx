// src/PaymentRequestForm.tsx
import React, { useState, useEffect } from 'react';

interface PaymentRequestFormProps {
  netAvailability: number;
  onSubmitRequest: (amount: number) => Promise<void>; // Function to call API
  isLoading: boolean; // Is the submission in progress?
  requestError: string | null;
  requestSuccess: string | null;
}

function PaymentRequestForm({
  netAvailability,
  onSubmitRequest,
  isLoading,
  requestError,
  requestSuccess
}: PaymentRequestFormProps) {
  const [amount, setAmount] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Format netAvailability for display
  const formattedMaxAmount = netAvailability.toFixed(2);

  useEffect(() => {
    // Clear input on successful submission
    if (requestSuccess) {
      setAmount('');
    }
  }, [requestSuccess]);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const requested = parseFloat(e.target.value);
    setAmount(e.target.value); // Keep input as string for controlled component

    if (isNaN(requested)) {
        setValidationError('Please enter a valid number.');
    } else if (requested <= 0) {
      setValidationError('Amount must be positive.');
    } else if (requested > netAvailability) {
      setValidationError(`Amount cannot exceed Net Availability (£${formattedMaxAmount}).`);
    } else {
      setValidationError(null); // Clear error if valid
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const requestedAmount = parseFloat(amount);

    // Final validation check on submit
    if (validationError || isNaN(requestedAmount) || requestedAmount <= 0) {
        alert(`Please fix the errors before submitting. ${validationError || ''}`);
        return;
    }
    if (requestedAmount > netAvailability) {
        alert(`Amount cannot exceed Net Availability (£${formattedMaxAmount}).`);
        return;
    }

    // Call the async submit handler passed from the parent
    await onSubmitRequest(requestedAmount);
  };

  return (
    <form onSubmit={handleSubmit} style={{ border: '1px solid #007bff', padding: '15px', margin: '20px 0', backgroundColor: '#f0f8ff' }}>
      <h4>Request Payment</h4>
      <p>Net Availability: £{formattedMaxAmount}</p>
      <div>
        <label htmlFor="payment-request-amount" style={{ marginRight: '10px' }}>
          Request Amount (£):
        </label>
        <input
          id="payment-request-amount"
          type="number"
          step="0.01"
          min="0.01"
          max={netAvailability.toFixed(2)} // Set max attribute
          value={amount}
          onChange={handleAmountChange}
          required
          placeholder="e.g., 500.00"
          style={{ width: '150px' }}
          disabled={isLoading}
        />
      </div>
      {validationError && <p style={{ color: 'red', marginTop: '5px' }}>{validationError}</p>}

      <button
        type="submit"
        style={{ marginTop: '15px' }}
        disabled={isLoading || !!validationError || amount === ''} // Disable if loading, error, or empty
      >
        {isLoading ? 'Submitting...' : 'Submit Payment Request'}
      </button>

      {/* Display Success/Error messages */}
      {requestSuccess && <p style={{ color: 'green', marginTop: '10px' }}>{requestSuccess}</p>}
      {requestError && <p style={{ color: 'red', marginTop: '10px' }}>{requestError}</p>}
    </form>
  );
}

export default PaymentRequestForm;