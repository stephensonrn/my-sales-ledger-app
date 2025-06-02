// src/AddCashReceiptForm.tsx
import React, { useState } from 'react';
import { generateClient } from 'aws-amplify/api';
import {
  Button,
  TextField,
  Flex,
  Alert,
  View,
  Heading
} from '@aws-amplify/ui-react';

// Import the mutation document from graphql/mutations
import { adminAddCashReceipt as AdminAddCashReceiptDocument } from './graphql/mutations';

// Import types from the generated API file
import {
  type AdminAddCashReceiptMutation,
  type AdminAddCashReceiptInput,
  type CurrentAccountTransaction
} from './graphql/API';

const client = generateClient();

interface AddCashReceiptFormProps {
  selectedTargetSub: string;
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
      setSuccess(null);
      return;
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setError('Please enter a valid positive amount for the cash receipt.');
      setSuccess(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    const mutationInput: AdminAddCashReceiptInput = {
      targetOwnerId: selectedTargetSub,
      amount: numericAmount,
      description: description || undefined,
    };

    try {
      console.log("AddCashReceiptForm: Calling AdminAddCashReceipt with input:", mutationInput);
      const response = await client.graphql<AdminAddCashReceiptMutation>({
        query: AdminAddCashReceiptDocument,
        variables: { input: mutationInput },
        authMode: 'userPool',
      });

      console.log("AddCashReceiptForm: Response from mutation:", response);

      if (response.errors && response.errors.length > 0) {
        throw response.errors;
      }

      const createdTransaction = response.data?.adminAddCashReceipt;

      if (createdTransaction) {
        setSuccess(`Successfully added cash receipt (ID: ${createdTransaction.id}) for user ${selectedTargetSub.substring(0, 8)}...`);
        setAmount('');
        setDescription('');
        if (onCashReceiptAdded) {
          onCashReceiptAdded(createdTransaction as CurrentAccountTransaction);
        }
      } else {
        console.error("AddCashReceiptForm: Submission successful, but server did not return transaction data.", response.data);
        setError("Submission processed, but could not confirm cash receipt details from the server.");
      }
    } catch (err: any) {
      console.error("AddCashReceiptForm: Error adding cash receipt:", err);
      let errorMessages = 'An unknown error occurred.';
      if (Array.isArray(err)) {
        errorMessages = err.map((e: any) => e.message || 'GraphQL error').join(', ');
      } else if (err.message) {
        errorMessages = err.message;
      }
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
        <Alert variation="success" isDismissible={true} onDismiss={() => setSuccess(null)} marginTop="small">
          {success}
        </Alert>
      )}
      {error && (
        <Alert variation="error" isDismissible={true} onDismiss={() => setError(null)} marginTop="small">
          {error}
        </Alert>
      )}
    </View>
  );
}

export default AddCashReceiptForm;
