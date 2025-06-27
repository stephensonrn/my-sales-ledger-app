// FILE: src/main.tsx (Corrected)
// ==========================================================

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';

import { Amplify } from 'aws-amplify';

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: 'eu-west-1_i09IJ2ySB',
      userPoolClientId: '28889re05prqhvu9kr7g5jtdid',
      // --- THIS IS THE FIX (Part 1): Update the Identity Pool ID ---
      identityPoolId: 'StorageResourcesIdentityPoolIdOutput9FD92B67',
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
      // --- THIS IS THE FIX (Part 2): Update the S3 Bucket Name ---
      bucket: 'StorageResourcesStorageBucketNameOutput26F3A9CC',
      region: 'eu-west-1',
    }
  }
});


ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
