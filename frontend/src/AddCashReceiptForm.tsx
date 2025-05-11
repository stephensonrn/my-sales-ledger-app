// src/AddCashReceiptForm.tsx
import React, { useState } from 'react';
import { generateClient } from 'aws-amplify/api';
// --- UPDATED IMPORTS ---
import { AdminAddCashReceiptDocument } from './graphql/generated/graphql';
import type { AdminAddCashReceiptMutation, AdminAddCashReceiptMutationVariables } from './graphql/generated/graphql';
// --- END UPDATED IMPORTS ---
import { Button, TextField, Text, Card, Heading, Alert } from '@aws-amplify/ui-react';

const client = generateClient();

interface AddCashReceiptFormProps {
  selectedTargetSub: string | null;
}

function AddCashReceiptForm({ selectedTargetSub }: AddCashReceiptFormProps) {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleAddCashReceipt = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedTargetSub) { setError('No target user selected.'); return; }
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) { setError('Please enter a valid positive amount.'); return; }

    setIsLoading(true); setError(null); setSuccess(null);

    const variables: AdminAddCashReceiptMutationVariables = {
      targetOwnerId: selectedTargetSub,
      amount: numericAmount,
      description: description || null
    };

    try {
      const response = await client.graphql<AdminAddCashReceiptMutation>({
        query: AdminAddCashReceiptDocument,
        variables: variables,
        authMode: 'userPool'
      });
      const createdTransaction = response.data?.adminAddCashReceipt;
      if (response.errors) throw response.errors[0];

      if (createdTransaction) {
        setSuccess(`Successfully added cash receipt (ID: ${createdTransaction.id}) for user ${selectedTargetSub}.`);
        setAmount(''); setDescription('');
      } else { setError("Submission successful, but server did not return confirmation data."); }
    } catch (err: any) {
      const errors = err.errors || [err];
      setError(`Failed to add cash receipt: ${errors[0]?.message || 'Unknown error'}`);
    } finally { setIsLoading(false); }
  };

  if (!selectedTargetSub) return null;

  return (
    <Card variation="outlined" padding="medium">
      <Heading level={5}>Add Cash Receipt</Heading>
      <Text variation="tertiary" fontSize="small" marginBottom="medium">Adding receipt for User Sub: <code>{selectedTargetSub}</code></Text>
      <form onSubmit={handleAddCashReceipt}>
        <TextField label="Amount:" type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required isDisabled={isLoading} />
        <TextField label="Description:" type="text" value={description} onChange={(e) => setDescription(e.target.value)} isDisabled={isLoading} placeholder="(Optional)" />
        <Button type="submit" isLoading={isLoading} variation="primary" marginTop="small">Add Cash Receipt</Button>
      </form>
      {success && <Alert variation="success" isDismissible={true} onDismiss={() => setSuccess(null)} marginTop="small">{success}</Alert>}
      {error && <Alert variation="error" isDismissible={true} onDismiss={() => setError(null)} marginTop="small">{error}</Alert>}
    </Card>
  );
}
export default AddCashReceiptForm;