// frontend/src/amplify-config.ts

const amplifyConfig = {
    Auth: {
        Cognito: {
            userPoolId: 'eu-west-1_jIa2hOCaZ',      // Your UserPoolIdOutput
            userPoolClientId: '3br2lv10rbfjt4v12j3lonemfm', // Your UserPoolClientIdOutput
            // identityPoolId: 'eu-west-1:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', // Optional

            // Configure Hosted UI with custom domain
            loginWith: {
                oauth: {
                    domain: 'auth.salesledgersync.com', // YOUR NEW COGNITO CUSTOM DOMAIN
                    scopes: ['openid', 'email', 'profile', 'aws.cognito.signin.user.admin'], // Match scopes in App Client
                    redirectSignIn: ['https://www.salesledgersync.com/'], // Main app URL after sign-in (ensure this is in Cognito App Client settings)
                    redirectSignOut: ['https://www.salesledgersync.com/logout/'], // App URL after sign-out (ensure this is in Cognito App Client settings and your app handles /logout)
                    responseType: 'code' // Standard for Hosted UI
                }
            }, // Note: Ensure a comma is here if more Cognito properties followed, but it's the last one in Cognito block.
        } // End of Cognito object
    }, // End of Auth object, comma needed before API if API is next (which it is)
    API: { // API section IS present and populated, so the old comment can be removed
        GraphQL: {
            endpoint: 'https://yik7x25zqne6jnnzvymp5c3c7m.appsync-api.eu-west-1.amazonaws.com/graphql', // Your AppSync Endpoint
            region: 'eu-west-1', // Your RegionOutput
            defaultAuthMode: 'AMAZON_COGNITO_USER_POOLS' // Correct auth mode
            // modelIntrospection: true, // Only needed if using Amplify DataStore features with aws-amplify/data client
        }
    } // End of API object
}; // <-- CORRECTED: Removed one extra '}' from your pasted code '}}; '

export default amplifyConfig;