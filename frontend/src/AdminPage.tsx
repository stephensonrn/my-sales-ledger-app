// src/AdminPage.tsx (Using HTML Table for Testing)
import React, { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/api';
// Import only the UI components needed *besides* Table
import {
  Flex,
  Heading,
  Text,
  Button,
  // Table, // REMOVED Table import
  Loader,
  Card,
  Badge // Keep Badge, Button, Loader etc. used inside table cells
} from '@aws-amplify/ui-react';

// Import generated query and types
import { adminListUsers } from './graphql/queries';
import type { CognitoUser } from './graphql/API';

// Import child components
import ManageAccountStatus from './ManageAccountStatus';
import AddCashReceiptForm from './AddCashReceiptForm';

const client = generateClient();
const USERS_PER_PAGE = 10;

function AdminPage() {
  // --- State and Functions (Keep as before) ---
  const [users, setUsers] = useState<CognitoUser[]>([]);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [isLoadingUsers, setIsLoadingUsers] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<CognitoUser | null>(null);

  // Assume fetchUsers, handleUserSelect, getUserAttribute functions are here and correct

  const fetchUsers = async (token: string | null = null) => {
    if (isLoadingUsers) return;
    setIsLoadingUsers(true);
    setFetchError(null);
    if (!token) { setSelectedUser(null); }
    console.log(`AdminPage: Fetching users... ${token ? 'nextToken: ' + token : 'Initial fetch'}`);
    try {
      const response = await client.graphql({ query: adminListUsers, variables: { limit: USERS_PER_PAGE, nextToken: token }, authMode: 'userPool' });
      console.log("AdminPage: List Users Response:", JSON.stringify(response, null, 2));
      const resultData = response.data?.adminListUsers;
      const fetchedUsers = resultData?.users?.filter(u => u !== null) as CognitoUser[] || [];
      const paginationToken = resultData?.nextToken ?? null;
      if (response.errors) throw response.errors[0];
      setUsers(prevUsers => token ? [...prevUsers, ...fetchedUsers] : fetchedUsers);
      setNextToken(paginationToken);
    } catch (err: any) {
      console.error("AdminPage: Error listing users:", err);
      const errors = err.errors || (Array.isArray(err) ? err : [err]);
      const errorMsg = errors[0]?.message || 'Unknown error listing users';
      setFetchError(errorMsg);
    } finally { setIsLoadingUsers(false); }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleUserSelect = (user: CognitoUser) => {
    console.log("AdminPage: User selected:", user);
    setSelectedUser(prevSelected => prevSelected?.sub === user.sub ? null : user);
  };

  const getUserAttribute = (user: CognitoUser | null, attributeName: string): string | undefined => {
    if (!user || !user.attributes) return undefined;
    return user.attributes.find(attr => attr?.name === attributeName)?.value ?? undefined;
  };


  // --- Logging Imports (Keep temporarily) ---
  console.log('CHECKING IMPORTS in AdminPage:');
  console.log('--> ManageAccountStatus:', ManageAccountStatus);
  console.log('--> AddCashReceiptForm:', AddCashReceiptForm);
  // ---------------------------------------

  // Basic styles for HTML table to make it readable
  const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', marginTop: '10px', fontSize: '0.9em' };
  const thTdStyle: React.CSSProperties = { border: '1px solid #ccc', padding: '6px', textAlign: 'left' };
  const selectedRowStyle: React.CSSProperties = { backgroundColor: '#e6f7ff' };

  return (
    <Flex direction="column" gap="large">
      <Heading level={2}>Admin Section</Heading>

      {/* --- User List Section --- */}
      <Card variation="outlined">
        <Heading level={4} marginBottom="medium">Select User to Manage</Heading>
        {fetchError && <Text color="red">{`Error loading users: ${fetchError}`}</Text>}
        <div style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid #ccc' }}>
          {/* --- Use HTML Table --- */}
          <table style={tableStyle}>
            <thead> {/* Use standard thead */}
              <tr> {/* Use standard tr */}
                <th style={thTdStyle}>Username/Email</th> {/* Use standard th */}
                <th style={thTdStyle}>Company Name</th>
                <th style={thTdStyle}>Status</th>
                <th style={thTdStyle}>Sub ID</th>
                <th style={thTdStyle}>Action</th>
              </tr>
            </thead>
            <tbody> {/* Use standard tbody */}
              {/* Conditionally rendered row for "No users found" */}
              {!isLoadingUsers && users.length === 0 && !fetchError && (
                 <tr key="no-users-row"><td colSpan={5} style={thTdStyle}><Text>No users found.</Text></td></tr>
              )}
              {/* Mapped user rows */}
              {users.map((user) => {
                  if (!user) return null;
                  return (
                    // Use standard tr, apply style conditionally
                    <tr key={user.sub} style={selectedUser?.sub === user.sub ? selectedRowStyle : undefined}>
                      <td style={thTdStyle}>{getUserAttribute(user, 'email') ?? user.username ?? '-'}</td>
                      <td style={thTdStyle}>{getUserAttribute(user, 'custom:company_name') ?? '-'}</td>
                      <td style={thTdStyle}><Badge variation={user.enabled ? 'success' : 'info'}>{user.status}</Badge></td> {/* Keep Amplify Badge */}
                      <td style={thTdStyle}><code>{user.sub}</code></td> {/* Use standard code */}
                      <td style={thTdStyle}>
                        <Button // Keep Amplify Button
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
              {/* Conditionally rendered row for Loader */}
              {isLoadingUsers && (
                  <tr key="loader-row"><td colSpan={5} style={{ ...thTdStyle, textAlign: 'center' }}><Loader /></td></tr> // Keep Amplify Loader
              )}
            </tbody>
          </table>
          {/* --- End HTML Table --- */}
        </div>
        {/* Load More Button */}
        {nextToken && !isLoadingUsers && (
          <Button onClick={() => fetchUsers(nextToken)} marginTop="medium" isFullWidth={false}>Load More Users</Button> // Keep Amplify Button
        )}
      </Card>
      {/* --- End User List Section --- */}


      {/* --- Action Forms Section (Rendered conditionally) --- */}
      <div style={{ marginTop: '20px' }}>
        {selectedUser ? (
          <>
            <Heading level={4} marginBottom="small">
              Actions for User: {getUserAttribute(selectedUser, 'custom:company_name') ?? selectedUser.username} ({selectedUser.sub})
            </Heading>
            <Flex direction="column" gap="medium">
              {/* These custom components are fine */}
              <ManageAccountStatus selectedOwnerSub={selectedUser.sub} />
              <AddCashReceiptForm selectedTargetSub={selectedUser.sub} />
            </Flex>
          </>
        ) : (
           <Text variation="tertiary">Please select a user from the list above to manage their status or add a cash receipt.</Text> // Keep Amplify Text
        )}
      </div>
      {/* --- End Action Forms --- */}

    </Flex>
  );
}

export default AdminPage;