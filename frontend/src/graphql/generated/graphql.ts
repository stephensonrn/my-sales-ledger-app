import { TypedDocumentNode as DocumentNode } from "@graphql-typed-document-node/core";
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = {
  [K in keyof T]: T[K];
};
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & {
  [SubKey in K]?: Maybe<T[SubKey]>;
};
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & {
  [SubKey in K]: Maybe<T[SubKey]>;
};
export type MakeEmpty<
  T extends { [key: string]: unknown },
  K extends keyof T,
> = { [_ in K]?: never };
export type Incremental<T> =
  | T
  | {
      [P in keyof T]?: P extends " $fragmentName" | "__typename" ? T[P] : never;
    };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string };
  String: { input: string; output: string };
  Boolean: { input: boolean; output: boolean };
  Int: { input: number; output: number };
  Float: { input: number; output: number };
  AWSDateTime: { input: string; output: string };
};

export type AccountStatus = {
  __typename?: "AccountStatus";
  createdAt: Scalars["AWSDateTime"]["output"];
  id: Scalars["ID"]["output"];
  /**   Typically the owner's Cognito User Sub ID */
  owner: Scalars["String"]["output"];
  /**   Cognito User Sub ID */
  totalUnapprovedInvoiceValue: Scalars["Float"]["output"];
  updatedAt: Scalars["AWSDateTime"]["output"];
};

export type AccountStatusConnection = {
  __typename?: "AccountStatusConnection";
  items?: Maybe<Array<Maybe<AccountStatus>>>;
  nextToken?: Maybe<Scalars["String"]["output"]>;
};

export type AccountStatusFilterInput = {
  id?: InputMaybe<ModelIdFilterInput>;
  owner?: InputMaybe<ModelStringFilterInput>;
  totalUnapprovedInvoiceValue?: InputMaybe<ModelFloatFilterInput>;
};

/**   Represents a user fetched from Cognito (for adminListUsers) */
export type CognitoUser = {
  __typename?: "CognitoUser";
  attributes?: Maybe<Array<Maybe<UserAttribute>>>;
  createdAt?: Maybe<Scalars["AWSDateTime"]["output"]>;
  enabled?: Maybe<Scalars["Boolean"]["output"]>;
  status?: Maybe<Scalars["String"]["output"]>;
  sub: Scalars["String"]["output"];
  updatedAt?: Maybe<Scalars["AWSDateTime"]["output"]>;
  username: Scalars["String"]["output"];
};

/**   --- Input Types for Mutations --- */
export type CreateLedgerEntryInput = {
  amount: Scalars["Float"]["input"];
  description?: InputMaybe<Scalars["String"]["input"]>;
  type: LedgerEntryType;
};

export type CurrentAccountTransaction = {
  __typename?: "CurrentAccountTransaction";
  amount: Scalars["Float"]["output"];
  createdAt: Scalars["AWSDateTime"]["output"];
  description?: Maybe<Scalars["String"]["output"]>;
  id: Scalars["ID"]["output"];
  owner: Scalars["String"]["output"];
  /**   Cognito User Sub ID */
  type: CurrentAccountTransactionType;
  updatedAt: Scalars["AWSDateTime"]["output"];
};

export type CurrentAccountTransactionConnection = {
  __typename?: "CurrentAccountTransactionConnection";
  items?: Maybe<Array<Maybe<CurrentAccountTransaction>>>;
  nextToken?: Maybe<Scalars["String"]["output"]>;
};

export type CurrentAccountTransactionFilterInput = {
  id?: InputMaybe<ModelIdFilterInput>;
  owner?: InputMaybe<ModelStringFilterInput>;
  type?: InputMaybe<ModelStringFilterInput>;
};

export type CurrentAccountTransactionType = "CASH_RECEIPT" | "PAYMENT_REQUEST";

