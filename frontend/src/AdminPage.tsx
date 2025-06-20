// src/AdminPage.tsx
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

const USERS_PER_PAGE = 10;

interface AdminPageProps {
  loggedInUser: User & { userId?: string }; // The user object from useAuthenticator has a 'userId' which is the 'sub'
}

function AdminPage({ loggedInUser }: AdminPageProps) {
  const [client, setClient] = useState<any>(null);
  const [users, setUsers] = useState<CognitoUser[]>([]);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [isLoadingUsers, setIsLoadingUsers] = useState<boolean>(true); // Start as true
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<CognitoUser | null>(null);

  useEffect(() => {
    setClient(generateClient());
  }, []);

  // --- THIS IS THE FIX (Part 1): The data fetching function is now wrapped in useCallback with the correct dependencies ---
  const fetchUsers = useCallback(async (token: string | null = null) => {
    if (!client) return; // Don't fetch if the client isn't ready
    
    setIsLoadingUsers(true);
    setFetchError(null);

    // If this is a fresh fetch (not loading more), clear the existing state
    if (!token) {
      setSelectedUser(null);
      setUsers([]);
    }

    try {
      const response = await client.graphql<AdminListUsersQuery>({
        query: adminListUsers,
        variables: {
          limit: USERS_PER_PAGE,
          nextToken: token
        },
      });

      if (response.errors) throw response.errors;

      const resultData = response.data?.adminListUsers;
      const fetchedUsers = resultData?.users?.filter(Boolean) as CognitoUser[] || [];
      const paginationToken = resultData?.nextToken ?? null;

      // --- THIS IS THE FIX (Part 2): More robust filtering logic ---
      const loggedInUserId = loggedInUser.userId || loggedInUser.attributes?.sub;
      
      const nonAdminUsers = fetchedUsers.filter(user => {
          // Rule 1: Always filter out the currently logged-in admin.
          if (user.sub === loggedInUserId) {
              return false;
          }
          // Rule 2: Filter out any other user in an "Admin" group (case-insensitive).
          // This now safely handles cases where 'groups' is null or undefined.
          const isAdminGroupMember = user.groups?.some(group => group?.toLowerCase() === 'admin');
          return !isAdminGroupMember;
      });

      setUsers(prevUsers => token ? [...prevUsers, ...nonAdminUsers] : nonAdminUsers);
      setNextToken(paginationToken);

    } catch (err: any) {
      console.error("AdminPage: Error listing users:", err);
      const errorMessages = err.errors?.map((e: any) => e.message).join(', ') || err.message || 'Unknown error';
      setFetchError(errorMessages);
    } finally {
      setIsLoadingUsers(false);
    }
  }, [client, loggedInUser]); // Correct dependency array, removing the cause of the loop

  // This effect now correctly calls the stable fetchUsers function.
  useEffect(() => {
    if (client) {
        fetchUsers();
    }
  }, [client, fetchUsers]);


  // --- The rest of the component remains the same ---

  const handleUserSelect = (user: CognitoUser) => {
    setSelectedUser(prevSelected => (prevSelected?.sub === user.sub ? null : user));
  };

  const getUserAttribute = (user: CognitoUser | null, attributeName: string): string | undefined => {
    if (!user || !user.attributes) return undefined;
    return user.attributes.find(attr => attr?.name === attributeName)?.value ?? undefined;
  };

  const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', marginTop: '10px', fontSize: '0.9em' };
  const thTdStyle: React.CSSProperties = { border: '1px solid #ccc', padding: '8px', textAlign: 'left' };
  const selectedRowStyle: React.CSSProperties = { backgroundColor: '#e6f7ff', fontWeight: 'bold' };

  return (
    <Flex direction="column" gap="large" padding="medium">
      <Heading level={2}>Admin Section</Heading>
      <Card variation="outlined">
        <Heading level={4} marginBottom="medium">Select User to Manage</Heading>
        {fetchError && <Alert variation="error" heading="Error Loading Users">{fetchError}</Alert>}
        <View style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid #ccc', marginBottom: 'medium' }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thTdStyle}>Email</th>
                <th style={thTdStyle}>Company Name</th>
                <th style={thTdStyle}>Status</th>
                <th style={thTdStyle}>Sub ID</th>
                <th style={thTdStyle}>Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingUsers && (
                <tr key="loader-row">
                  <td colSpan={5} style={{ ...thTdStyle, textAlign: 'center' }}><Loader /></td>
                </tr>
              )}
              {!isLoadingUsers && users.length === 0 && !fetchError && (
                <tr key="no-users-row">
                  <td colSpan={5} style={{ ...thTdStyle, textAlign: 'center' }}><Text>No non-admin users found.</Text></td>
                </tr>
              )}
              {users.map((user) => {
                if (!user || !user.sub) return null;
                return (
                  <tr key={user.sub} style={selectedUser?.sub === user.sub ? selectedRowStyle : undefined}>
                    <td style={thTdStyle}>{getUserAttribute(user, 'email') ?? user.username ?? '-'}</td>
                    <td style={thTdStyle}>{getUserAttribute(user, 'custom:company_name') ?? '-'}</td>
                    <td style={thTdStyle}><Badge variation={user.enabled ? 'success' : 'info'}>{user.status}</Badge></td>
                    <td style={thTdStyle}><code>{user.sub}</code></td>
                    <td style={thTdStyle}>
                      <Button
                        size="small"
                        variation={selectedUser?.sub === user.sub ? 'primary' : 'link'}
                        onClick={() => handleUserSelect(user)}
                      >
                        {selectedUser?.sub === user.sub ? 'Selected' : 'Select'}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </View>
        {nextToken && !isLoadingUsers && (
          <Button onClick={() => fetchUsers(nextToken)} marginTop="small" isFullWidth={false}>Load More Users</Button>
        )}
      </Card>

      <View marginTop="large">
        {selectedUser && selectedUser.sub ? (
          <>
            <Heading level={3} marginBottom="medium">
              Managing User: {getUserAttribute(selectedUser, 'custom:company_name') ?? getUserAttribute(selectedUser, 'email') ?? selectedUser.username}
              <Text as="span" fontSize="small" color="font.tertiary"> (ID: {selectedUser.sub})</Text>
            </Heading>

            <Flex direction="column" gap="large">
              <Card variation="elevated">
                <Heading level={4} marginBottom="small">Manage Account Status</Heading>
                <ManageAccountStatus
                  selectedOwnerSub={selectedUser.sub}
                  targetUserName={getUserAttribute(selectedUser, 'custom:company_name') ?? selectedUser.username ?? selectedUser.sub}
                />
              </Card>

              <Card variation="elevated">
                <Heading level={4} marginBottom="small">Add Cash Receipt</Heading>
                <AddCashReceiptForm
                  selectedTargetSub={selectedUser.sub}
                  loggedInUser={loggedInUser}
                />
              </Card>

              <Card variation="elevated" marginTop="medium">
                <Heading level={4} marginBottom="small">Ledger Details</Heading>
                <SalesLedger
                  targetUserId={selectedUser.sub}
                  isAdmin={true}
                  loggedInUser={loggedInUser}
                />
              </Card>
            </Flex>
          </>
        ) : (
          !isLoadingUsers && <Alert variation="info">Please select a user from the list above to manage their details or view their ledger.</Alert>
        )}
      </View>
    </Flex>
  );
}

export default AdminPage;
