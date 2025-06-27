// FILE: src/AdminPage.tsx (Updated)
// ==========================================================

import React, { useState, useEffect, useCallback } from 'react';
import { generateClient } from 'aws-amplify/api';
import { type User } from 'aws-amplify/auth';
import {
  Flex,
  Heading,
  Text,
  Button,
  Loader,
  Card,
  Badge,
  View,
  Alert,
} from '@aws-amplify/ui-react';

import { adminListUsers } from './graphql/operations/queries';
import type { CognitoUser, AdminListUsersQuery } from './graphql/API';

import ManageAccountStatus from './ManageAccountStatus';
import AddCashReceiptForm from './AddCashReceiptForm';
import SalesLedger from './SalesLedger';
import MonthlyStatisticsTable from './MonthlyStatisticsTable';
// --- THIS IS THE FIX (Part 1): Import the new DocumentManager ---
import DocumentManager from './DocumentManager';

const USERS_PER_PAGE = 10;

interface AdminPageProps {
  loggedInUser: User & { userId?: string };
}

function AdminPage({ loggedInUser }: AdminPageProps) {
  const [client, setClient] = useState<any>(null);
  const [users, setUsers] = useState<CognitoUser[]>([]);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [isLoadingUsers, setIsLoadingUsers] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<CognitoUser | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setClient(generateClient());
  }, []);

  const fetchUsers = useCallback(async (token: string | null = null) => {
    // ... existing fetchUsers logic ...
  }, [client, loggedInUser]);

  useEffect(() => {
    if (client) {
        fetchUsers();
    }
  }, [client, fetchUsers]);

  const handleUserSelect = (user: CognitoUser) => {
    setSelectedUser(prevSelected => (prevSelected?.sub === user.sub ? null : user));
    setRefreshKey(0); 
  };
  
  const handleDataRefresh = () => {
    setRefreshKey(prevKey => prevKey + 1);
  };

  const getUserAttribute = (user: CognitoUser | null, attributeName: string): string | undefined => {
    if (!user || !user.attributes) return undefined;
    return user.attributes.find(attr => attr?.name === attributeName)?.value ?? undefined;
  };

  // ... existing styles ...

  return (
    <Flex direction="column" gap="large" padding="medium">
      <Heading level={2}>Admin Section</Heading>
      <Card variation="outlined">
        {/* ... existing user list table ... */}
      </Card>

      <View marginTop="large">
        {selectedUser && selectedUser.sub ? (
          <>
            <Heading level={3} marginBottom="medium">
              Managing User: {getUserAttribute(selectedUser, 'custom:company_name') ?? getUserAttribute(selectedUser, 'email') ?? selectedUser.username}
            </Heading>
            <Flex direction="column" gap="large">
              <Card variation="elevated">
                <Heading level={4} marginBottom="small">12 Month Statistics</Heading>
                <MonthlyStatisticsTable userId={selectedUser.sub} />
              </Card>

              <Card variation="elevated">
                <Heading level={4} marginBottom="small">Manage Account Status</Heading>
                <ManageAccountStatus
                  selectedOwnerSub={selectedUser.sub}
                  targetUserName={getUserAttribute(selectedUser, 'custom:company_name') ?? selectedUser.username ?? selectedUser.sub}
                  onStatusUpdated={handleDataRefresh}
                />
              </Card>

              <Card variation="elevated">
                <Heading level={4} marginBottom="small">Add Cash Receipt</Heading>
                <AddCashReceiptForm
                  selectedTargetSub={selectedUser.sub}
                  onCashReceiptAdded={handleDataRefresh}
                />
              </Card>

              <Card variation="elevated" marginTop="medium">
                <Heading level={4} marginBottom="small">Ledger Details (Current Month)</Heading>
                <SalesLedger
                  targetUserId={selectedUser.sub}
                  isAdmin={true}
                  loggedInUser={loggedInUser}
                  refreshKey={refreshKey}
                />
              </Card>

              {/* --- THIS IS THE FIX (Part 2): Add the DocumentManager for the selected user --- */}
              <Card variation="elevated" marginTop="medium">
                <Heading level={4} marginBottom="small">User Documents</Heading>
                <DocumentManager userId={selectedUser.sub} />
              </Card>

            </Flex>
          </>
        ) : (
          !isLoadingUsers && <Alert variation="info">Please select a user from the list above.</Alert>
        )}
      </View>
    </Flex>
  );
}

export default AdminPage;