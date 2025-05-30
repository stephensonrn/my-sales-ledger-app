// Types for GraphQL input arguments
export interface AdminListUsersArgs {
  limit?: number;
  nextToken?: string | null;
}

// User attribute type used in GraphQL schema
export interface UserAttributeGraphQL {
  name: string;
  value: string | null;
}

// User type returned in GraphQL schema
export interface CognitoUserGraphQL {
  username: string;
  sub: string;
  status: string | null;
  enabled: boolean | null;
  createdAt: string | null;
  updatedAt: string | null;
  attributes: UserAttributeGraphQL[];
}

// Result type for the list users query
export interface UserListResultGraphQL {
  users: CognitoUserGraphQL[];
  nextToken: string | null;
}

// Helper function to check if user is admin based on groups
export function isAdmin(groups?: string[] | null): boolean {
  const ADMIN_GROUP_NAME = process.env.ADMIN_GROUP_NAME || "Admin";
  return !!groups?.includes(ADMIN_GROUP_NAME);
}
