// src/ManageAccountStatus.tsx
import React, { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/api';
import { listAccountStatuses } from './graphql/queries'; // Using list query as example
import { updateAccountStatus as updateAccountStatusMutation } from './graphql/mutations';
import type { AccountStatus, UpdateAccountStatusInput } from './graphql/API';
import { Button, TextField, Loader, Text, Card, Heading } from '@aws-amplify/ui-react';

const client = generateClient();

// Define props interface
interface ManageAccountStatusProps {
  selectedOwnerSub: string | null; // Receive selected sub ID as prop
}

// Accept props
function ManageAccountStatus({ selectedOwnerSub }: ManageAccountStatusProps) {
  const [loadedStatus, setLoadedStatus] = useState<AccountStatus | null>(null);
  const [newUnapprovedValue, setNewUnapprovedValue] = useState('');
  const [isLoading, setIsLoading] = useState(false); // Loading state for THIS component's actions
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Function to load status based on prop
  const loadStatusForSelectedUser = async (ownerSub: string) => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    setLoadedStatus(null);
    setNewUnapprovedValue('');
    console.log(`ManageAccountStatus: Attempting to load status for selected owner: ${ownerSub}`);

    try {
      const response = await client.graphql({
        query: listAccountStatuses,
        variables: {
          filter: { owner: { eq: ownerSub } }, // Filter by the passed sub ID
          limit: 1 // We only expect one record per owner
        },
        authMode: 'userPool' // Admin needs to be logged in
      });

      console.log(`ManageAccountStatus: Load Status Response for ${ownerSub}:`, JSON.stringify(response, null, 2));

      const statusItems = response.data?.listAccountStatuses?.items;
      if (response.errors) throw response.errors[0]; // Throw first GraphQL error

      if (statusItems && statusItems.length > 0) {
        const validStatus = statusItems.filter(item => item !== null)[0] as AccountStatus | undefined;
        if (validStatus) {
          setLoadedStatus(validStatus);
          setNewUnapprovedValue(validStatus.totalUnapprovedInvoiceValue.toString());
        } else {
           setError(`No valid AccountStatus record found for owner ID: ${ownerSub}.`);
        }
      } else {
        setError(`No AccountStatus record found for owner ID: ${ownerSub}. Record might need manual creation in DynamoDB first.`);
      }
    } catch (err: any) {
      console.error("ManageAccountStatus: Error loading account status:", err);
      const errors = err.errors || (Array.isArray(err) ? err : [err]);
      setError(`Failed to load status: ${errors[0]?.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Use useEffect to load status when selectedOwnerSub changes
  useEffect(() => {
    if (selectedOwnerSub) {
      loadStatusForSelectedUser(selectedOwnerSub);
    } else {
      // Clear status if no user is selected in parent
      setLoadedStatus(null);
      setNewUnapprovedValue('');
      setError(null);
      setSuccess(null);
    }
  }, [selectedOwnerSub]); // Re-run when selectedOwnerSub prop changes


  // Handler for submitting the update form
  const handleUpdateStatus = async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!loadedStatus?.id || loadedStatus.owner !== selectedOwnerSub) {
        setError('Status for the selected user not loaded or ID mismatch. Please re-select user.');
        return;
      }
      const numericValue = parseFloat(newUnapprovedValue);
      if (isNaN(numericValue) || numericValue < 0) {
        setError('Please enter a valid non-negative unapproved value.');
        return;
      }

      setIsLoading(true);
      setError(null);
      setSuccess(null);

      const input: UpdateAccountStatusInput = {
        id: loadedStatus.id,
        totalUnapprovedInvoiceValue: numericValue
      };
      console.log("ManageAccountStatus: Attempting to update status with input:", input);

      try {
          const response = await client.graphql({
              query: updateAccountStatusMutation,
              variables: { input: input },
              authMode: 'userPool'
          });
          console.log("ManageAccountStatus: Update Status Response:", JSON.stringify(response, null, 2));
          const updatedStatus = response.data?.updateAccountStatus;
          const errors = response.errors;
          if (errors) throw errors[0];

          if (updatedStatus) {
              setLoadedStatus(updatedStatus as AccountStatus);
              setNewUnapprovedValue(updatedStatus.totalUnapprovedInvoiceValue.toString());
              setSuccess(`Successfully updated value for owner ${updatedStatus.owner} to ${numericValue.toFixed(2)}.`);
          } else {
               console.warn("UpdateAccountStatus mutation returned null data without GraphQL errors.");
               setError("Update successful, but server did not return updated data.");
          }
      } catch (err: any) {
        console.error("ManageAccountStatus: Error updating account status:", err);
        const errors = err.errors || (Array.isArray(err) ? err : [err]);
        setError(`Failed to update status: ${errors[0]?.message || 'Unknown error'}`);
      } finally {
        setIsLoading(false);
      }
  };

  // Don't render the form section if no user is selected in the parent
  if (!selectedOwnerSub) {
     return <Text variation="tertiary">Select a user to manage their status.</Text>;
  }

  // Render loading state specific to this component's actions
  if (isLoading && !loadedStatus) { // Show loader only during initial load for this user
     return <Loader />;
  }

  return (
    <Card variation="outlined" padding="medium">
      <Heading level={5}>Manage Account Status (Total Unapproved Value)</Heading>
      <Text variation="tertiary" fontSize="small" marginBottom="medium">Managing status for User Sub: <code>{selectedOwnerSub}</code></Text>

      {loadedStatus ? (
          <form onSubmit={handleUpdateStatus}>
            <TextField
              label="Total Unapproved Value:"
              type="number"
              id="unapprovedValue"
              step="0.01"
              min="0"
              value={newUnapprovedValue}
              onChange={(e) => setNewUnapprovedValue(e.target.value)}
              required
              isDisabled={isLoading} // Disable field while submitting update
            />
            <Button type="submit" isLoading={isLoading} variation="primary" marginTop="small">
                Save New Value
            </Button>
          </form>
      ) : (
         // Show error if loading finished but no status loaded
         !isLoading && error && <Text color="red">{error}</Text>
      ) }
      {/* Display success/error messages specific to the update action */}
      {success && <Text color="green" marginTop="small">{success}</Text>}
      {/* Display error only if not loading and no success message */}
      {!isLoading && !success && error && <Text color="red" marginTop="small">{error}</Text>}
    </Card>
  );
}

export default ManageAccountStatus;