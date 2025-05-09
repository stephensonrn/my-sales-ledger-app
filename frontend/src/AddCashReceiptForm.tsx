// src/AddCashReceiptForm.tsx
import React, { useState } from 'react';
import { generateClient } from 'aws-amplify/api';
import { adminAddCashReceipt as adminAddCashReceiptMutation } from './graphql/mutations';
import { Button, TextField, Text, Card, Heading, Alert } from '@aws-amplify/ui-react'; // Removed Loader as isLoading on Button is used

const client = generateClient();

// Define props interface
interface AddCashReceiptFormProps {
  selectedTargetSub: string | null; // Receive selected target sub ID as prop
}

// Accept props
function AddCashReceiptForm({ selectedTargetSub }: AddCashReceiptFormProps) {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleAddCashReceipt = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedTargetSub) {
      setError('No target user selected from the list.');
      return;
    }
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setError('Please enter a valid positive amount.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    const variables = {
      targetOwnerId: selectedTargetSub, // Use the prop value here
      amount: numericAmount,
      description: description || null
    };
    console.log("Calling adminAddCashReceipt mutation with variables:", variables);

    try {
      const response = await client.graphql({
        query: adminAddCashReceiptMutation,
        variables: variables,
        authMode: 'userPool' // Admin action
      });

      console.log("Admin Add Cash Receipt Response:", JSON.stringify(response, null, 2));

      const createdTransaction = response.data?.adminAddCashReceipt;
      const errors = response.errors;

      if (errors) throw errors[0];

      if (createdTransaction) {
        setSuccess(`Successfully added cash receipt (ID: ${createdTransaction.id}) for user ${selectedTargetSub}.`);
        setAmount(''); // Clear form on success
        setDescription('');
        // Consider adding a callback prop if AdminPage needs to know about success to refresh lists
      } else {
        console.warn("adminAddCashReceipt mutation returned null data without GraphQL errors.");
        setError("Submission successful, but server did not return confirmation data.");
      }
    } catch (err: any) {
      console.error("Error adding cash receipt:", err);
      const errors = err.errors || (Array.isArray(err) ? err : [err]);
      setError(`Failed to add cash receipt: ${errors[0]?.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Don't render the form if no target user is selected
  if (!selectedTargetSub) {
    // You might want to render nothing or a disabled state instead
    return null;
    // return <Text variation="tertiary">Select a user from the list above to add a cash receipt.</Text>;
  }

  return (
    <Card variation="outlined" padding="medium">
      <Heading level={5}>Add Cash Receipt</Heading>
      <Text variation="tertiary" fontSize="small" marginBottom="medium">Adding receipt for User Sub: <code>{selectedTargetSub}</code></Text>
      <form onSubmit={handleAddCashReceipt}>
        <TextField
          label="Amount:"
          type="number"
          step="0.01"
          min="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
          isDisabled={isLoading}
        />
        <TextField
          label="Description:"
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          isDisabled={isLoading}
          placeholder="(Optional)"
        />
        <Button type="submit" isLoading={isLoading} variation="primary" marginTop="small">
          Add Cash Receipt
        </Button>
      </form>
      {/* Use Alert component for feedback */}
      {success && <Alert variation="success" marginTop="small">{success}</Alert>}
      {error && <Alert variation="error" marginTop="small">{error}</Alert>}
    </Card>
  );
}

export default AddCashReceiptForm;