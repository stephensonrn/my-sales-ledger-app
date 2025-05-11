// src/AdminPage.tsx
import React, { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/api';
import {
  Flex,
  Heading,
  Text,
  Button,
  // Table, // Using HTML table
  Loader,
  Card,
  Badge
} from '@aws-amplify/ui-react';

// Import generated query and types
import { AdminListUsersDocument } from './graphql/generated/graphql'; // Verify exact export name
import type { CognitoUser, UserListResult, UserAttribute, AdminListUsersQuery } from './graphql/generated/graphql'; // Verify exact export names

// Import child components
import ManageAccountStatus from './ManageAccountStatus';
import AddCashReceiptForm from './AddCashReceiptForm';

const client = generateClient();
const USERS_PER_PAGE = 10;

function AdminPage() {
  const [users, setUsers] = useState<CognitoUser[]>([]);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [isLoadingUsers, setIsLoadingUsers] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<CognitoUser | null>(null);

  const fetchUsers = async (token: string | null = null) => {
    if (isLoadingUsers) return;
    setIsLoadingUsers(true);
    setFetchError(null);
    if (!token) { setSelectedUser(null); }

    console.log(`AdminPage: Fetching users... ${token ? 'nextToken: ' + token : 'Initial fetch'}`);
    try {
      const response = await client.graphql<AdminListUsersQuery>({ // Use generated Query type
        query: AdminListUsersDocument, // Use imported DocumentNode
        variables: {
          limit: USERS_PER_PAGE,
          nextToken: token
        },
        authMode: 'userPool'
      });

      const resultData = response.data?.adminListUsers;
      const fetchedUsers = resultData?.users?.filter(u => u !== null) as CognitoUser[] || [];
      const paginationToken = resultData?.nextToken ?? null;

      if (response.errors) { // Check for GraphQL errors array
        throw response.errors;
      }

      setUsers(prevUsers => token ? [...prevUsers, ...fetchedUsers] : fetchedUsers);
      setNextToken(paginationToken);

    } catch (err: any) {
      console.error("AdminPage: Error listing users:", err);
      const errorMessages = (err.errors as any[])?.map(e => e.message).join(', ') || err.message || 'Unknown error listing users';
      setFetchError(errorMessages);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleUserSelect = (user: CognitoUser) => {
    setSelectedUser(prevSelected => prevSelected?.sub === user.sub ? null : user);
  };

  const getUserAttribute = (user: CognitoUser | null, attributeName: string): string | undefined => {
    if (!user || !user.attributes) return undefined;
    return user.attributes.find(attr => attr?.name === attributeName)?.value ?? undefined;
  };

  // Basic styles for HTML table
  const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', marginTop: '10px', fontSize: '0.9em' };
  const thTdStyle: React.CSSProperties = { border: '1px solid #ccc', padding: '6px', textAlign: 'left' };
  const selectedRowStyle: React.CSSProperties = { backgroundColor: '#e6f7ff' };

  return (
    <Flex direction="column" gap="large">
      <Heading level={2}>Admin Section</Heading>
      <Card variation="outlined">
        <Heading level={4} marginBottom="medium">Select User to Manage</Heading>
        {fetchError && <Text color="red">{`Error loading users: ${fetchError}`}</Text>}
        <div style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid #ccc' }}>
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
              {!isLoadingUsers && users.length === 0 && !fetchError && (
                 <tr key="no-users-row"><td colSpan={5} style={thTdStyle}><Text>No users found.</Text></td></tr>
              )}
              {users.map((user) => {
                  if (!user) return null;
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
              {isLoadingUsers && (
                  <tr key="loader-row"><td colSpan={5} style={{ ...thTdStyle, textAlign: 'center' }}><Loader /></td></tr>
              )}
            </tbody>
          </table>
        </div>
        {nextToken && !isLoadingUsers && (
          <Button onClick={() => fetchUsers(nextToken)} marginTop="medium" isFullWidth={false}>Load More Users</Button>
        )}
      </Card>

      <div style={{ marginTop: '20px' }}>
        {selectedUser ? (
          <>
            <Heading level={4} marginBottom="small">
              Actions for User: {getUserAttribute(selectedUser, 'custom:company_name') ?? selectedUser.username} ({selectedUser.sub})
            </Heading>
            <Flex direction="column" gap="medium">
              <ManageAccountStatus selectedOwnerSub={selectedUser.sub} targetUserName={getUserAttribute(selectedUser, 'custom:company_name') ?? selectedUser.username} />
              <AddCashReceiptForm selectedTargetSub={selectedUser.sub} />
            </Flex>
          </>
        ) : (
           <Text variation="tertiary">Please select a user from the list above to manage their status or add a cash receipt.</Text>
        )}
      </div>
    </Flex>
  );
}
export default AdminPage;