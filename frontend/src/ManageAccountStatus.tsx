// src/ManageAccountStatus.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { generateClient } from 'aws-amplify/api';
import { Button, TextField, Loader, Text, View, Alert, Flex } from '@aws-amplify/ui-react';

import { listAccountStatuses } from './graphql/operations/queries';
import { updateAccountStatus } from './graphql/operations/mutations';

import type {
  AccountStatus,
  ListAccountStatusesQuery,
  ListAccountStatusesQueryVariables,
  UpdateAccountStatusInput,
  UpdateAccountStatusMutation,
} from './graphql/API';

import CreateAccountStatusForm from './CreateAccountStatusForm';

const client = generateClient();

interface ManageAccountStatusProps {
  selectedOwnerSub: string | null;
  targetUserName?: string | null;
  onStatusUpdated?: () => void; // <-- New optional callback prop
}

function ManageAccountStatus({ selectedOwnerSub, targetUserName, onStatusUpdated }: ManageAccountStatusProps) {
  const [status, setStatus] = useState<AccountStatus | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateSuccess, setUpdateSuccess] = useState<string | null>(null);

  const [showCreateForm, setShowCreateForm] = useState<boolean>(false);
  const [totalUnapprovedInvoiceValue, setTotalUnapprovedInvoiceValue] = useState<string>('');

  const fetchAccountStatus = useCallback(async (ownerId: string) => {
    if (!ownerId) {
      setStatus(null);
      setShowCreateForm(false);
      setTotalUnapprovedInvoiceValue('');
      return;
    }
    setIsLoading(true);
    setError(null);
    setUpdateSuccess(null);
    setUpdateError(null);
    setShowCreateForm(false);

    try {
      const variables: ListAccountStatusesQueryVariables = {
        filter: { owner: { eq: ownerId } },
        limit: 1,
      };

      const response = await client.graphql<ListAccountStatusesQuery>({
        query: listAccountStatuses,
        variables,
        authMode: 'userPool',
      });

      if (response.errors) throw response.errors;

      const items = response.data?.listAccountStatuses?.items;
      if (items && items.length > 0 && items[0]) {
        const fetchedStatus = items[0] as AccountStatus;
        setStatus(fetchedStatus);
        setTotalUnapprovedInvoiceValue(fetchedStatus.totalUnapprovedInvoiceValue.toString());
        setShowCreateForm(false);
      } else {
        setStatus(null);
        setTotalUnapprovedInvoiceValue('');
        setShowCreateForm(true);
      }
    } catch (err: any) {
      const errorMessages = err.errors && Array.isArray(err.errors)
        ? err.errors.map((e: any) => e.message).join(', ')
        : err.message || 'Unknown error loading status.';
      setError(`Failed to load account status: ${errorMessages}`);
      setStatus(null);
      setTotalUnapprovedInvoiceValue('');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedOwnerSub) {
      fetchAccountStatus(selectedOwnerSub);
    } else {
      setStatus(null);
      setTotalUnapprovedInvoiceValue('');
      setShowCreateForm(false);
      setError(null);
    }
  }, [selectedOwnerSub, fetchAccountStatus]);

  const handleUpdate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!status || !status.id) {
      setUpdateError("Account status not loaded or ID is missing. Cannot update.");
      return;
    }
    if (status.id !== selectedOwnerSub) {
      setUpdateError("Data mismatch: trying to update status for a different user than selected.");
      return;
    }

    setUpdateError(null);
    setUpdateSuccess(null);
    setIsUpdating(true);

    const numericValue = parseFloat(totalUnapprovedInvoiceValue);
    if (isNaN(numericValue) || numericValue < 0) {
      setUpdateError("Please enter a valid non-negative amount.");
      setIsUpdating(false);
      return;
    }

    const input: UpdateAccountStatusInput = {
      id: status.id,
      totalUnapprovedInvoiceValue: numericValue,
    };

    try {
      const response = await client.graphql<UpdateAccountStatusMutation>({
        query: updateAccountStatus,
        variables: { input },
        authMode: 'userPool',
      });

      if (response.errors) throw response.errors;

      const updatedStatus = response.data?.updateAccountStatus;
      if (updatedStatus) {
        setStatus(updatedStatus as AccountStatus);
        setTotalUnapprovedInvoiceValue(updatedStatus.totalUnapprovedInvoiceValue.toString());
        setUpdateSuccess("Account status updated successfully!");

        // Trigger parent refresh callback after successful update
        if (onStatusUpdated) {
          onStatusUpdated();
        }
      } else {
        throw new Error("Update response did not return an account status.");
      }
    } catch (err: any) {
      const errorMessages = err.errors && Array.isArray(err.errors)
        ? err.errors.map((e: any) => e.message).join(', ')
        : err.message || 'Unknown error updating status.';
      setUpdateError(`Failed to update status: ${errorMessages}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleStatusCreated = (newStatus: AccountStatus) => {
    setStatus(newStatus);
    setTotalUnapprovedInvoiceValue(newStatus.totalUnapprovedInvoiceValue.toString());
    setShowCreateForm(false);
    setError(null);
    setUpdateSuccess("Account status created successfully!");
    
    // Trigger refresh callback after creation as well
    if (onStatusUpdated) {
      onStatusUpdated();
    }
  };

  if (!selectedOwnerSub) return null;

  if (isLoading) {
    return (
      <View textAlign="center" padding="medium">
        <Loader size="small" />
        <Text>Loading account status...</Text>
      </View>
    );
  }

  if (error && !showCreateForm) {
    return (
      <Alert
        variation="error"
        isDismissible={true}
        onDismiss={() => setError(null)}
      >
        {error}
      </Alert>
    );
  }

  if (showCreateForm && selectedOwnerSub) {
    return (
      <CreateAccountStatusForm
        ownerId={selectedOwnerSub}
        ownerDisplayName={targetUserName}
        onStatusCreated={handleStatusCreated}
      />
    );
  }

  if (!status && !showCreateForm) {
    return <Text>No account status information found for this user.</Text>;
  }

  if (status) {
    return (
      <View as="form" onSubmit={handleUpdate}>
        <Flex direction="column" gap="small">
          <TextField
            label={`Total Unapproved Invoice Value for ${targetUserName || status.owner?.substring(0, 8) || 'user'} (£)`}
            type="number"
            step="0.01"
            min="0"
            value={totalUnapprovedInvoiceValue}
            onChange={(e) => setTotalUnapprovedInvoiceValue(e.target.value)}
            required
            disabled={isUpdating}
          />
          <Button type="submit" variation="primary" isLoading={isUpdating} disabled={isUpdating}>
            Update Status
          </Button>
          {updateError && (
            <Alert variation="error" marginTop="small" isDismissible={true} onDismiss={() => setUpdateError(null)}>
              {updateError}
            </Alert>
          )}
          {updateSuccess && (
            <Alert variation="success" marginTop="small" isDismissible={true} onDismiss={() => setUpdateSuccess(null)}>
              {updateSuccess}
            </Alert>
          )}
        </Flex>
      </View>
    );
  }

  return <Text>Unable to display account status.</Text>;
}

export default ManageAccountStatus;
