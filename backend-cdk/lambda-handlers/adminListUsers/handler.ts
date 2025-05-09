// lambda-handlers/adminListUsers/handler.ts

import { CognitoIdentityProviderClient, ListUsersCommand, ListUsersCommandInput, UserType, AttributeType } from "@aws-sdk/client-cognito-identity-provider";
import type { AppSyncResolverEvent } from 'aws-lambda'; // Use AppSync specific event type

// Define the expected shape of the arguments coming from AppSync
interface AdminListUsersArgs {
    limit?: number | null;      // GraphQL Int maps to number | null
    nextToken?: string | null; // GraphQL String maps to string | null
}

// Define the structure for the attributes array we return via GraphQL
interface UserAttributeGraphQL {
  name: string;
  value?: string | null; // Value can be null or undefined
}

// Define the structure for the user object we return via GraphQL
interface CognitoUserGraphQL {
  username: string;
  sub: string;
  status?: string | null;
  enabled?: boolean | null;
  createdAt?: string | null; // AWSDateTime maps to string (ISO 8601)
  updatedAt?: string | null; // AWSDateTime maps to string (ISO 8601)
  attributes?: UserAttributeGraphQL[] | null; // Make list potentially null
}

// Define the final result structure matching the GraphQL schema
interface UserListResultGraphQL {
  users: CognitoUserGraphQL[] | null; // List can be null if error or empty
  nextToken?: string | null;
}

const client = new CognitoIdentityProviderClient({}); // Client automatically uses region from Lambda environment
const userPoolId = process.env.USER_POOL_ID; // Get User Pool ID from environment variables set by CDK

export const handler = async (
  event: AppSyncResolverEvent<AdminListUsersArgs>
): Promise<UserListResultGraphQL> => { // Return type matching GraphQL schema

  console.log(`Received event arguments: ${JSON.stringify(event.arguments)}`);

  if (!userPoolId) {
      console.error("FATAL: USER_POOL_ID environment variable not set.");
      // Throw an error that AppSync can report back to the client
      throw new Error("Internal configuration error. Please contact support.");
  }

  // Use arguments passed from the AppSync query, provide defaults
  const limit = event.arguments.limit ?? 25;
  const paginationToken = event.arguments.nextToken ?? undefined; // Use undefined if null/not present

  // Define which attributes we want Cognito to return for each user
// --- MODIFICATION START ---
    const params: ListUsersCommandInput = {
        UserPoolId: userPoolId,
        Limit: limit,
        PaginationToken: paginationToken,
        // AttributesToGet: [...] // REMOVE OR COMMENT OUT THIS LINE
    };
    // --- MODIFICATION END ---
  // Note: 'enabled' and 'UserStatus' are properties of the UserType, not in the Attributes array usually.
  console.log("Calling Cognito ListUsers with params:", JSON.stringify(params));

  try {
      const command = new ListUsersCommand(params);
      const response = await client.send(command);

      console.log(`Cognito ListUsers successful. Found ${response.Users?.length ?? 0} users.`);

      // Map the Cognito UserType[] to our GraphQL CognitoUserGraphQL[]
      const usersGraphQL: CognitoUserGraphQL[] = (response.Users || []).map((cognitoUser: UserType) => {

            // Helper to extract a specific attribute value
            const getAttrValue = (name: string): string | undefined => {
                return cognitoUser.Attributes?.find(attr => attr.Name === name)?.Value;
            };

            const sub = getAttrValue("sub");

            // Basic check - skip user if 'sub' wasn't returned for some reason
            if (!sub) {
                console.warn(`Skipping user ${cognitoUser.Username} because 'sub' attribute was missing.`);
                return null; // Will be filtered out later
            }

            // Map all Cognito attributes to the GraphQL structure
            const mappedAttributes: UserAttributeGraphQL[] = (cognitoUser.Attributes || [])
                .filter(attr => attr.Name !== undefined) // Ensure Name exists
                .map((attr: AttributeType) => ({
                    name: attr.Name!, // Use non-null assertion as we filtered
                    value: attr.Value ?? null, // Pass null if value is undefined
                }));

            return {
              username: cognitoUser.Username ?? '', // Primary Cognito identifier
              sub: sub,                           // The unique immutable ID
              status: cognitoUser.UserStatus ?? null,
              enabled: cognitoUser.Enabled ?? null,
              createdAt: cognitoUser.UserCreateDate?.toISOString() ?? null,
              updatedAt: cognitoUser.UserLastModifiedDate?.toISOString() ?? null,
              attributes: mappedAttributes,
            };
      }).filter(user => user !== null) as CognitoUserGraphQL[]; // Filter out any nulls from mapping issues

      // Return the result matching the GraphQL UserListResult type
      return {
          users: usersGraphQL,
          nextToken: response.PaginationToken ?? null // Return null if no more pages
      };

  } catch (error: any) { // Catch errors during the Cognito API call
      console.error("Error calling Cognito ListUsers API:", error);
      // Throw an error that AppSync can report back
      throw new Error(`Failed to list users from Cognito: ${error.message}`);
  }
};