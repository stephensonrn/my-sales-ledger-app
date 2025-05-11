// src/CreateAccountStatusForm.tsx
import React, { useState } from 'react';
import { generateClient } from 'aws-amplify/api';
// --- UPDATED IMPORTS ---
import { AdminCreateAccountStatusDocument } from './graphql/generated/graphql';
import type { AccountStatus, AdminCreateAccountStatusMutationVariables, AdminCreateAccountStatusMutation } from './graphql/generated/graphql';
// --- END UPDATED IMPORTS ---
import { Button, TextField, Text, Card, Heading, Alert } from '@aws-amplify/ui-react';

const client = generateClient();

interface CreateAccountStatusFormProps {
  targetUserSub: string;
  targetUserName?: string;
  onStatusCreated: (newStatus: AccountStatus) => void;
}

function CreateAccountStatusForm({ targetUserSub, targetUserName, onStatusCreated }: CreateAccountStatusFormProps) {
  const [initialValue, setInitialValue] = useState('0');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateStatus = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const numericValue = parseFloat(initialValue);
    if (isNaN(numericValue) || numericValue < 0) {
      setError('Please enter a valid non-negative initial unapproved value.'); return;
    }
    setIsLoading(true); setError(null);

    const variables: AdminCreateAccountStatusMutationVariables = {
      ownerId: targetUserSub,
      initialUnapprovedInvoiceValue: numericValue,
    };

    try {
      const response = await client.graphql<AdminCreateAccountStatusMutation>({
        query: AdminCreateAccountStatusDocument,
        variables: variables,
        authMode: 'userPool',
      });
      const createdStatus = response.data?.adminCreateAccountStatus;
      if (response.errors) throw response.errors[0];

      if (createdStatus) {
        onStatusCreated(createdStatus as AccountStatus); // Pass complete AccountStatus object
        setInitialValue('0');
      } else { setError("Submission successful, but server did not return confirmation data."); }
    } catch (err: any) {
      const errors = err.errors || [err];
      setError(`Failed to create account status: ${errors[0]?.message || 'Unknown error'}`);
    } finally { setIsLoading(false); }
  };

  return (
    <Card variation="elevated" padding="medium" marginTop="medium">
      <Heading level={6} marginBottom="small">
        No Account Status Exists for {targetUserName ? `${targetUserName} (${targetUserSub})` : targetUserSub}. Create One?
      </Heading>
      <form onSubmit={handleCreateStatus}>
        <TextField label="Initial Total Unapproved Value:" type="number" step="0.01" min="0" value={initialValue} onChange={(e) => setInitialValue(e.target.value)} required isDisabled={isLoading} />
        <Button type="submit" isLoading={isLoading} variation="constructive" marginTop="small">Create Account Status</Button>
      </form>
      {error && <Alert variation="error" marginTop="small" isDismissible={true} onDismiss={() => setError(null)}>{error}</Alert>}
    </Card>
  );
}
export default CreateAccountStatusForm;