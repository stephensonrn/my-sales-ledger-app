// src/PaymentRequestForm.tsx
import React, { useState } from 'react';
import { Button, TextField, Flex, Alert, Text, View } from '@aws-amplify/ui-react';

interface PaymentRequestFormProps {
  netAvailability: number;
  onSubmitRequest: (amount: number) => Promise<void>;
  isLoading: boolean;
  requestError: string | null;
  requestSuccess: string | null;
  disabled?: boolean;
}

const formatCurrency = (value: number | null | undefined) =>
  typeof value === 'number' && !isNaN(value)
    ? value.toFixed(2)
    : '0.00';

function PaymentRequestForm({
  netAvailability,
  onSubmitRequest,
  isLoading,
  requestError,
  requestSuccess,
  disabled = false
}: PaymentRequestFormProps) {
  const [amount, setAmount] = useState<string>('');
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
      setValidationError(`Amount cannot exceed Net Availability (£${formatCurrency(netAvailability)}).`);
      return;
    }

    await onSubmitRequest(numericAmount);
    setAmount('');
  };

  return (
    <View as="form" onSubmit={handleSubmit} marginTop="medium" border="1px solid #ddd" padding="medium">
      <Text fontSize="small" color="font.secondary" marginBottom="small">
        Net Available for Request: £{formatCurrency(netAvailability)}
      </Text>

      {validationError && (
        <Alert variation="error" marginBottom="small" isDismissible onDismiss={() => setValidationError(null)}>
          {validationError}
        </Alert>
      )}
      {requestError && <Alert variation="error" marginBottom="small">{requestError}</Alert>}
      {requestSuccess && <Alert variation="success" marginBottom="small">{requestSuccess}</Alert>}

      <Flex direction="column" gap="small">
        <TextField
          label="Amount to Request (£):"
          type="number"
          step="0.01"
          min="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
          disabled={isLoading || disabled || netAvailability <= 0}
          placeholder="e.g., 100.00"
        />
        <Button
          type="submit"
          variation="primary"
          isLoading={isLoading}
          disabled={isLoading || disabled || netAvailability <= 0}
        >
          Submit Payment Request
        </Button>
      </Flex>
    </View>
  );
}

export default PaymentRequestForm;