/**   --- Object Types (Your Data Models) --- */
export type LedgerEntry = {
  __typename?: "LedgerEntry";
  amount: Scalars["Float"]["output"];
  createdAt: Scalars["AWSDateTime"]["output"];
  description?: Maybe<Scalars["String"]["output"]>;
  id: Scalars["ID"]["output"];
  owner: Scalars["String"]["output"];
  /**   Cognito User Sub ID */
  type: LedgerEntryType;
  updatedAt: Scalars["AWSDateTime"]["output"];
};

/**   --- Connection Types for List Operations --- */
export type LedgerEntryConnection = {
  __typename?: "LedgerEntryConnection";
  items?: Maybe<Array<Maybe<LedgerEntry>>>;
  nextToken?: Maybe<Scalars["String"]["output"]>;
};

export type LedgerEntryFilterInput = {
  id?: InputMaybe<ModelIdFilterInput>;
  owner?: InputMaybe<ModelStringFilterInput>;
  type?: InputMaybe<ModelStringFilterInput>;
};

/**
 *   Schema for Sales Ledger Application
 *  --- Enums ---
 */
export type LedgerEntryType =
  | "CASH_RECEIPT"
  | "CREDIT_NOTE"
  | "DECREASE_ADJUSTMENT"
  | "INCREASE_ADJUSTMENT"
  | "INVOICE";

export type ModelFloatFilterInput = {
  eq?: InputMaybe<Scalars["Float"]["input"]>;
  ge?: InputMaybe<Scalars["Float"]["input"]>;
  gt?: InputMaybe<Scalars["Float"]["input"]>;
  le?: InputMaybe<Scalars["Float"]["input"]>;
  lt?: InputMaybe<Scalars["Float"]["input"]>;
  ne?: InputMaybe<Scalars["Float"]["input"]>;
};

export type ModelIdFilterInput = {
  eq?: InputMaybe<Scalars["ID"]["input"]>;
  ne?: InputMaybe<Scalars["ID"]["input"]>;
};

/**   --- Input Types for Query Filters --- */
export type ModelStringFilterInput = {
  beginsWith?: InputMaybe<Scalars["String"]["input"]>;
  contains?: InputMaybe<Scalars["String"]["input"]>;
  eq?: InputMaybe<Scalars["String"]["input"]>;
  ne?: InputMaybe<Scalars["String"]["input"]>;
  notContains?: InputMaybe<Scalars["String"]["input"]>;
};

/**   --- Mutation Type --- */
export type Mutation = {
  __typename?: "Mutation";
  /**   CurrentAccountTransaction Mutations */
  adminAddCashReceipt?: Maybe<CurrentAccountTransaction>;
  /**
   *   Inside your 'type Mutation @aws_cognito_user_pools { ... }' block
   *  ... existing mutations ...
   *  NEW Admin Mutation to create AccountStatus
   */
  adminCreateAccountStatus?: Maybe<AccountStatus>;
  /**
   *   Default auth is Cognito User Pools
   *  LedgerEntry mutations
   */
  createLedgerEntry?: Maybe<LedgerEntry>;
  deleteLedgerEntry?: Maybe<LedgerEntry>;
  sendPaymentRequestEmail?: Maybe<Scalars["String"]["output"]>;
  /**   AccountStatus Admin Mutation */
  updateAccountStatus?: Maybe<AccountStatus>;
  updateLedgerEntry?: Maybe<LedgerEntry>;
};

/**   --- Mutation Type --- */
export type MutationAdminAddCashReceiptArgs = {
  amount: Scalars["Float"]["input"];
  description?: InputMaybe<Scalars["String"]["input"]>;
  targetOwnerId: Scalars["String"]["input"];
};

/**   --- Mutation Type --- */
export type MutationAdminCreateAccountStatusArgs = {
  initialUnapprovedInvoiceValue?: InputMaybe<Scalars["Float"]["input"]>;
  ownerId: Scalars["String"]["input"];
};

/**   --- Mutation Type --- */
export type MutationCreateLedgerEntryArgs = {
  input: CreateLedgerEntryInput;
};

/**   --- Mutation Type --- */
export type MutationDeleteLedgerEntryArgs = {
  id: Scalars["ID"]["input"];
};

