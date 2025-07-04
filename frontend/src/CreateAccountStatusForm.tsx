// src/CreateAccountStatusForm.tsx
import React, { useState } from 'react';
import { generateClient } from 'aws-amplify/api';
import { Button, TextField, Flex, Heading, Alert, View } from '@aws-amplify/ui-react';

import { adminCreateAccountStatus } from './graphql/operations/mutations'; 
import type {
    AdminCreateAccountStatusInput,
    AdminCreateAccountStatusMutation,
    AccountStatus
} from './graphql/API';

const client = generateClient();

interface CreateAccountStatusFormProps {
  ownerId: string;
  ownerDisplayName?: string;
  onStatusCreated: (newStatus: AccountStatus) => void;
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
      setError("Please enter a valid non-negative initial value.");
      setIsLoading(false);
      return;
    }

    // --- THIS IS THE FIX ---
    // The input object now perfectly matches the GraphQL schema definition.
    const input: AdminCreateAccountStatusInput = {
      accountId: ownerId,
      initialUnapprovedInvoiceValue: numericInitialValue,
      status: 'ACTIVE', // Providing a default value for the required 'status' field.
    };

    try {
      const response = await client.graphql<AdminCreateAccountStatusMutation>({
        query: adminCreateAccountStatus,
        variables: { input: input },
      });

      if (response.errors) throw response.errors;

      const newStatus = response.data?.adminCreateAccountStatus;
      if (newStatus) {
        onStatusCreated(newStatus as AccountStatus);
        setInitialValue('0');
      } else {
        throw new Error("Failed to create account status, no data returned from server.");
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
        No Account Status Found for {ownerDisplayName || ownerId.substring(0,8)}. Create one?
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
