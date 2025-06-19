export const oidcConfig = {
  authority: 'https://eu-west-1i09ij2ysb.auth.eu-west-1.amazoncognito.com',
  client_id: '28889re05prqhvu9kr7g5jtdid',
  redirect_uri: 'https://www.salesledgersync.com',
  post_logout_redirect_uri: 'https://www.salesledgersync.com',
  response_type: 'code',
  scope: 'aws.cognito.signin.user.admin email openid phone profile',
  metadataUrl: 'https://auth.salesledgersync.com/.well-known/openid-configuration'
};
