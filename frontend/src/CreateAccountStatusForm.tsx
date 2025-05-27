// src/CreateAccountStatusForm.tsx
import React, { useState } from 'react';
import { generateClient } from 'aws-amplify/api';
import { Button, TextField, Flex, Heading, Alert } from '@aws-amplify/ui-react';
import {
    AdminCreateAccountStatusDocument, // Make sure this is in your schema and generated
    type AdminCreateAccountStatusInput,
    type AdminCreateAccountStatusMutation,
    type AccountStatus // To potentially return the created status
} from './graphql/API'; // Assuming API.ts is in src/graphql/

const client = generateClient();

interface CreateAccountStatusFormProps {
  ownerId: string; // The 'sub' of the user for whom to create the status
  ownerDisplayName?: string; // For display purposes
  onStatusCreated: (newStatus: AccountStatus) => void; // Callback after successful creation
}

function CreateAccountStatusForm({ ownerId, ownerDisplayName, onStatusCreated }: CreateAccountStatusFormProps) {
  const [initialValue, setInitialValue] = useState('0');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    const numericInitialValue = parseFloat(initialValue);
    if (isNaN(numericInitialValue) || numericInitialValue < 0) {
      setError("Please enter a valid non-negative initial value for unapproved invoices.");
      setIsLoading(false);
      return;
    }

    const input: AdminCreateAccountStatusInput = {
      ownerId: ownerId, // The schema used ownerId for this mutation
      initialUnapprovedInvoiceValue: numericInitialValue,
    };

    try {
      console.log("CreateAccountStatusForm: Attempting to create status with input:", input);
      const response = await client.graphql<AdminCreateAccountStatusMutation>({
        query: AdminCreateAccountStatusDocument,
        variables: { input: input }, // Your schema might take direct args instead of input obj
                                     // Adjust if your adminCreateAccountStatus takes (ownerId, initialValue)
        authMode: 'userPool' // Assuming admin is making this call
      });
      console.log("CreateAccountStatusForm: Response from mutation:", response);

      if (response.errors) {
        throw response.errors;
      }

      const newStatus = response.data?.adminCreateAccountStatus;
      if (newStatus) {
        console.log("CreateAccountStatusForm: Status created successfully:", newStatus);
        onStatusCreated(newStatus as AccountStatus); // Pass the full status object
        setInitialValue('0'); // Reset form
      } else {
        throw new Error("Failed to create account status, no data returned.");
      }
    } catch (err: any) {
      console.error("CreateAccountStatusForm: Error creating account status:", err);
      const errorMessages = err.errors && Array.isArray(err.errors) ? err.errors.map((e: any) => e.message).join(', ') : err.message || 'Unknown error';
      setError(`Failed to create account status: ${errorMessages}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View as="form" onSubmit={handleSubmit} border="1px dashed #ccc" padding="medium" marginTop="small">
      <Heading level={6} marginBottom="small">
        No Account Status Found for {ownerDisplayName || ownerId}. Create one?
      </Heading>
      {error && <Alert variation="error" marginBottom="small" isDismissible={true} onDismiss={() => setError(null)}>{error}</Alert>}
      <Flex direction="column" gap="small">
        <TextField
          label="Initial Total Unapproved Invoice Value (£)"
          type="number"
          step="0.01"
          min="0"
          value={initialValue}
          onChange={(e) => setInitialValue(e.target.value)}
          required
          disabled={isLoading}
        />
        <Button type="submit" variation="primary" isLoading={isLoading} disabled={isLoading}>
          Create Account Status
        </Button>
      </Flex>
    </View>
  );
}

export default CreateAccountStatusForm;