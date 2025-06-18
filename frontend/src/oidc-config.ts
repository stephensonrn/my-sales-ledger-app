// src/oidc-config.ts
export const oidcConfig = {
  authority: 'https://auth.salesledgersync.com', // your Cognito domain
  client_id: '28889re05prqhvu9kr7g5jtdid',
  redirect_uri: 'https://www.salesledgersync.com', // or http://localhost:5173
  post_logout_redirect_uri: 'https://www.salesledgersync.com',
  response_type: 'code',
  scope: 'openid profile email',
};
