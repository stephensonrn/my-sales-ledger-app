// src/ManageAccountStatus.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { generateClient } from 'aws-amplify/api';
import {
    ListAccountStatusesDocument,
    UpdateAccountStatusDocument,
    // Import types (ensure AccountStatus is detailed enough if not using the full type from API.ts)
    type AccountStatus, // Assuming this type is defined in your API.ts
    type ListAccountStatusesQuery,
    type UpdateAccountStatusInput,
    type UpdateAccountStatusMutation
} from './graphql/API'; // Assuming API.ts is in src/graphql/

import { Button, TextField, Loader, Text, Card, Heading, Alert, Flex } from '@aws-amplify/ui-react';
import CreateAccountStatusForm from './CreateAccountStatusForm'; // Import the new form

const client = generateClient();

interface ManageAccountStatusProps {
  selectedOwnerSub: string | null;
  targetUserName?: string | null; // For display purposes
}

function ManageAccountStatus({ selectedOwnerSub, targetUserName }: ManageAccountStatusProps) {
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
    console.log(`ManageAccountStatus: Attempting to load status for owner: ${ownerId}`);
    try {
      const response = await client.graphql<ListAccountStatusesQuery>({
        query: ListAccountStatusesDocument,
        variables: {
          filter: { owner: { eq: ownerId } }, // Assuming 'id' in AccountStatus is the owner's sub
                                                // Or if your schema expects 'owner: ownerId' direct variable
          limit: 1,
        },
        authMode: 'userPool', // Assuming admin makes this call
      });
      console.log("ManageAccountStatus: Raw Response for listAccountStatuses:", response);

      if (response.errors) throw response.errors;

      const items = response.data?.listAccountStatuses?.items;
      if (items && items.length > 0 && items[0]) {
        const fetchedStatus = items[0] as AccountStatus;
        setStatus(fetchedStatus);
        setTotalUnapprovedInvoiceValue(fetchedStatus.totalUnapprovedInvoiceValue.toString());
        setShowCreateForm(false);
        console.log("ManageAccountStatus: Status found for", ownerId, fetchedStatus);
      } else {
        setStatus(null);
        setTotalUnapprovedInvoiceValue('');
        setShowCreateForm(true); // Show create form if no status exists
        console.log("ManageAccountStatus: No AccountStatus record found for", ownerId);
      }
    } catch (err: any) {
      console.error("ManageAccountStatus: Error loading account status:", err);
      const errorMessages = err.errors && Array.isArray(err.errors) ? err.errors.map((e: any) => e.message).join(', ') : err.message || 'Unknown error';
      setError(`Failed to load account status: ${errorMessages}`);
      setStatus(null);
      setTotalUnapprovedInvoiceValue('');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedOwnerSub) {
      console.log("ManageAccountStatus: selectedOwnerSub changed to:", selectedOwnerSub);
      fetchAccountStatus(selectedOwnerSub);
    } else {
      // Clear status if no user is selected
      setStatus(null);
      setTotalUnapprovedInvoiceValue('');
      setShowCreateForm(false);
      setError(null);
    }
  }, [selectedOwnerSub, fetchAccountStatus]);

  const handleUpdate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!status || !status.id) {
      setUpdateError("No account status loaded to update.");
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
      id: status.id, // This should be the ID of the AccountStatus record (likely user's sub)
      totalUnapprovedInvoiceValue: numericValue,
    };

    try {
      console.log("ManageAccountStatus: Attempting to update status with input:", input);
      const response = await client.graphql<UpdateAccountStatusMutation>({
        query: UpdateAccountStatusDocument,
        variables: { input },
        authMode: 'userPool', // Assuming admin makes this call
      });
      console.log("ManageAccountStatus: Update response:", response);

      if (response.errors) throw response.errors;

      const updatedStatus = response.data?.updateAccountStatus;
      if (updatedStatus) {
        setStatus(updatedStatus as AccountStatus);
        setTotalUnapprovedInvoiceValue(updatedStatus.totalUnapprovedInvoiceValue.toString());
        setUpdateSuccess("Account status updated successfully!");
      } else {
         throw new Error("Update response did not return an account status.");
      }
    } catch (err: any) {
      console.error("ManageAccountStatus: Error updating account status:", err);
      const errorMessages = err.errors && Array.isArray(err.errors) ? err.errors.map((e: any) => e.message).join(', ') : err.message || 'Unknown error';
      setUpdateError(`Failed to update status: ${errorMessages}`);
    } finally {
      setIsUpdating(false);
    }
  };
  
  const handleStatusCreated = (newStatus: AccountStatus) => {
    console.log("ManageAccountStatus: New status created by form, updating state:", newStatus);
    setStatus(newStatus);
    setTotalUnapprovedInvoiceValue(newStatus.totalUnapprovedInvoiceValue.toString());
    setShowCreateForm(false); // Hide create form
    setError(null); // Clear any previous "not found" error
    setUpdateSuccess("Account status created successfully!"); // Provide success feedback
  };


  if (!selectedOwnerSub) {
    return null; // Or some placeholder if no user is selected in the parent AdminPage
  }

  if (isLoading) {
    return <Loader size="small" />;
  }

  if (error) {
    return <Alert variation="error" isDismissible={true} onDismiss={() => setError(null)}>{error}</Alert>;
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
  
  if (!status) {
      // This case should ideally be covered by showCreateForm or error states.
      // If selectedOwnerSub is present but status is null and not loading & no error, it implies no status.
      // Handled by showCreateForm now. If create form is not shown, this might indicate an unexpected state.
      return <Text>No account status information available for this user and create form is not shown.</Text>;
  }


  return (
    <View as="form" onSubmit={handleUpdate}>
      <Flex direction="column" gap="small">
        <TextField
          label={`Total Unapproved Invoice Value for ${targetUserName || status.owner} (£)`}
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
        {updateError && <Alert variation="error" marginTop="small" isDismissible={true} onDismiss={() => setUpdateError(null)}>{updateError}</Alert>}
        {updateSuccess && <Alert variation="success" marginTop="small" isDismissible={true} onDismiss={() => setUpdateSuccess(null)}>{updateSuccess}</Alert>}
      </Flex>
    </View>
  );
}

export default ManageAccountStatus;