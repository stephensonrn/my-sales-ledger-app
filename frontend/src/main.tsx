// frontend/src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App'; // Your main App component
import './index.css';    // Your global styles

import { Amplify } from 'aws-amplify';      // Import Amplify
import amplifyConfig from './amplify-config'; // Import your new config

Amplify.configure(amplifyConfig); // Configure Amplify library with your backend details

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);