/**   --- Mutation Type --- */
export type MutationSendPaymentRequestEmailArgs = {
  amount: Scalars["Float"]["input"];
};

/**   --- Mutation Type --- */
export type MutationUpdateAccountStatusArgs = {
  input: UpdateAccountStatusInput;
};

/**   --- Mutation Type --- */
export type MutationUpdateLedgerEntryArgs = {
  input: UpdateLedgerEntryInput;
};

/**   --- Query Type --- */
export type Query = {
  __typename?: "Query";
  /**   NEW Admin Query */
  adminListUsers?: Maybe<UserListResult>;
  /**   AccountStatus Queries */
  getAccountStatus?: Maybe<AccountStatus>;
  /**   CurrentAccountTransaction Queries */
  getCurrentAccountTransaction?: Maybe<CurrentAccountTransaction>;
  /**
   *   Default auth is Cognito User Pools
   *  LedgerEntry queries
   */
  getLedgerEntry?: Maybe<LedgerEntry>;
  listAccountStatuses?: Maybe<AccountStatusConnection>;
  listCurrentAccountTransactions?: Maybe<CurrentAccountTransactionConnection>;
  listLedgerEntries?: Maybe<LedgerEntryConnection>;
};

/**   --- Query Type --- */
export type QueryAdminListUsersArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  nextToken?: InputMaybe<Scalars["String"]["input"]>;
};

/**   --- Query Type --- */
export type QueryGetAccountStatusArgs = {
  id: Scalars["ID"]["input"];
};

/**   --- Query Type --- */
export type QueryGetCurrentAccountTransactionArgs = {
  id: Scalars["ID"]["input"];
};

/**   --- Query Type --- */
export type QueryGetLedgerEntryArgs = {
  id: Scalars["ID"]["input"];
};

/**   --- Query Type --- */
export type QueryListAccountStatusesArgs = {
  filter?: InputMaybe<AccountStatusFilterInput>;
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  nextToken?: InputMaybe<Scalars["String"]["input"]>;
  owner?: InputMaybe<Scalars["String"]["input"]>;
};

/**   --- Query Type --- */
export type QueryListCurrentAccountTransactionsArgs = {
  filter?: InputMaybe<CurrentAccountTransactionFilterInput>;
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  nextToken?: InputMaybe<Scalars["String"]["input"]>;
};

/**   --- Query Type --- */
export type QueryListLedgerEntriesArgs = {
  filter?: InputMaybe<LedgerEntryFilterInput>;
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  nextToken?: InputMaybe<Scalars["String"]["input"]>;
};

/**   --- Subscription Type --- */
export type Subscription = {
  __typename?: "Subscription";
  /**   Add default auth for subscription connections */
  onCreateLedgerEntry?: Maybe<LedgerEntry>;
};

/**   --- Subscription Type --- */
export type SubscriptionOnCreateLedgerEntryArgs = {
  owner?: InputMaybe<Scalars["String"]["input"]>;
};

export type UpdateAccountStatusInput = {
  id: Scalars["ID"]["input"];
  totalUnapprovedInvoiceValue?: InputMaybe<Scalars["Float"]["input"]>;
};

export type UpdateLedgerEntryInput = {
  amount?: InputMaybe<Scalars["Float"]["input"]>;
  description?: InputMaybe<Scalars["String"]["input"]>;
  id: Scalars["ID"]["input"];
  type?: InputMaybe<LedgerEntryType>;
};

/**   Represents a user attribute from Cognito (for adminListUsers) */
export type UserAttribute = {
  __typename?: "UserAttribute";
  name: Scalars["String"]["output"];
  value?: Maybe<Scalars["String"]["output"]>;
};

/**   Represents the result of the adminListUsers query, including pagination */
export type UserListResult = {
  __typename?: "UserListResult";
  nextToken?: Maybe<Scalars["String"]["output"]>;
  users?: Maybe<Array<Maybe<CognitoUser>>>;
};

