import { Amplify } from 'aws-amplify';

Amplify.configure({
  aws_project_region: import.meta.env.VITE_AWS_PROJECT_REGION,
  aws_appsync_graphqlEndpoint: import.meta.env.VITE_APPSYNC_ENDPOINT,
  aws_appsync_region: import.meta.env.VITE_APPSYNC_REGION,
  aws_appsync_authenticationType: import.meta.env.VITE_AUTH_TYPE,
  aws_cognito_region: import.meta.env.VITE_AWS_PROJECT_REGION,
  aws_user_pools_id: import.meta.env.VITE_USER_POOL_ID,
  aws_user_pools_web_client_id: import.meta.env.VITE_USER_POOL_CLIENT_ID,
  oauth: {
    domain: import.meta.env.VITE_COGNITO_DOMAIN,
    scope: ['openid', 'email', 'profile'],
    redirectSignIn: import.meta.env.VITE_REDIRECT_SIGN_IN,
    redirectSignOut: import.meta.env.VITE_REDIRECT_SIGN_OUT,
    responseType: 'code',
  },
});
