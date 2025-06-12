// frontend/src/amplify-config.ts
import { Amplify } from 'aws-amplify';

// NOTE: We no longer import 'Auth'. The configuration object's structure has changed.

Amplify.configure({
  // 1. Auth configuration is now nested under a 'Cognito' key.
  Auth: {
    Cognito: {
      region: 'eu-west-1',
      userPoolId: 'eu-west-1_jIa2hOCaZ',
      // NOTE: 'userPoolWebClientId' has been renamed to 'userPoolClientId'.
      userPoolClientId: '3br2lv10rbfjt4v12j3lonemfm',
      // The oauth block is now nested under 'loginWith'.
      loginWith: {
        oauth: {
          domain: 'auth.salesledgersync.com',
          // NOTE: 'scope' has been renamed to 'scopes' (plural).
          scopes: ['openid', 'email', 'profile', 'aws.cognito.signin.user.admin'],
          redirectSignIn: ['https://www.salesledgersync.com/'],
          redirectSignOut: ['https://www.salesledgersync.com/logout/'],
          responseType: 'code',
        },
      }
    }
  },
  // 2. API configuration is now nested under a 'GraphQL' key.
  API: {
    GraphQL: {
      endpoint: 'https://yik7x25zqne6jnnzvymp5c3c7m.appsync-api.eu-west-1.amazonaws.com/graphql',
      region: 'eu-west-1',
      // NOTE: 'AMAZON_COGNITO_USER_POOLS' is now simply 'userPool'.
      defaultAuthMode: 'userPool'
    }
  }
});

// 3. IMPORTANT: The 'graphql_headers' function is no longer needed.
// The new Amplify API client automatically attaches the user's session token
// to requests when 'defaultAuthMode' is set to 'userPool'.

// You can remove the export if you are importing this file for its side effects
// in your main entry point (e.g., import './amplify-config.ts'; in main.tsx).
// For clarity, we will remove the export.