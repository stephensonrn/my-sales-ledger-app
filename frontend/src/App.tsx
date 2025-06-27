// FILE: src/App.tsx (Corrected)

import React from 'react';
import {
  Authenticator,
  Button,
  Heading,
  View,
  Flex,
  useAuthenticator,
  Loader,
} from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';

import SalesLedger from './SalesLedger';
import AdminPage from './AdminPage';
import { useAdminAuth } from './hooks/useAdminAuth';

import './App.css';
import aurumLogo from '/Aurum.png';

const components = {
  Header() {
    return (
      <Heading level={3} padding="medium" textAlign="center">
        <img
          src={aurumLogo}
          alt="Aurum Logo"
          style={{
            height: '40px',
            marginRight: '10px',
            verticalAlign: 'middle',
          }}
        />
        Sales Ledger Application
      </Heading>
    );
  },
};

const formFields = {
    signUp: {
        'custom:company_name': {
            label: 'Company Name',
            placeholder: 'Enter your company name',
            isRequired: true,
            order: 1
        },
        email: {
            order: 2
        },
        password: {
            order: 3
        },
        confirm_password: {
            order: 4
        }
    }
};

function AuthenticatedContent() {
  const { user, signOut } = useAuthenticator((context) => [
    context.user,
    context.signOut,
  ]);
  const { isAdmin, isLoading: isAdminLoading, error: adminCheckError } = useAdminAuth();
  const displayName = user?.signInDetails?.loginId || user?.username || 'User';

  const isUserReady = !!(user && (user.attributes?.sub || user.userId));

  return (
    <View padding="medium">
      <Flex
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        style={{
          marginBottom: '20px',
          borderBottom: '1px solid #ccc',
          paddingBottom: '10px',
        }}
      >
        <Heading level={4}>Welcome {displayName}!</Heading>
        <Button onClick={signOut} variation="primary" size="small">
          Sign Out
        </Button>
      </Flex>

      {adminCheckError && (
        <div>Error checking user permissions: {adminCheckError.message}</div>
      )}

      <main>
        {!isUserReady || isAdminLoading ? (
          <Loader size="large" />
        ) : isAdmin ? (
          <AdminPage loggedInUser={user} />
        ) : (
          <SalesLedger loggedInUser={user} />
        )}
      </main>
    </View>
  );
}

function App() {
  return (
    <Authenticator
      loginMechanisms={['email']}
      signUpAttributes={['email', 'custom:company_name']}
      components={components}
      formFields={formFields}
    >
      <AuthenticatedContent />
    </Authenticator>
  );
}

export default App;