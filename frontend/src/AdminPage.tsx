// src/AdminPage.tsx
import React, { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/api';
import {
  Flex,
  Heading,
  Text,
  Button,
  Loader,
  Card,
  Badge,
  View, // Added View for better layout control if needed
  Alert
} from '@aws-amplify/ui-react';

// Import generated query and types
import { AdminListUsersDocument } from './graphql/generated/graphql'; // Verify exact export name
import type { CognitoUser, AdminListUsersQuery } from './graphql/generated/graphql'; // Verify exact export names

// Import child components
import ManageAccountStatus from './ManageAccountStatus';
import AddCashReceiptForm from './AddCashReceiptForm';
import SalesLedger from './SalesLedger'; // <<< --- ADD THIS IMPORT

const client = generateClient();
const USERS_PER_PAGE = 10;

function AdminPage() {
  const [users, setUsers] = useState<CognitoUser[]>([]);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [isLoadingUsers, setIsLoadingUsers] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<CognitoUser | null>(null);

  const fetchUsers = async (token: string | null = null) => {
    if (isLoadingUsers && !token) return; // Allow fetching more even if initial load is happening for "Load More"
    setIsLoadingUsers(true);
    setFetchError(null);
    // Don't clear selectedUser here if just loading more. Clear when fetching initial list (token is null).
    if (!token) { 
        setSelectedUser(null); 
        setUsers([]); // Clear previous users on initial fetch/refresh
    }


    console.log(`AdminPage: Fetching users... ${token ? 'nextToken: ' + token.substring(0, 10) + '...' : 'Initial fetch'}`);
    try {
      const response = await client.graphql<AdminListUsersQuery>({
        query: AdminListUsersDocument,
        variables: {
          limit: USERS_PER_PAGE,
          nextToken: token
        },
        authMode: 'userPool' // Ensure admin user has permissions for this query
      });

      const resultData = response.data?.adminListUsers;
      const fetchedUsers = resultData?.users?.filter(u => u !== null) as CognitoUser[] || [];
      const paginationToken = resultData?.nextToken ?? null;

      if (response.errors) {
        console.error("AdminPage: GraphQL errors while fetching users:", response.errors);
        throw response.errors; // Let the catch block handle it
      }

      setUsers(prevUsers => token ? [...prevUsers, ...fetchedUsers] : fetchedUsers);
      setNextToken(paginationToken);

    } catch (err: any) {
      console.error("AdminPage: Error listing users:", err);
      let errorMessages = 'Unknown error listing users';
      if (err.errors && Array.isArray(err.errors)) { // GraphQL errors array
        errorMessages = err.errors.map((e: any) => e.message).join(', ');
      } else if (err.message) { // Standard JavaScript error
        errorMessages = err.message;
      }
      setFetchError(errorMessages);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  useEffect(() => {
    fetchUsers(); // Initial fetch
  }, []);

  const handleUserSelect = (user: CognitoUser) => {
    // Toggle selection: if same user is clicked, deselect. Otherwise, select new user.
    setSelectedUser(prevSelected => (prevSelected?.sub === user.sub ? null : user));
  };

  const getUserAttribute = (user: CognitoUser | null, attributeName: string): string | undefined => {
    if (!user || !user.attributes) return undefined;
    return user.attributes.find(attr => attr?.name === attributeName)?.value ?? undefined;
  };

  // Basic styles for HTML table
  const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', marginTop: '10px', fontSize: '0.9em' };
  const thTdStyle: React.CSSProperties = { border: '1px solid #ccc', padding: '8px', textAlign: 'left' }; // Increased padding
  const selectedRowStyle: React.CSSProperties = { backgroundColor: '#e6f7ff', fontWeight: 'bold' };

  return (
    <Flex direction="column" gap="large" padding="medium"> {/* Added padding to main Flex */}
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
              {!isLoadingUsers && users.length === 0 && !fetchError && (
                  <tr key="no-users-row"><td colSpan={5} style={{...thTdStyle, textAlign: 'center'}}><Text>No users found.</Text></td></tr>
              )}
              {users.map((user) => {
                  if (!user || !user.sub) return null; // Ensure user and user.sub exist
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
              {isLoadingUsers && users.length === 0 && ( // Show loader only if loading initial list
                  <tr key="loader-row"><td colSpan={5} style={{ ...thTdStyle, textAlign: 'center' }}><Loader /></td></tr>
              )}
            </tbody>
          </table>
        </View>
        {nextToken && !isLoadingUsers && (
          <Button onClick={() => fetchUsers(nextToken)} marginTop="small" isFullWidth={false}>Load More Users</Button>
        )}
         {isLoadingUsers && users.length > 0 && <Loader marginTop="small"/>} {/* Loader for "Load More" */}
      </Card>

      <View marginTop="large"> {/* Changed from div to View for consistency */}
        {selectedUser && selectedUser.sub ? ( // Ensure selectedUser and selectedUser.sub exist
          <>
            <Heading level={3} marginBottom="medium"> {/* Changed to level 3 */}
              Managing User: {getUserAttribute(selectedUser, 'custom:company_name') ?? getUserAttribute(selectedUser, 'email') ?? selectedUser.username} 
              <Text as="span" fontSize="small" color="font.tertiary"> (ID: {selectedUser.sub})</Text>
            </Heading>
            
            <Flex direction="column" gap="large"> {/* Increased gap for sections */}
              {/* Existing Action Components */}
              <Card variation="elevated"> {/* Optional: Wrap in Card */}
                <Heading level={4} marginBottom="small">Manage Account Status</Heading>
                <ManageAccountStatus 
                    selectedOwnerSub={selectedUser.sub} 
                    targetUserName={getUserAttribute(selectedUser, 'custom:company_name') ?? selectedUser.username} 
                />
              </Card>
              
              <Card variation="elevated"> {/* Optional: Wrap in Card */}
                <Heading level={4} marginBottom="small">Add Cash Receipt</Heading>
                <AddCashReceiptForm selectedTargetSub={selectedUser.sub} />
              </Card>

              {/* --- NEW: Display Sales Ledger for the selected user --- */}
              <Card variation="elevated" marginTop="medium"> {/* Optional: Wrap in Card, added marginTop */}
                <Heading level={4} marginBottom="small">Ledger Details</Heading> {/* Changed to level 4 */}
                <SalesLedger 
                  targetUserId={selectedUser.sub} 
                  isAdmin={true} // Explicitly pass true as this is the AdminPage
                />
              </Card>
              {/* --- END NEW --- */}
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