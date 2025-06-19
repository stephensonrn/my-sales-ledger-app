// src/App.tsx
import React from 'react';
import { Amplify } from 'aws-amplify'; // <-- 1. IMPORT Amplify
import {
  Authenticator,
  Button,
  Heading,
  View,
  Flex,
  useAuthenticator,
} from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';

import SalesLedger from './SalesLedger';
import AdminPage from './AdminPage';
import { useAdminAuth } from './hooks/useAdminAuth';

import './App.css';
import aurumLogo from '/Aurum.png';


// --- ✅ 2. ADD THIS ENTIRE CONFIGURATION BLOCK ---
// This block connects your frontend code to your specific AWS backend resources.
Amplify.configure({
  Auth: {
    Cognito: {
      // You must get these EXACT values from your CDK output or AWS Cognito Console
      userPoolId: 'eu-west-1_i09IJ2ySB',
      userPoolClientId: '28889re05prqhvu9kr7g5jtdid',
    }
  },
  API: {
    GraphQL: {
      // This is the endpoint from your error message
      endpoint: 'https://bpadgzbx75dtxahgvbii2q7hjy.appsync-api.eu-west-1.amazonaws.com/graphql',
      region: 'eu-west-1',
      // This tells the API client to use the logged-in user's token for every request
      defaultAuthMode: 'userPool'
    }
  }
});
// ----------------------------------------------------


const components = {
  Header() {
    // ... (rest of your file is unchanged)
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

function AuthenticatedContent() {
  // ... (rest of your file is unchanged)
  const { user, signOut } = useAuthenticator((context) => [
    context.user,
    context.signOut,
  ]);

  const { isAdmin, isLoading: isAdminLoading, error: adminCheckError } =
    useAdminAuth();

  const displayName =
    user?.signInDetails?.loginId || user?.username || 'User';

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
        {isAdminLoading ? (
          <p>Verifying permissions...</p>
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
      signUpAttributes={['email']}
      components={components}
    >
      <AuthenticatedContent />
    </Authenticator>
  );
}

export default App;