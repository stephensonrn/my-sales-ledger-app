import {
  AppSyncResolverEvent,
  AppSyncIdentityCognito,
} from "aws-lambda";
import {
  CognitoIdentityProviderClient,
  ListUsersCommand,
  ListUsersCommandInput,
  ListUsersCommandOutput,
  AdminListGroupsForUserCommand,
  AdminListGroupsForUserCommandInput,
  UserType as CognitoSDKUserType, // Renamed to avoid conflict
  AttributeType,
} from "@aws-sdk/client-cognito-identity-provider"; // SDK v3

// Assuming these types are defined in '../../types'
interface UserAttributeGraphQL {
  name: string;
  value?: string | null;
}

type UserStatusType =
  | "UNCONFIRMED" | "CONFIRMED" | "ARCHIVED" | "COMPROMISED"
  | "UNKNOWN" | "RESET_REQUIRED" | "FORCE_CHANGE_PASSWORD";

interface CognitoUserGraphQL {
  id: string;
  username: string;
  sub: string;
  email?: string | null;
  status?: UserStatusType | string | null;
  enabled?: boolean | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  lastModifiedAt?: string | null;
  groups?: string[] | null;
  attributes?: UserAttributeGraphQL[] | null;
}

interface AdminListUsersLambdaResponse {
  users: CognitoUserGraphQL[];
  nextToken?: string | null;
}

// Your utility function
import { isAdmin } from "../../utils/auth";

const cognitoClient = new CognitoIdentityProviderClient({});

const getAttrValue = (attrs: AttributeType[] | undefined, attrName: string): string | undefined => {
  if (!attrs) return undefined;
  return attrs.find(attr => attr.Name === attrName)?.Value;
};

async function listUsersFromCognito(
  userPoolId: string,
  limit?: number,
  nextToken?: string,
  filterString?: string // Cognito ListUsers API Filter string
): Promise<ListUsersCommandOutput> { // Returns the direct SDK output
  console.log(`listUsersFromCognito called with: limit=${limit}, nextToken=${nextToken}, filter=${filterString}`);
  
  const params: ListUsersCommandInput = {
    UserPoolId: userPoolId,
    Limit: limit,
    PaginationToken: nextToken,
    Filter: filterString,
  };

  try {
    const command = new ListUsersCommand(params);
    const data = await cognitoClient.send(command);
    return data;
  } catch (error) {
    console.error("Error listing users from Cognito:", error);
    throw error;
  }
}

async function getGroupsForUser(userPoolId: string, username: string): Promise<string[]> {
  console.log(`Fetching groups for user ${username} in pool ${userPoolId}`);
  const params: AdminListGroupsForUserCommandInput = {
    UserPoolId: userPoolId,
    Username: username,
  };
  try {
    const command = new AdminListGroupsForUserCommand(params);
    const data = await cognitoClient.send(command);
    return data.Groups?.map(g => g.GroupName!).filter(Boolean) ?? [];
  } catch (error) {
    console.error(`Error fetching groups for user ${username}:`, error);
    return []; // Return empty on error or handle as needed
  }
}

export const handler = async (
  event: AppSyncResolverEvent<{ limit?: number; nextToken?: string; filter?: any }, any> // More specific input type
): Promise<AdminListUsersLambdaResponse> => {
  console.log("LAMBDA EVENT (adminListUsers):", JSON.stringify(event, null, 2));

  const cognitoIdentity = event.identity as AppSyncIdentityCognito | undefined;
  console.log("EVENT.IDENTITY.GROUPS (adminListUsers):", JSON.stringify(cognitoIdentity?.groups, null, 2));

  if (!cognitoIdentity?.groups || !isAdmin(cognitoIdentity.groups)) {
    console.error("Authorization failed. User groups:", JSON.stringify(cognitoIdentity?.groups));
    throw new Error("Unauthorized: Admin access required");
  }

  const userPoolId = process.env.USER_POOL_ID;
  if (!userPoolId) {
    console.error("USER_POOL_ID environment variable is not set.");
    throw new Error("Configuration error: User Pool ID is missing.");
  }

  const args = event.arguments?.payload || event.arguments || {}; // Handle if payload wrapper isn't used or direct args
  const limit = args.limit;
  const nextTokenArg = args.nextToken;
  
  // Construct Cognito Filter string from args.filter (this is complex and specific to your filter needs)
  // Example: if args.filter is { usernamePrefix: "test" }, translate to `username ^= "test"`
  // For now, passing filter directly if your VTL still sends it as a map; SDK expects a string.
  // This part likely needs adjustment based on how your VTL sends 'filter' and how Cognito API expects it.
  // If filter is an object from VTL: you'd need to build the Cognito filter string.
  // If VTL sends a pre-formatted string, use that. For now, assume filter is not directly usable or not implemented.
  let cognitoFilterString: string | undefined = undefined;
  if (args.filter && typeof args.filter === 'object') {
    // Example: simple username prefix filter if filter = { usernamePrefix: "..." }
    if (args.filter.username && args.filter.username.beginsWith) {
        cognitoFilterString = `username ^= "${args.filter.username.beginsWith}"`;
    } else if (args.filter.email && args.filter.email.eq) {
        cognitoFilterString = `email = "${args.filter.email.eq}"`;
    }
    // Add more complex filter string construction based on args.filter structure
    console.log("Constructed Cognito Filter String:", cognitoFilterString);
  }


  console.log(`Lambda called with limit: ${limit}, nextToken: ${nextTokenArg}, Cognito filter: ${cognitoFilterString}`);

  const cognitoResponse = await listUsersFromCognito(userPoolId, limit, nextTokenArg, cognitoFilterString);

  const mappedUsers: CognitoUserGraphQL[] = [];
  if (cognitoResponse.Users) {
    for (const cognitoUser of cognitoResponse.Users) {
      if (!cognitoUser || !cognitoUser.Username) continue;

      const attributes = cognitoUser.Attributes || [];
      const sub = getAttrValue(attributes, "sub") ?? cognitoUser.Username;
      const email = getAttrValue(attributes, "email");
      
      const groups = await getGroupsForUser(userPoolId, cognitoUser.Username); // Call for each user

      mappedUsers.push({
        id: sub,
        username: cognitoUser.Username,
        sub: sub,
        email: email ?? undefined,
        status: (cognitoUser.UserStatus as UserStatusType) ?? undefined,
        enabled: cognitoUser.Enabled ?? undefined,
        createdAt: cognitoUser.UserCreateDate?.toISOString() ?? undefined,
        updatedAt: cognitoUser.UserLastModifiedDate?.toISOString() ?? undefined,
        lastModifiedAt: cognitoUser.UserLastModifiedDate?.toISOString() ?? undefined,
        groups: groups.length > 0 ? groups : undefined,
        attributes: attributes
          .filter(attr => attr.Name !== undefined)
          .map(attr => ({
            name: attr.Name!,
            value: attr.Value ?? null,
          })),
      });
    }
  }
  
  console.log("LAMBDA MAPPED USERS (adminListUsers) count:", mappedUsers.length);

return {
  users: mappedUsers,
  nextToken: cognitoResponse.PaginationToken || null,
};
};