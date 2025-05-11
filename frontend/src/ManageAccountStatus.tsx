// src/ManageAccountStatus.tsx
import React, { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/api';
import { ListAccountStatusesDocument, UpdateAccountStatusDocument } from './graphql/generated/graphql';
import type { AccountStatus, UpdateAccountStatusInput, ListAccountStatusesQuery, UpdateAccountStatusMutation } from './graphql/generated/graphql';
import { Button, TextField, Loader, Text, Card, Heading, Alert } from '@aws-amplify/ui-react';
import CreateAccountStatusForm from './CreateAccountStatusForm';

const client = generateClient();

interface ManageAccountStatusProps {
  selectedOwnerSub: string | null;
  targetUserName?: string;
}

function ManageAccountStatus({ selectedOwnerSub, targetUserName }: ManageAccountStatusProps) {
  const [loadedStatus, setLoadedStatus] = useState<AccountStatus | null>(null);
  const [newUnapprovedValue, setNewUnapprovedValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState<boolean>(false);

  useEffect(() => {
    console.log("ManageAccountStatus EFFECT: selectedOwnerSub changed to:", selectedOwnerSub);
    if (selectedOwnerSub) {
      console.log("ManageAccountStatus EFFECT: Clearing previous state, preparing to load new status for", selectedOwnerSub);
      setLoadedStatus(null);
      setNewUnapprovedValue('');
      setError(null);
      setSuccess(null);
      setShowCreateForm(false);
      setIsLoading(true);
      loadStatusForSelectedUser(selectedOwnerSub);
    } else {
      setLoadedStatus(null);
      setNewUnapprovedValue('');
      setError(null);
      setSuccess(null);
      setShowCreateForm(false);
      setIsLoading(false);
      console.log("ManageAccountStatus EFFECT: No user selected, state cleared.");
    }
  }, [selectedOwnerSub]);

  const loadStatusForSelectedUser = async (ownerSub: string) => {
    console.log(`ManageAccountStatus LOAD_FN: Attempting to load status for owner: ${ownerSub}`);
    try {
      const response = await client.graphql<ListAccountStatusesQuery>({
        query: ListAccountStatusesDocument,
        variables: { filter: { owner: { eq: ownerSub } }, limit: 1 },
        authMode: 'userPool'
      });
      console.log(`ManageAccountStatus LOAD_FN: Raw Response for ${ownerSub}:`, JSON.stringify(response, null, 2));

      // Explicitly check for GraphQL errors in the response
      if (response.errors && response.errors.length > 0) {
        console.error("ManageAccountStatus LOAD_FN: GraphQL errors returned:", response.errors);
        setError(`Failed to load status: ${response.errors[0].message}`);
        setLoadedStatus(null);
        setShowCreateForm(false); // Do not show create form on GraphQL error
        setIsLoading(false); // Stop loading indicator
        return; // Important to exit here
      }

      const statusItems = response.data?.listAccountStatuses?.items;

      if (statusItems && statusItems.length > 0) {
        const validStatus = statusItems.filter(item => item !== null)[0] as AccountStatus | undefined;
        if (validStatus) {
          console.log(`ManageAccountStatus LOAD_FN: Status found for ${ownerSub}.`);
          setLoadedStatus(validStatus);
          setNewUnapprovedValue(validStatus.totalUnapprovedInvoiceValue.toString());
          setShowCreateForm(false);
          setError(null);
        } else {
          // This case (items array exists but contains only nulls after filtering) is unlikely
          console.log(`ManageAccountStatus LOAD_FN: Status items array present but no valid status for ${ownerSub}. Showing create form.`);
          setLoadedStatus(null);
          setShowCreateForm(true);
          setError(null);
        }
      } else { // No items found in the response (statusItems is null, undefined, or empty array)
        console.log(`ManageAccountStatus LOAD_FN: No AccountStatus record found for ${ownerSub}. Showing create form.`);
        setLoadedStatus(null);
        setShowCreateForm(true);
        setError(null);
      }
    } catch (err: any) { // Catches network errors or errors explicitly thrown (like from response.errors check)
      console.error("ManageAccountStatus LOAD_FN: CATCH block error loading status:", err);
      const errorMsg = err?.message || 'Unknown error during status load.';
      setError(`Failed to load status: ${errorMsg}`);
      setLoadedStatus(null);
      setShowCreateForm(false); // Don't show create form if there was a network/unexpected error
    } finally {
      setIsLoading(false);
      console.log(`ManageAccountStatus LOAD_FN: Finished loading attempt for ${ownerSub}. isLoading: false`);
    }
  };

  const handleUpdateStatus = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    console.log("ManageAccountStatus UPDATE_FN: Triggered. selectedOwnerSub:", selectedOwnerSub, "loadedStatus:", loadedStatus);
    if (!loadedStatus?.id || loadedStatus.owner !== selectedOwnerSub) {
      setError('Status for the selected user not loaded or ID mismatch. Please re-select user.');
      return;
    }
    const numericValue = parseFloat(newUnapprovedValue);
    if (isNaN(numericValue) || numericValue < 0) {
      setError('Please enter a valid non-negative unapproved value.'); return;
    }

    setIsLoading(true); setError(null); setSuccess(null);
    const input: UpdateAccountStatusInput = { id: loadedStatus.id, totalUnapprovedInvoiceValue: numericValue };
    try {
        const response = await client.graphql<UpdateAccountStatusMutation>({
            query: UpdateAccountStatusDocument, variables: { input }, authMode: 'userPool'
        });
        const updatedStatus = response.data?.updateAccountStatus;
        if (response.errors) throw response.errors[0];
        if (updatedStatus) {
            setLoadedStatus(updatedStatus as AccountStatus);
            setNewUnapprovedValue(updatedStatus.totalUnapprovedInvoiceValue.toString());
            setSuccess(`Successfully updated value for ${updatedStatus.owner} to ${numericValue.toFixed(2)}.`);
        } else { setError("Update successful, but server did not return updated data."); }
    } catch (err: any) {
      const errors = err.errors || [err];
      setError(`Failed to update status: ${errors[0]?.message || 'Unknown error'}`);
    } finally { setIsLoading(false); }
  };

  const handleStatusCreated = (newStatus: AccountStatus) => {
    console.log("ManageAccountStatus CREATED_CB: New status received from form:", newStatus);
    setLoadedStatus(newStatus);
    setNewUnapprovedValue(newStatus.totalUnapprovedInvoiceValue.toString());
    setShowCreateForm(false);
    setSuccess("Account Status created successfully! You can now manage it.");
    setError(null); // Clear any "not found" type errors
  };

  console.log("ManageAccountStatus RENDER: selectedOwnerSub=", selectedOwnerSub, "isLoading=", isLoading, "loadedStatus=", !!loadedStatus, "showCreateForm=", showCreateForm, "error=", error);

  if (!selectedOwnerSub) {
     return null;
  }

  // Show main loader if we are in an isLoading state AND not intending to show the create form (unless create form also has its own loader)
  if (isLoading && !showCreateForm) {
     return <Loader size="large" marginTop="medium" />;
  }

  return (
    <Card variation="outlined" padding="medium">
      <Heading level={5}>Manage Account Status</Heading>
      <Text variation="tertiary" fontSize="small" marginBottom="medium">
        For User Sub: <code>{selectedOwnerSub}</code>
        {targetUserName && ` (${targetUserName})`}
      </Text>

      {/* Display general success/error messages from update/create actions */}
      {success && <Alert variation="success" isDismissible={true} onDismiss={() => setSuccess(null)}>{success}</Alert>}
      {error && <Alert variation="error" isDismissible={true} onDismiss={() => setError(null)}>{error}</Alert>}


      {loadedStatus && !showCreateForm && ( // If status is loaded AND we are NOT showing the create form
          <form onSubmit={handleUpdateStatus} style={{marginTop: '1em'}}>
            <TextField
              label="Total Unapproved Value:" type="number" id="unapprovedValue"
              step="0.01" min="0" value={newUnapprovedValue}
              onChange={(e) => setNewUnapprovedValue(e.target.value)} required
              isDisabled={isLoading}
            />
            <Button type="submit" isLoading={isLoading} variation="primary" marginTop="small">
                Save New Value
            </Button>
          </form>
      )}

      {/* Show CreateAccountStatusForm if showCreateForm is true, user selected, and not in a general loading state */}
      {showCreateForm && selectedOwnerSub && !isLoading && (
        <CreateAccountStatusForm
          targetUserSub={selectedOwnerSub}
          targetUserName={targetUserName}
          onStatusCreated={handleStatusCreated}
        />
      )}

      {/* Fallback text if nothing else is shown (e.g., an error occurred during load that prevented showing create form) */}
      {/* Or simply if no status and create form is also not meant to be shown due to an error */}
      {!loadedStatus && !showCreateForm && !isLoading && !error && (
        <Text marginTop="small" variation="tertiary">No Account Status record found. Select user to load or create.</Text>
      )}
    </Card>
  );
}

export default ManageAccountStatus;