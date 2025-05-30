export type UserStatusType =
  | 'UNCONFIRMED'
  | 'CONFIRMED'
  | 'ARCHIVED'
  | 'COMPROMISED'
  | 'UNKNOWN'
  | 'RESET_REQUIRED'
  | 'FORCE_CHANGE_PASSWORD';

export interface UserAttributeGraphQL {
  name: string;
  value: string;
}

export interface CognitoUserGraphQL {
  username: string;
  sub: string;
  status: UserStatusType | null;
  enabled: boolean | null;
  createdAt: string | null;
  updatedAt: string | null;
  attributes: UserAttributeGraphQL[];
}