export type AdminAddCashReceiptMutationVariables = Exact<{
  targetOwnerId: Scalars["String"]["input"];
  amount: Scalars["Float"]["input"];
  description?: InputMaybe<Scalars["String"]["input"]>;
}>;

export type AdminAddCashReceiptMutation = {
  __typename?: "Mutation";
  adminAddCashReceipt?: {
    __typename: "CurrentAccountTransaction";
    id: string;
    owner: string;
    type: CurrentAccountTransactionType;
    amount: number;
    description?: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
};

export type AdminCreateAccountStatusMutationVariables = Exact<{
  ownerId: Scalars["String"]["input"];
  initialUnapprovedInvoiceValue?: InputMaybe<Scalars["Float"]["input"]>;
}>;

export type AdminCreateAccountStatusMutation = {
  __typename?: "Mutation";
  adminCreateAccountStatus?: {
    __typename: "AccountStatus";
    id: string;
    owner: string;
    totalUnapprovedInvoiceValue: number;
    createdAt: string;
    updatedAt: string;
  } | null;
};

export type AdminListUsersQueryVariables = Exact<{
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  nextToken?: InputMaybe<Scalars["String"]["input"]>;
}>;

export type AdminListUsersQuery = {
  __typename?: "Query";
  adminListUsers?: {
    __typename: "UserListResult";
    nextToken?: string | null;
    users?: Array<{
      __typename: "CognitoUser";
      username: string;
      sub: string;
      status?: string | null;
      enabled?: boolean | null;
      createdAt?: string | null;
      updatedAt?: string | null;
      attributes?: Array<{
        __typename?: "UserAttribute";
        name: string;
        value?: string | null;
      } | null> | null;
    } | null> | null;
  } | null;
};

export type CreateLedgerEntryMutationVariables = Exact<{
  input: CreateLedgerEntryInput;
}>;

export type CreateLedgerEntryMutation = {
  __typename?: "Mutation";
  createLedgerEntry?: {
    __typename: "LedgerEntry";
    id: string;
    owner: string;
    type: LedgerEntryType;
    amount: number;
    description?: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
};

export type DeleteLedgerEntryMutationVariables = Exact<{
  id: Scalars["ID"]["input"];
}>;

export type DeleteLedgerEntryMutation = {
  __typename?: "Mutation";
  deleteLedgerEntry?: {
    __typename: "LedgerEntry";
    id: string;
    owner: string;
    type: LedgerEntryType;
    amount: number;
    description?: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
};

export type GetAccountStatusQueryVariables = Exact<{
  id: Scalars["ID"]["input"];
}>;

export type GetAccountStatusQuery = {
  __typename?: "Query";
  getAccountStatus?: {
    __typename: "AccountStatus";
    id: string;
    owner: string;
    totalUnapprovedInvoiceValue: number;
    createdAt: string;
    updatedAt: string;
  } | null;
};

export type GetCurrentAccountTransactionQueryVariables = Exact<{
  id: Scalars["ID"]["input"];
}>;

export type GetCurrentAccountTransactionQuery = {
  __typename?: "Query";
  getCurrentAccountTransaction?: {
    __typename: "CurrentAccountTransaction";
    id: string;
    owner: string;
    type: CurrentAccountTransactionType;
    amount: number;
    description?: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
};

export type GetLedgerEntryQueryVariables = Exact<{
  id: Scalars["ID"]["input"];
}>;

export type GetLedgerEntryQuery = {
  __typename?: "Query";
  getLedgerEntry?: {
    __typename: "LedgerEntry";
    id: string;
    owner: string;
    type: LedgerEntryType;
    amount: number;
    description?: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
};

export type ListAccountStatusesQueryVariables = Exact<{
  owner?: InputMaybe<Scalars["String"]["input"]>;
  filter?: InputMaybe<AccountStatusFilterInput>;
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  nextToken?: InputMaybe<Scalars["String"]["input"]>;
}>;

export type ListAccountStatusesQuery = {
  __typename?: "Query";
  listAccountStatuses?: {
    __typename: "AccountStatusConnection";
    nextToken?: string | null;
    items?: Array<{
      __typename: "AccountStatus";
      id: string;
      owner: string;
      totalUnapprovedInvoiceValue: number;
      createdAt: string;
      updatedAt: string;
    } | null> | null;
  } | null;
};

export type ListCurrentAccountTransactionsQueryVariables = Exact<{
  filter?: InputMaybe<CurrentAccountTransactionFilterInput>;
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  nextToken?: InputMaybe<Scalars["String"]["input"]>;
}>;

export type ListCurrentAccountTransactionsQuery = {
  __typename?: "Query";
  listCurrentAccountTransactions?: {
    __typename: "CurrentAccountTransactionConnection";
    nextToken?: string | null;
    items?: Array<{
      __typename: "CurrentAccountTransaction";
      id: string;
      owner: string;
      type: CurrentAccountTransactionType;
      amount: number;
      description?: string | null;
      createdAt: string;
      updatedAt: string;
    } | null> | null;
  } | null;
};

export type ListLedgerEntriesQueryVariables = Exact<{
  filter?: InputMaybe<LedgerEntryFilterInput>;
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  nextToken?: InputMaybe<Scalars["String"]["input"]>;
}>;

export type ListLedgerEntriesQuery = {
  __typename?: "Query";
  listLedgerEntries?: {
    __typename: "LedgerEntryConnection";
    nextToken?: string | null;
    items?: Array<{
      __typename: "LedgerEntry";
      id: string;
      owner: string;
      type: LedgerEntryType;
      amount: number;
      description?: string | null;
      createdAt: string;
      updatedAt: string;
    } | null> | null;
  } | null;
};

export type OnCreateLedgerEntrySubscriptionVariables = Exact<{
  owner?: InputMaybe<Scalars["String"]["input"]>;
}>;

export type OnCreateLedgerEntrySubscription = {
  __typename?: "Subscription";
  onCreateLedgerEntry?: {
    __typename: "LedgerEntry";
    id: string;
    owner: string;
    type: LedgerEntryType;
    amount: number;
    description?: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
};

export type SendPaymentRequestEmailMutationVariables = Exact<{
  amount: Scalars["Float"]["input"];
}>;

export type SendPaymentRequestEmailMutation = {
  __typename?: "Mutation";
  sendPaymentRequestEmail?: string | null;
};

export type UpdateAccountStatusMutationVariables = Exact<{
  input: UpdateAccountStatusInput;
}>;

export type UpdateAccountStatusMutation = {
  __typename?: "Mutation";
  updateAccountStatus?: {
    __typename: "AccountStatus";
    id: string;
    owner: string;
    totalUnapprovedInvoiceValue: number;
    createdAt: string;
    updatedAt: string;
  } | null;
};

export type UpdateLedgerEntryMutationVariables = Exact<{
  input: UpdateLedgerEntryInput;
}>;

export type UpdateLedgerEntryMutation = {
  __typename?: "Mutation";
  updateLedgerEntry?: {
    __typename: "LedgerEntry";
    id: string;
    owner: string;
    type: LedgerEntryType;
    amount: number;
    description?: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
};

export const AdminAddCashReceiptDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "AdminAddCashReceipt" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "targetOwnerId" },
          },
          type: {
            kind: "NonNullType",
            type: {
              kind: "NamedType",
              name: { kind: "Name", value: "String" },
            },
          },
        },
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "amount" },
          },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "Float" } },
          },
        },
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "description" },
          },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "adminAddCashReceipt" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "targetOwnerId" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "targetOwnerId" },
                },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "amount" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "amount" },
                },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "description" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "description" },
                },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "owner" } },
                { kind: "Field", name: { kind: "Name", value: "type" } },
                { kind: "Field", name: { kind: "Name", value: "amount" } },
                { kind: "Field", name: { kind: "Name", value: "description" } },
                { kind: "Field", name: { kind: "Name", value: "createdAt" } },
                { kind: "Field", name: { kind: "Name", value: "updatedAt" } },
                { kind: "Field", name: { kind: "Name", value: "__typename" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  AdminAddCashReceiptMutation,
  AdminAddCashReceiptMutationVariables
>;
export const AdminCreateAccountStatusDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "AdminCreateAccountStatus" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "ownerId" },
          },
          type: {
            kind: "NonNullType",
            type: {
              kind: "NamedType",
              name: { kind: "Name", value: "String" },
            },
          },
        },
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "initialUnapprovedInvoiceValue" },
          },
          type: { kind: "NamedType", name: { kind: "Name", value: "Float" } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "adminCreateAccountStatus" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "ownerId" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "ownerId" },
                },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "initialUnapprovedInvoiceValue" },
                value: {
                  kind: "Variable",
                  name: {
                    kind: "Name",
                    value: "initialUnapprovedInvoiceValue",
                  },
                },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "owner" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "totalUnapprovedInvoiceValue" },
                },
                { kind: "Field", name: { kind: "Name", value: "createdAt" } },
                { kind: "Field", name: { kind: "Name", value: "updatedAt" } },
                { kind: "Field", name: { kind: "Name", value: "__typename" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  AdminCreateAccountStatusMutation,
  AdminCreateAccountStatusMutationVariables
>;
export const AdminListUsersDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "AdminListUsers" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "limit" },
          },
          type: { kind: "NamedType", name: { kind: "Name", value: "Int" } },
        },
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "nextToken" },
          },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "adminListUsers" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "limit" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "limit" },
                },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "nextToken" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "nextToken" },
                },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                {
                  kind: "Field",
                  name: { kind: "Name", value: "users" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "username" },
                      },
                      { kind: "Field", name: { kind: "Name", value: "sub" } },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "status" },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "enabled" },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "createdAt" },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "updatedAt" },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "attributes" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            {
                              kind: "Field",
                              name: { kind: "Name", value: "name" },
                            },
                            {
                              kind: "Field",
                              name: { kind: "Name", value: "value" },
                            },
                          ],
                        },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "__typename" },
                      },
                    ],
                  },
                },
                { kind: "Field", name: { kind: "Name", value: "nextToken" } },
                { kind: "Field", name: { kind: "Name", value: "__typename" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<AdminListUsersQuery, AdminListUsersQueryVariables>;
export const CreateLedgerEntryDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "CreateLedgerEntry" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "input" },
          },
          type: {
            kind: "NonNullType",
            type: {
              kind: "NamedType",
              name: { kind: "Name", value: "CreateLedgerEntryInput" },
            },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "createLedgerEntry" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "input" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "input" },
                },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "owner" } },
                { kind: "Field", name: { kind: "Name", value: "type" } },
                { kind: "Field", name: { kind: "Name", value: "amount" } },
                { kind: "Field", name: { kind: "Name", value: "description" } },
                { kind: "Field", name: { kind: "Name", value: "createdAt" } },
                { kind: "Field", name: { kind: "Name", value: "updatedAt" } },
                { kind: "Field", name: { kind: "Name", value: "__typename" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  CreateLedgerEntryMutation,
  CreateLedgerEntryMutationVariables
>;
export const DeleteLedgerEntryDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "DeleteLedgerEntry" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "id" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "ID" } },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "deleteLedgerEntry" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "id" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "id" },
                },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "owner" } },
                { kind: "Field", name: { kind: "Name", value: "type" } },
                { kind: "Field", name: { kind: "Name", value: "amount" } },
                { kind: "Field", name: { kind: "Name", value: "description" } },
                { kind: "Field", name: { kind: "Name", value: "createdAt" } },
                { kind: "Field", name: { kind: "Name", value: "updatedAt" } },
                { kind: "Field", name: { kind: "Name", value: "__typename" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  DeleteLedgerEntryMutation,
  DeleteLedgerEntryMutationVariables
>;
export const GetAccountStatusDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "GetAccountStatus" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "id" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "ID" } },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "getAccountStatus" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "id" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "id" },
                },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "owner" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "totalUnapprovedInvoiceValue" },
                },
                { kind: "Field", name: { kind: "Name", value: "createdAt" } },
                { kind: "Field", name: { kind: "Name", value: "updatedAt" } },
                { kind: "Field", name: { kind: "Name", value: "__typename" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  GetAccountStatusQuery,
  GetAccountStatusQueryVariables
>;
export const GetCurrentAccountTransactionDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "GetCurrentAccountTransaction" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "id" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "ID" } },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "getCurrentAccountTransaction" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "id" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "id" },
                },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "owner" } },
                { kind: "Field", name: { kind: "Name", value: "type" } },
                { kind: "Field", name: { kind: "Name", value: "amount" } },
                { kind: "Field", name: { kind: "Name", value: "description" } },
                { kind: "Field", name: { kind: "Name", value: "createdAt" } },
                { kind: "Field", name: { kind: "Name", value: "updatedAt" } },
                { kind: "Field", name: { kind: "Name", value: "__typename" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  GetCurrentAccountTransactionQuery,
  GetCurrentAccountTransactionQueryVariables
>;
export const GetLedgerEntryDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "GetLedgerEntry" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "id" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "ID" } },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "getLedgerEntry" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "id" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "id" },
                },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "owner" } },
                { kind: "Field", name: { kind: "Name", value: "type" } },
                { kind: "Field", name: { kind: "Name", value: "amount" } },
                { kind: "Field", name: { kind: "Name", value: "description" } },
                { kind: "Field", name: { kind: "Name", value: "createdAt" } },
                { kind: "Field", name: { kind: "Name", value: "updatedAt" } },
                { kind: "Field", name: { kind: "Name", value: "__typename" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<GetLedgerEntryQuery, GetLedgerEntryQueryVariables>;
export const ListAccountStatusesDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "ListAccountStatuses" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "owner" },
          },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "filter" },
          },
          type: {
            kind: "NamedType",
            name: { kind: "Name", value: "AccountStatusFilterInput" },
          },
        },
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "limit" },
          },
          type: { kind: "NamedType", name: { kind: "Name", value: "Int" } },
        },
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "nextToken" },
          },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "listAccountStatuses" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "owner" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "owner" },
                },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "filter" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "filter" },
                },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "limit" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "limit" },
                },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "nextToken" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "nextToken" },
                },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                {
                  kind: "Field",
                  name: { kind: "Name", value: "items" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                      { kind: "Field", name: { kind: "Name", value: "owner" } },
                      {
                        kind: "Field",
                        name: {
                          kind: "Name",
                          value: "totalUnapprovedInvoiceValue",
                        },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "createdAt" },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "updatedAt" },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "__typename" },
                      },
                    ],
                  },
                },
                { kind: "Field", name: { kind: "Name", value: "nextToken" } },
                { kind: "Field", name: { kind: "Name", value: "__typename" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  ListAccountStatusesQuery,
  ListAccountStatusesQueryVariables
>;
export const ListCurrentAccountTransactionsDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "ListCurrentAccountTransactions" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "filter" },
          },
          type: {
            kind: "NamedType",
            name: {
              kind: "Name",
              value: "CurrentAccountTransactionFilterInput",
            },
          },
        },
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "limit" },
          },
          type: { kind: "NamedType", name: { kind: "Name", value: "Int" } },
        },
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "nextToken" },
          },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "listCurrentAccountTransactions" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "filter" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "filter" },
                },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "limit" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "limit" },
                },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "nextToken" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "nextToken" },
                },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                {
                  kind: "Field",
                  name: { kind: "Name", value: "items" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                      { kind: "Field", name: { kind: "Name", value: "owner" } },
                      { kind: "Field", name: { kind: "Name", value: "type" } },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "amount" },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "description" },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "createdAt" },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "updatedAt" },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "__typename" },
                      },
                    ],
                  },
                },
                { kind: "Field", name: { kind: "Name", value: "nextToken" } },
                { kind: "Field", name: { kind: "Name", value: "__typename" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  ListCurrentAccountTransactionsQuery,
  ListCurrentAccountTransactionsQueryVariables
>;
export const ListLedgerEntriesDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "ListLedgerEntries" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "filter" },
          },
          type: {
            kind: "NamedType",
            name: { kind: "Name", value: "LedgerEntryFilterInput" },
          },
        },
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "limit" },
          },
          type: { kind: "NamedType", name: { kind: "Name", value: "Int" } },
        },
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "nextToken" },
          },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "listLedgerEntries" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "filter" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "filter" },
                },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "limit" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "limit" },
                },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "nextToken" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "nextToken" },
                },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                {
                  kind: "Field",
                  name: { kind: "Name", value: "items" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                      { kind: "Field", name: { kind: "Name", value: "owner" } },
                      { kind: "Field", name: { kind: "Name", value: "type" } },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "amount" },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "description" },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "createdAt" },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "updatedAt" },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "__typename" },
                      },
                    ],
                  },
                },
                { kind: "Field", name: { kind: "Name", value: "nextToken" } },
                { kind: "Field", name: { kind: "Name", value: "__typename" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  ListLedgerEntriesQuery,
  ListLedgerEntriesQueryVariables
>;
export const OnCreateLedgerEntryDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "subscription",
      name: { kind: "Name", value: "OnCreateLedgerEntry" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "owner" },
          },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "onCreateLedgerEntry" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "owner" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "owner" },
                },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "owner" } },
                { kind: "Field", name: { kind: "Name", value: "type" } },
                { kind: "Field", name: { kind: "Name", value: "amount" } },
                { kind: "Field", name: { kind: "Name", value: "description" } },
                { kind: "Field", name: { kind: "Name", value: "createdAt" } },
                { kind: "Field", name: { kind: "Name", value: "updatedAt" } },
                { kind: "Field", name: { kind: "Name", value: "__typename" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  OnCreateLedgerEntrySubscription,
  OnCreateLedgerEntrySubscriptionVariables
>;
export const SendPaymentRequestEmailDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "SendPaymentRequestEmail" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "amount" },
          },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "Float" } },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "sendPaymentRequestEmail" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "amount" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "amount" },
                },
              },
            ],
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  SendPaymentRequestEmailMutation,
  SendPaymentRequestEmailMutationVariables
