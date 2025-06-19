export const oidcConfig = {
  authority: 'https://auth.salesledgersync.com',
  client_id: '28889re05prqhvu9kr7g5jtdid',
  redirect_uri: 'https://www.salesledgersync.com',
  post_logout_redirect_uri: 'https://www.salesledgersync.com',
  response_type: 'code',
  scope: 'aws.cognito.signin.user.admin email openid phone profile',
  metadataUrl: 'https://auth.salesledgersync.com/.well-known/openid-configuration'
};
