// frontend/src/amplify-config.ts
import { Auth } from 'aws-amplify';

const amplifyConfig = {
  Auth: {
    region: 'eu-west-1',
    userPoolId: 'eu-west-1_jIa2hOCaZ',
    userPoolWebClientId: '3br2lv10rbfjt4v12j3lonemfm',
    oauth: {
      domain: 'auth.salesledgersync.com',
      scope: ['openid', 'email', 'profile', 'aws.cognito.signin.user.admin'],
      redirectSignIn: 'https://www.salesledgersync.com/',
      redirectSignOut: 'https://www.salesledgersync.com/logout/',
      responseType: 'code',
    },
  },
  API: {
    graphql_endpoint: 'https://yik7x25zqne6jnnzvymp5c3c7m.appsync-api.eu-west-1.amazonaws.com/graphql',
    graphql_headers: async () => ({
      Authorization: (await Auth.currentSession()).getIdToken().getJwtToken(),
    }),
    region: 'eu-west-1',
    defaultAuthMode: 'AMAZON_COGNITO_USER_POOLS',
  },
};

export default amplifyConfig;
