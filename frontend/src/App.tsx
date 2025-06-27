// src/App.tsx
import React, { useState, useEffect } from 'react'; // Import useState and useEffect
import {
  Authenticator,
  Button,
  Heading,
  View,
  Flex,
  useAuthenticator,
  Loader,
  Text,
  Icon,
} from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import { fetchUserAttributes } from 'aws-amplify/auth'; // Import fetchUserAttributes

import SalesLedger from './SalesLedger';
import AdminPage from './AdminPage';
import { useAdminAuth } from './hooks/useAdminAuth';

import './App.css';
import aurumLogo from '/Aurum.png';
import { MdEmail, MdPhone } from 'react-icons/md';

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
  
  // --- THIS IS THE FIX (Part 1): Add state for the company name ---
  const [companyName, setCompanyName] = useState<string | null>(null);

  // --- THIS IS THE FIX (Part 2): Fetch attributes when the user object is available ---
  useEffect(() => {
    const getAttributes = async () => {
        try {
            const attributes = await fetchUserAttributes();
            setCompanyName(attributes['custom:company_name'] || user?.username || 'User');
        } catch (e) {
            // Fallback to username if attributes can't be fetched
            setCompanyName(user?.username || 'User');
        }
    };

    if (user) {
        getAttributes();
    }
  }, [user]); // This effect runs whenever the user object changes

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
        {/* --- THIS IS THE FIX (Part 3): Display the company name from state --- */}
        <Heading level={4}>{companyName || <Loader size="small" />}</Heading>
        
        <Flex direction="row" alignItems="center" gap="large">
            <Flex as="a" href="mailto:ross@aurumif.com" alignItems="center" gap="xs" style={{textDecoration: 'none', color: 'inherit'}}>
                <Icon as={MdEmail} />
                <Text>ross@aurumif.com</Text>
            </Flex>
            <Flex alignItems="center" gap="xs">
                <Icon as={MdPhone} />
                <Text>02477 298 113</Text>
            </Flex>
            <Button onClick={signOut} variation="primary" size="small">
                Sign Out
            </Button>
        </Flex>

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
