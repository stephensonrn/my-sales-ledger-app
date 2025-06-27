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
      // --- THIS IS THE FIX: This line links Auth to the Identity Pool ---
      identityPoolId: 'eu-west-1:6cb99421-7e61-40e5-bfab-cd80f1c6338a',
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
      bucket: 'salesledgerapp-backend-eu-storageresourcessalesled-rtys52eiwe9j',
      region: 'eu-west-1',
    }
  }
});


ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)