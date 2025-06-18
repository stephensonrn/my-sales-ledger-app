// main.tsx or index.tsx

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { OidcProvider } from 'react-oidc-context';
import { oidcConfig } from './oidc-config';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <OidcProvider configuration={oidcConfig}>
      <App />
    </OidcProvider>
  </React.StrictMode>
);
