import React from 'react';
import { useOidc, useOidcUser } from 'react-oidc-context';
import { Button, Heading, View, Flex } from '@aws-amplify/ui-react';

import SalesLedger from './SalesLedger';
import AdminPage from './AdminPage';
import { useAdminAuth } from './hooks/useAdminAuth';

import './App.css';
import aurumLogo from '/Aurum.png';

function App() {
  const oidc = useOidc();
  const oidcUser = useOidcUser();

  const { isAdmin, isLoading: isAdminLoading, error: adminCheckError } = useAdminAuth();

  if (oidc.isLoading) return <div>Loading authentication...</div>;
  if (oidc.error) return <div>Authentication error: {oidc.error.message}</div>;

  if (!oidcUser || !oidcUser.profile) {
    return (
      <View padding="medium" textAlign="center">
        <Heading level={3}>Welcome to Sales Ledger</Heading>
        <Button onClick={() => oidc.signinRedirect()} variation="primary">Login</Button>
      </View>
    );
  }

  const displayName = oidcUser.profile.name || oidcUser.profile.email || 'User';

  return (
    <View padding="medium">
      <Flex
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        style={{ marginBottom: '20px', borderBottom: '1px solid #ccc', paddingBottom: '10px' }}
      >
        <Heading level={4}>Welcome {displayName}!</Heading>
        <Button onClick={() => oidc.signoutRedirect()} variation="primary" size="small">
          Sign Out
        </Button>
      </Flex>

      {adminCheckError && (
        <div>Error checking user permissions: {adminCheckError.message}</div>
      )}

      <main>
        {isAdminLoading ? (
          <p>Verifying permissions...</p>
        ) : isAdmin ? (
          <AdminPage loggedInUser={oidcUser.profile} />
        ) : (
          <SalesLedger loggedInUser={oidcUser.profile} />
        )}
      </main>
    </View>
  );
}

export default App;
