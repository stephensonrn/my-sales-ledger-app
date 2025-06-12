// src/LedgerEntryForm.tsx
import React, { useState } from 'react';
import { Button, TextField, SelectField, Flex, Alert, View } from '@aws-amplify/ui-react';

// Corrected imports from the single generated API file
import { LedgerEntryType, type CreateLedgerEntryInput } from './graphql/API';

interface LedgerEntryFormProps {
  onSubmit: (data: Pick<CreateLedgerEntryInput, "type" | "amount" | "description">) => void;
  disabled?: boolean; // Optional: if parent needs to disable the form (e.g., during other loads)
}

function LedgerEntryForm({ onSubmit, disabled = false }: LedgerEntryFormProps) {
  const [type, setType] = useState<LedgerEntryType>(LedgerEntryType.INVOICE);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    const numericAmount = parseFloat(amount);

    // Basic validation
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setFormError('Please enter a valid positive amount.');
      return;
    }
    if (!type) {
      setFormError('Please select a transaction type.');
      return;
    }

    // Call the parent onSubmit handler with the data
    onSubmit({
      type,
      amount: numericAmount,
      description: description || undefined, // Pass undefined if empty for optional field
    });

    // Reset form after submission
    setAmount('');
    setDescription('');
    setType(LedgerEntryType.INVOICE);
  };

  return (
    <View as="form" onSubmit={handleSubmit} marginTop="medium" border="1px solid #ddd" padding="medium">
      {formError && <Alert variation="error" marginBottom="small" isDismissible={true} onDismiss={() => setFormError(null)}>{formError}</Alert>}
      <Flex direction="column" gap="small">
        <SelectField
          label="Transaction Type"
          value={type}
          onChange={(e) => setType(e.target.value as LedgerEntryType)}
          required
          disabled={disabled}
        >
          {Object.values(LedgerEntryType)
            .filter(lt => lt !== LedgerEntryType.CASH_RECEIPT) // Exclude CASH_RECEIPT type
            .map((entryType) => (
              <option key={entryType} value={entryType}>
                {entryType.replace('_', ' ')}
                {['INVOICE', 'INCREASE_ADJUSTMENT'].includes(entryType) ? ' (+)' : ' (-)'}
              </option>
            ))}
        </SelectField>
        <TextField
          label="Amount (£)"
          type="number"
          step="0.01"
          min="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
          disabled={disabled}
          placeholder="e.g., 100.50"
        />
        <TextField
          label="Description (Optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={disabled}
          placeholder="e.g., Invoice #123"
        />
        <Button type="submit" variation="primary" isLoading={disabled} disabled={disabled}> 
          Add Transaction
        </Button>
      </Flex>
    </View>
  );
}

export default LedgerEntryForm;