>;
export const UpdateAccountStatusDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "UpdateAccountStatus" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "input" },
          },
          type: {
            kind: "NonNullType",
            type: {
              kind: "NamedType",
              name: { kind: "Name", value: "UpdateAccountStatusInput" },
            },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "updateAccountStatus" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "input" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "input" },
                },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "owner" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "totalUnapprovedInvoiceValue" },
                },
                { kind: "Field", name: { kind: "Name", value: "createdAt" } },
                { kind: "Field", name: { kind: "Name", value: "updatedAt" } },
                { kind: "Field", name: { kind: "Name", value: "__typename" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  UpdateAccountStatusMutation,
  UpdateAccountStatusMutationVariables
>;
export const UpdateLedgerEntryDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "UpdateLedgerEntry" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "input" },
          },
          type: {
            kind: "NonNullType",
            type: {
              kind: "NamedType",
              name: { kind: "Name", value: "UpdateLedgerEntryInput" },
            },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "updateLedgerEntry" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "input" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "input" },
                },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "owner" } },
                { kind: "Field", name: { kind: "Name", value: "type" } },
                { kind: "Field", name: { kind: "Name", value: "amount" } },
                { kind: "Field", name: { kind: "Name", value: "description" } },
                { kind: "Field", name: { kind: "Name", value: "createdAt" } },
                { kind: "Field", name: { kind: "Name", value: "updatedAt" } },
                { kind: "Field", name: { kind: "Name", value: "__typename" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  UpdateLedgerEntryMutation,
  UpdateLedgerEntryMutationVariables
>;
