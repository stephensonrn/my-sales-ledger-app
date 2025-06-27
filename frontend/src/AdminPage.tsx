// FILE: src/AdminPage.tsx (Corrected)
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
    if (!client) return;
    setIsLoadingUsers(true);
    setFetchError(null);

    if (!token) {
      setSelectedUser(null);
      setUsers([]);
    }

    try {
      const response = await client.graphql<AdminListUsersQuery>({
        query: adminListUsers,
        variables: { limit: USERS_PER_PAGE, nextToken: token },
      });

      const resultData = response.data?.adminListUsers;
      const fetchedUsers = (resultData?.users?.filter(Boolean) as CognitoUser[]) || [];
      const paginationToken = resultData?.nextToken ?? null;
      
      const loggedInUserId = loggedInUser.userId || loggedInUser.attributes?.sub;
      const nonAdminUsers = fetchedUsers.filter(user => {
          if (user.sub === loggedInUserId) return false;
          const isAdminGroupMember = user.groups?.some(group => group?.toLowerCase() === 'admin');
          return !isAdminGroupMember;
      });

      setUsers(prevUsers => token ? [...prevUsers, ...nonAdminUsers] : nonAdminUsers);
      setNextToken(paginationToken);
    } catch (err: any) {
      const errorMessages = err.errors?.map((e: any) => e.message).join(', ') || err.message || 'Unknown error';
      setFetchError(errorMessages);
    } finally {
      setIsLoadingUsers(false);
    }
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

  const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', marginTop: '10px', fontSize: '0.9em' };
  const thTdStyle: React.CSSProperties = { border: '1px solid #ccc', padding: '8px', textAlign: 'left' };
  const selectedRowStyle: React.CSSProperties = { backgroundColor: '#e6f7ff', fontWeight: 'bold' };

  return (
    <Flex direction="column" gap="large" padding="medium">
      <Heading level={2}>Admin Section</Heading>
      <Card variation="outlined">
        <Heading level={4} marginBottom="medium">Select User to Manage</Heading>
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
                <tr key="loader-row"><td colSpan={5} style={{ ...thTdStyle, textAlign: 'center' }}><Loader /></td></tr>
              )}
              {!isLoadingUsers && users.length === 0 && !fetchError && (
                <tr key="no-users-row"><td colSpan={5} style={{ ...thTdStyle, textAlign: 'center' }}><Text>No non-admin users found.</Text></td></tr>
              )}
              {users.map((user) => (
                  <tr key={user.sub} style={selectedUser?.sub === user.sub ? selectedRowStyle : undefined}>
                    <td style={thTdStyle}>{getUserAttribute(user, 'email') ?? user.username ?? '-'}</td>
                    <td style={thTdStyle}>{getUserAttribute(user, 'custom:company_name') ?? '-'}</td>
                    <td style={thTdStyle}><Badge variation={user.enabled ? 'success' : 'info'}>{user.status}</Badge></td>
                    <td style={thTdStyle}><code>{user.sub}</code></td>
                    <td style={thTdStyle}>
                      <Button size="small" variation={selectedUser?.sub === user.sub ? 'primary' : 'link'} onClick={() => handleUserSelect(user)}>
                        {selectedUser?.sub === user.sub ? 'Selected' : 'Select'}
                      </Button>
                    </td>
                  </tr>
              ))}
            </tbody>
          </table>
        </View>
        {nextToken && !isLoadingUsers && (
          <Button onClick={() => fetchUsers(nextToken)} marginTop="small">Load More Users</Button>
        )}
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