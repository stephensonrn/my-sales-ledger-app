// FILE: src/main.tsx (Corrected)
// ==========================================================

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// --- THIS IS THE FIX (Part 1): Configure Amplify here, at the root of the app ---
import { Amplify } from 'aws-amplify';

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: 'eu-west-1_i09IJ2ySB',
      userPoolClientId: '28889re05prqhvu9kr7g5jtdid',
    }
  },
  API: {
    GraphQL: {
      endpoint: 'https://yautw6qiynh6hpbrkbltyexwpq.appsync-api.eu-west-1.amazonaws.com/graphql',
      region: 'eu-west-1',
      defaultAuthMode: 'userPool'
    }
  },
  Storage: {
    S3: {
      // Use the outputs from your CDK stack for these values
      bucket: 'salesledgerapp-backend-eu-storageresourcessalesled-rtys52eiwe9j',
      region: 'eu-west-1',
      identityPoolId: 'eu-west-1:6cb99421-7e61-40e5-bfab-cd80f1c6338a'
    }
  }
});


ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)