// FILE: src/main.tsx (Corrected)

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';

import { Amplify } from 'aws-amplify';

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.VITE_USER_POOL_ID,
      userPoolClientId: import.meta.env.VITE_USER_POOL_CLIENT_ID,
      identityPoolId: import.meta.env.VITE_IDENTITY_POOL_ID, // Uses the new variable
    }
  },
  API: {
    GraphQL: {
      endpoint: import.meta.env.VITE_APPSYNC_ENDPOINT,
      region: import.meta.env.VITE_AWS_PROJECT_REGION,
      defaultAuthMode: 'userPool'
    }
  },
  Storage: {
    S3: {
      bucket: import.meta.env.VITE_S3_BUCKET, // Uses the new variable
      region: import.meta.env.VITE_AWS_PROJECT_REGION,
    }
  }
});


ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
