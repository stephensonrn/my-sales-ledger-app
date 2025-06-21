import React, { useState, useEffect, useCallback } from 'react';
import { generateClient } from 'aws-amplify/api';
import { Button, TextField, Loader, Text, View, Alert, Flex } from '@aws-amplify/ui-react';
import { listAccountStatuses } from './graphql/operations/queries';
import { updateAccountStatus } from './graphql/operations/mutations';
import type { AccountStatus, ListAccountStatusesQuery, UpdateAccountStatusInput, UpdateAccountStatusMutation } from './graphql/API';
import CreateAccountStatusForm from './CreateAccountStatusForm';

const client = generateClient();

interface ManageAccountStatusProps {
  selectedOwnerSub: string | null;
  targetUserName?: string | null;
  // --- THIS IS THE FIX (Part 5): Added prop to the interface ---
  onStatusUpdated?: () => void;
}

function ManageAccountStatus({ selectedOwnerSub, targetUserName, onStatusUpdated }: ManageAccountStatusProps) {
  const [status, setStatus] = useState<AccountStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateSuccess, setUpdateSuccess] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [totalUnapprovedInvoiceValue, setTotalUnapprovedInvoiceValue] = useState('');

  const fetchAccountStatus = useCallback(async (ownerId: string) => {
    if (!ownerId) {
      setStatus(null);
      setShowCreateForm(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    setUpdateSuccess(null);
    setUpdateError(null);
    setShowCreateForm(false);
    try {
      const response = await client.graphql<ListAccountStatusesQuery>({
        query: listAccountStatuses,
        variables: { filter: { owner: { eq: ownerId } }, limit: 1 },
      });
      const fetchedStatus = response.data?.listAccountStatuses?.items?.[0];
      if (fetchedStatus) {
        setStatus(fetchedStatus as AccountStatus);
        setTotalUnapprovedInvoiceValue(fetchedStatus.totalUnapprovedInvoiceValue.toString());
        setShowCreateForm(false);
      } else {
        setStatus(null);
        setShowCreateForm(true);
      }
    } catch (err: any) {
      setError(`Failed to load account status.`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedOwnerSub) {
      fetchAccountStatus(selectedOwnerSub);
    } else {
      setStatus(null);
      setShowCreateForm(false);
    }
  }, [selectedOwnerSub, fetchAccountStatus]);

  const handleUpdate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!status || !status.id) return;
    setIsUpdating(true);
    setUpdateError(null);
    setUpdateSuccess(null);
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
      });
      const updatedStatus = response.data?.updateAccountStatus;
      if (updatedStatus) {
        setStatus(updatedStatus as AccountStatus);
        setTotalUnapprovedInvoiceValue(updatedStatus.totalUnapprovedInvoiceValue.toString());
        setUpdateSuccess("Account status updated successfully!");
        // --- THIS IS THE FIX (Part 6): Call the callback on success ---
        if (onStatusUpdated) onStatusUpdated();
      } else {
        throw new Error("Update response did not return an account status.");
      }
    } catch (err) {
      setUpdateError(`Failed to update status.`);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleStatusCreated = (newStatus: AccountStatus) => {
    setStatus(newStatus);
    setTotalUnapprovedInvoiceValue(newStatus.totalUnapprovedInvoiceValue.toString());
    setShowCreateForm(false);
    setUpdateSuccess("Account status created successfully!");
    // --- THIS IS THE FIX (Part 6): Call the callback on success ---
    if (onStatusUpdated) onStatusUpdated();
  };
  
  // Render logic remains the same...
  if (!selectedOwnerSub) return null;
  if (isLoading) return <Loader />;
  if (error) return <Alert variation="error">{error}</Alert>;

  if (showCreateForm) {
    return (
      <CreateAccountStatusForm
        ownerId={selectedOwnerSub}
        ownerDisplayName={targetUserName}
        onStatusCreated={handleStatusCreated}
      />
    );
  }
  if (status) {
    return (
      <View as="form" onSubmit={handleUpdate}>
        <Flex direction="column" gap="small">
          <TextField
            label={`Set Unapproved Invoice Value for ${targetUserName || 'user'} (£)`}
            type="number"
            step="0.01"
            min="0"
            value={totalUnapprovedInvoiceValue}
            onChange={(e) => setTotalUnapprovedInvoiceValue(e.target.value)}
            required
            disabled={isUpdating}
          />
          <Button type="submit" variation="primary" isLoading={isUpdating}>Update Status</Button>
          {updateError && <Alert variation="error" marginTop="small">{updateError}</Alert>}
          {updateSuccess && <Alert variation="success" marginTop="small">{updateSuccess}</Alert>}
        </Flex>
      </View>
    );
  }
  return <Text>Unable to display account status.</Text>;
}

export default ManageAccountStatus;