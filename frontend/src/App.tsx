// src/App.tsx
import React from 'react';
import { Authenticator, Button, Heading, View, Flex, useAuthenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';

// Custom components & hooks
import SalesLedger from './SalesLedger';
import AdminPage from './AdminPage';
import { useAdminAuth } from './hooks/useAdminAuth'; // Ensure path is correct

// Custom CSS (optional)
import './App.css';

// Logo
import aurumLogo from '/Aurum.png';

// --- Authenticator Customization Objects ---
const formFields = {
  signIn: {
    username: { label: 'Email:', placeholder: 'Enter your email', type: 'email' },
  },
  signUp: {
    email: { order: 1 },
    'custom:company_name': {
      label: "Company Name:", placeholder: "Enter your company name", isRequired: true, order: 2,
    },
    password: { label: 'Password:', placeholder: 'Enter your password', order: 3 },
    confirm_password: { label: 'Confirm Password:', placeholder: 'Please confirm your password', order: 4 }
  },
};

const components = {
  Header() {
    return (
      <Heading level={3} padding="medium" textAlign="center">
        <img src={aurumLogo} alt="Aurum Logo" style={{ height: '40px', marginRight: '10px', verticalAlign: 'middle' }} />
        Sales Ledger Application
      </Heading>
    );
  },
};

// --- New Component Rendered ONLY When Authenticated ---
// Added 'user' as a prop
function AuthenticatedContent() {
  const { user, signOut } = useAuthenticator((context) => [context.user, context.signOut]);
  const { isAdmin, isLoading: isAdminLoading, error: adminCheckError } = useAdminAuth();

  if (adminCheckError) {
    console.error("Error checking admin status:", adminCheckError);
    return <div>Error checking user permissions. Please try again later.</div>;
  }

  return (
    <View padding="medium">
      {/* --- Simplified Header / Sign Out --- */}
      <Flex
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        style={{ marginBottom: '20px', borderBottom: '1px solid #ccc', paddingBottom: '10px' }}
      >
        <Heading level={4}>Welcome {user?.signInDetails?.loginId || user?.username || 'User'}!</Heading>
        {user && (
          <Button onClick={signOut} variation="primary" size="small">Sign Out</Button>
        )}
      </Flex>

      {/* --- Main Content Area (Conditional Rendering) --- */}
      <main>
        {isAdminLoading ? (
          <p>Verifying permissions...</p>
        ) : isAdmin ? (
          // User is Admin -> Render Admin Page, passing user
          <div>
            <AdminPage loggedInUser={user} /> {/* <--- MODIFIED */}
          </div>
        ) : (
          // User is NOT Admin -> Render Sales Ledger, passing user
          <SalesLedger loggedInUser={user} /> {/* <--- MODIFIED */}
        )}
      </main>
    </View>
  );
}

// --- Main App Component ---
function App() {
  return (
    <Authenticator loginMechanisms={['email']} formFields={formFields} components={components}>
      <AuthenticatedContent />
    </Authenticator>
  );
}

export default App;