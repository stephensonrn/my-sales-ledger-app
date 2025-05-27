// src/PaymentRequestForm.tsx
import React, { useState } from 'react';
import { Button, TextField, Flex, Alert, Text, View, Heading } from '@aws-amplify/ui-react';

interface PaymentRequestFormProps {
  netAvailability: number;
  onSubmitRequest: (amount: number) => Promise<void>; // Made async to align with typical API calls
  isLoading: boolean;
  requestError: string | null;
  requestSuccess: string | null;
  disabled?: boolean;
}

function PaymentRequestForm({
  netAvailability,
  onSubmitRequest,
  isLoading,
  requestError,
  requestSuccess,
  disabled = false
}: PaymentRequestFormProps) {
  const [amount, setAmount] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setValidationError(null);
    const numericAmount = parseFloat(amount);

    if (isNaN(numericAmount) || numericAmount <= 0) {
      setValidationError('Please enter a valid positive amount.');
      return;
    }
    if (numericAmount > netAvailability) {
      setValidationError(`Amount cannot exceed Net Availability (£${netAvailability.toFixed(2)}).`);
      return;
    }

    await onSubmitRequest(numericAmount); // Call parent handler
    setAmount(''); // Clear amount on successful submission attempt
  };

  return (
    <View as="form" onSubmit={handleSubmit} marginTop="medium" border="1px solid #ddd" padding="medium">
      <Heading level={5} marginBottom="small">Request Payment</Heading>
      <Text fontSize="small" color="font.secondary" marginBottom="small">
        Net Available for Request: £{netAvailability.toFixed(2)}
      </Text>
      {validationError && <Alert variation="error" marginBottom="small" isDismissible={true} onDismiss={()=>setValidationError(null)}>{validationError}</Alert>}
      {requestError && <Alert variation="error" marginBottom="small">{requestError}</Alert>}
      {requestSuccess && <Alert variation="success" marginBottom="small">{requestSuccess}</Alert>}
      <Flex direction="column" gap="small">
        <TextField
          label="Amount to Request (£):"
          type="number"
          step="0.01"
          min="0.01"
          max={netAvailability.toFixed(2)}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
          disabled={isLoading || disabled}
          placeholder="e.g., 100.00"
        />
        <Button type="submit" variation="primary" isLoading={isLoading} disabled={isLoading || disabled || netAvailability <= 0}>
          Submit Payment Request
        </Button>
      </Flex>
    </View>
  );
}

export default PaymentRequestForm;