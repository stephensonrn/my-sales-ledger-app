// src/AddCashReceiptForm.tsx
import React, { useState } from 'react';
import { generateClient } from 'aws-amplify/api';
import {
  Button,
  TextField,
  Flex,
  Alert,
  View,
} from '@aws-amplify/ui-react';

import {
  adminAddCashReceipt,
} from './graphql/operations/mutations';

import type {
  AdminAddCashReceiptMutation,
  AdminAddCashReceiptMutationVariables, // Import the variables type
  CurrentAccountTransaction,
} from './graphql/API';

const client = generateClient();

interface AddCashReceiptFormProps {
  selectedTargetSub: string;
  // This prop from the parent isn't used here, so we can remove it for clarity
  // loggedInUser: any; 
  onCashReceiptAdded?: (newTransaction: CurrentAccountTransaction) => void;
}

function AddCashReceiptForm({ selectedTargetSub, onCashReceiptAdded }: AddCashReceiptFormProps) {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedTargetSub) {
      setError('No target user selected. Please select a user first.');
      return;
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setError('Please enter a valid positive amount for the cash receipt.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    // This object now directly represents the variables for the mutation.
    const mutationVariables: AdminAddCashReceiptMutationVariables = {
      targetOwnerId: selectedTargetSub,
      amount: numericAmount,
      description: description || null, // Send null if description is empty
    };

    try {
      console.log('AddCashReceiptForm: Calling AdminAddCashReceipt with variables:', mutationVariables);
      
      // --- THIS IS THE FIX ---
      // The variables are now passed directly, not nested inside an 'input' object.
      const response = await client.graphql<AdminAddCashReceiptMutation>({
        query: adminAddCashReceipt,
        variables: mutationVariables,
      });

      console.log('AddCashReceiptForm: Response from mutation:', response);

      if (response.errors) throw response.errors;

      const createdTransaction = response.data?.adminAddCashReceipt;

      if (createdTransaction) {
        setSuccess(`Successfully added cash receipt for user.`);
        setAmount('');
        setDescription('');
        if (onCashReceiptAdded) {
          onCashReceiptAdded(createdTransaction as CurrentAccountTransaction);
        }
      } else {
        throw new Error('Submission successful, but server did not return transaction data.');
      }
    } catch (err: any) {
      console.error('AddCashReceiptForm: Error adding cash receipt:', err);
      const errorMessages = Array.isArray(err) ? err.map((e: any) => e.message).join(', ') : (err.message || 'An unknown error occurred.');
      setError(`Failed to add cash receipt: ${errorMessages}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (!selectedTargetSub) {
    return <Alert variation="info">Please select a user to enable this form.</Alert>;
  }

  return (
    <View as="form" onSubmit={handleSubmit}>
      <Flex direction="column" gap="small">
        <TextField
          label="Amount (£):"
          type="number"
          step="0.01"
          min="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
          isDisabled={isLoading}
          placeholder="e.g., 50.00"
        />
        <TextField
          label="Description (Optional):"
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          isDisabled={isLoading}
          placeholder="e.g., Cash payment from customer"
        />
        <Button type="submit" isLoading={isLoading} variation="primary" marginTop="small">
          Add Cash Receipt
        </Button>
      </Flex>
      {success && (
        <Alert variation="success" isDismissible onDismiss={() => setSuccess(null)} marginTop="small">
          {success}
        </Alert>
      )}
      {error && (
        <Alert variation="error" isDismissible onDismiss={() => setError(null)} marginTop="small">
          {error}
        </Alert>
      )}
    </View>
  );
}

export default AddCashReceiptForm;
