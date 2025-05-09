// frontend/src/amplify-config.ts

const amplifyConfig = {
    Auth: {
        Cognito: {
            userPoolId: 'eu-west-1_jIa2hOCaZ',       // <-- Your UserPoolIdOutput
            userPoolClientId: '3br2lv10rbfjt4v12j3lonemfm', // <-- Your UserPoolClientIdOutput
            // If you add an Identity Pool later for unauthenticated access or federated identities,
            // you would add its ID here, for example:
            // identityPoolId: 'eu-west-1:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
        }
    },
    // The API (AppSync) section will be added here later, once we define and deploy it with CDK.
    API: {
    GraphQL: {
    endpoint: 'https://yik7x25zqne6jnnzvymp5c3c7m.appsync-api.eu-west-1.amazonaws.com/graphql',
    region: 'eu-west-1', // Your RegionOutput
    defaultAuthMode: 'AMAZON_COGNITO_USER_POOLS' // Assuming this will be your default
    }
    }
};

export default amplifyConfig;