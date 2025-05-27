// src/ManageAccountStatus.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { generateClient } from 'aws-amplify/api';
import {
    ListAccountStatusesDocument,
    UpdateAccountStatusDocument,
    type AccountStatus, 
    type ListAccountStatusesQuery,
    type UpdateAccountStatusInput,
    type UpdateAccountStatusMutation
} from './graphql/API'; 

import { Button, TextField, Loader, Text, View, Heading, Alert, Flex } from '@aws-amplify/ui-react';
import CreateAccountStatusForm from './CreateAccountStatusForm';

const client = generateClient();

interface ManageAccountStatusProps {
  selectedOwnerSub: string | null;
  targetUserName?: string | null; 
}

function ManageAccountStatus({ selectedOwnerSub, targetUserName }: ManageAccountStatusProps) {
  const [status, setStatus] = useState<AccountStatus | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false); // For fetching status
  const [isUpdating, setIsUpdating] = useState<boolean>(false); // For update operation
  const [error, setError] = useState<string | null>(null); // For fetch errors
  const [updateError, setUpdateError] = useState<string | null>(null); // For update errors
  const [updateSuccess, setUpdateSuccess] = useState<string | null>(null);
  
  const [showCreateForm, setShowCreateForm] = useState<boolean>(false);
  const [totalUnapprovedInvoiceValue, setTotalUnapprovedInvoiceValue] = useState<string>('');

  const fetchAccountStatus = useCallback(async (ownerId: string) => {
    if (!ownerId) {
        setStatus(null); setShowCreateForm(false); setTotalUnapprovedInvoiceValue('');
        return;
    }
    setIsLoading(true); setError(null); setUpdateSuccess(null); setUpdateError(null);
    setShowCreateForm(false);
    console.log(`ManageAccountStatus: Attempting to load status for owner: ${ownerId}`);
    try {
      // Your schema for listAccountStatuses takes (owner: String, filter: AccountStatusFilterInput, ...)
      // The VTL uses filter.owner.eq for admins, or $context.identity.sub for non-admins.
      // So, for an admin calling this for a selected user, filter.owner.eq should be the selected user's sub.
      const variables: any = { limit: 1 };
      if (ownerId) { // This component assumes it's always for a specific owner (selectedOwnerSub)
          variables.filter = { owner: { eq: ownerId } };
      }
      // If your schema listAccountStatuses takes owner as a direct param:
      // variables.owner = ownerId; 

      const response = await client.graphql<ListAccountStatusesQuery>({
        query: ListAccountStatusesDocument,
        variables: variables,
        authMode: 'userPool', 
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
        setShowCreateForm(true); 
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
      setStatus(null); setTotalUnapprovedInvoiceValue(''); setShowCreateForm(false); setError(null);
    }
  }, [selectedOwnerSub, fetchAccountStatus]);

  const handleUpdate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // status.id should be the selectedOwnerSub if status exists for them.
    if (!status || !status.id || status.id !== selectedOwnerSub) { 
      setUpdateError("Account status ID mismatch or not loaded. Cannot update.");
      return;
    }
    setUpdateError(null); setUpdateSuccess(null); setIsUpdating(true);

    const numericValue = parseFloat(totalUnapprovedInvoiceValue);
    if (isNaN(numericValue) || numericValue < 0) {
      setUpdateError("Please enter a valid non-negative amount.");
      setIsUpdating(false);
      return;
    }

    const input: UpdateAccountStatusInput = {
      id: status.id, // This is the ID of the AccountStatus record (user's sub)
      totalUnapprovedInvoiceValue: numericValue,
    };

    try {
      console.log("ManageAccountStatus: Attempting to update status with input:", input);
      const response = await client.graphql<UpdateAccountStatusMutation>({
        query: UpdateAccountStatusDocument,
        variables: { input },
        authMode: 'userPool', 
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
    setShowCreateForm(false); 
    setError(null); 
    setUpdateSuccess("Account status created successfully!"); 
  };

  if (!selectedOwnerSub) { return null; }
  if (isLoading) { return <Loader size="small" />; }
  if (error) { return <Alert variation="error" isDismissible={true} onDismiss={() => setError(null)}>{error}</Alert>; }

  if (showCreateForm) {
    return (
      <CreateAccountStatusForm 
        ownerId={selectedOwnerSub} 
        ownerDisplayName={targetUserName}
        onStatusCreated={handleStatusCreated} 
      />
    );
  }
  
  if (!status) {
      return <Text>No account status information available for this user.</Text>;
  }

  return (
    <View as="form" onSubmit={handleUpdate}>
      <Flex direction="column" gap="small">
        <TextField
          label={`Total Unapproved Invoice Value for ${targetUserName || status.owner?.substring(0,8) || 'user'} (£)`}
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