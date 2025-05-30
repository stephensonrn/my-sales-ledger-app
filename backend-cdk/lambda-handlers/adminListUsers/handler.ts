import {
  AppSyncResolverEvent,
  AppSyncIdentityCognito,
} from "aws-lambda";

import {
  CognitoUserGraphQL,
  UserStatusType,
  UserAttributeGraphQL,
} from "../../types";

import { isAdmin } from "../../utils/auth"; // Your admin check function

interface ListUsersResponse {
  Users?: Array<{
    Username?: string;
    Attributes?: { Name?: string; Value?: string }[];
    UserStatus?: string;
    Enabled?: boolean;
    UserCreateDate?: Date;
    UserLastModifiedDate?: Date;
  } | null>;
}

export const handler = async (
  event: AppSyncResolverEvent<any>
): Promise<CognitoUserGraphQL[]> => {
  // Narrow identity to Cognito to safely access groups
  const cognitoIdentity = event.identity as AppSyncIdentityCognito | undefined;

  if (!cognitoIdentity?.groups || !isAdmin(cognitoIdentity.groups)) {
    throw new Error("Unauthorized: Admin access required");
  }

  // Simulated response - replace with your actual AWS Cognito SDK call
  const response: ListUsersResponse = await fakeListUsers();

  const usersGraphQL: CognitoUserGraphQL[] = (response.Users || [])
    .map((user): CognitoUserGraphQL | null => {
      if (!user || !user.Username || !user.Attributes) return null;

      return {
        username: user.Username,
        sub: user.Attributes.find((a) => a.Name === "sub")?.Value ?? "",
        status: (user.UserStatus as UserStatusType) ?? null,
        enabled: user.Enabled ?? null,
        createdAt: user.UserCreateDate?.toISOString() ?? null,
        updatedAt: user.UserLastModifiedDate?.toISOString() ?? null,
        attributes: user.Attributes
          .filter((attr) => attr.Name !== undefined)
          .map((attr) => ({
            name: attr.Name!, // Non-null assertion is safe after filter
            value: attr.Value ?? "",
          })),
      };
    })
    .filter((u): u is CognitoUserGraphQL => u !== null); // Type guard to exclude nulls

  return usersGraphQL;
};

// Dummy function to mimic AWS Cognito call
async function fakeListUsers(): Promise<ListUsersResponse> {
  return {
    Users: [
      {
        Username: "user1",
        UserStatus: "CONFIRMED",
        Enabled: true,
        UserCreateDate: new Date(),
        UserLastModifiedDate: new Date(),
        Attributes: [
          { Name: "sub", Value: "abc123" },
          { Name: "email", Value: "user1@example.com" },
        ],
      },
      null,
      {
        Username: "user2",
        UserStatus: "UNCONFIRMED",
        Enabled: false,
        UserCreateDate: new Date(),
        UserLastModifiedDate: new Date(),
        Attributes: [{ Name: "sub", Value: "def456" }],
      },
    ],
  };
}
