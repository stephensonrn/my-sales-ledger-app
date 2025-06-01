/* tslint:disable */
/* eslint-disable */
// this is an auto generated file. This will be overwritten

import * as APITypes from "../API";
type GeneratedQuery<InputType, OutputType> = string & {
  __generatedQueryInput: InputType;
  __generatedQueryOutput: OutputType;
};

export const getLedgerEntry = /* GraphQL */ `query GetLedgerEntry($id: ID!) {
  getLedgerEntry(id: $id) {
    id
    owner
    type
    amount
    description
    createdAt
    updatedAt
    createdByAdmin
    __typename
  }
}
` as GeneratedQuery<
  APITypes.GetLedgerEntryQueryVariables,
  APITypes.GetLedgerEntryQuery
>;
export const listLedgerEntries = /* GraphQL */ `query ListLedgerEntries(
  $filter: LedgerEntryFilterInput
  $limit: Int
  $nextToken: String
) {
  listLedgerEntries(filter: $filter, limit: $limit, nextToken: $nextToken) {
    items {
      id
      owner
      type
      amount
      description
      createdAt
      updatedAt
      createdByAdmin
      __typename
    }
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListLedgerEntriesQueryVariables,
  APITypes.ListLedgerEntriesQuery
>;
export const getAccountStatus = /* GraphQL */ `query GetAccountStatus($id: ID!) {
  getAccountStatus(id: $id) {
    id
    owner
    totalUnapprovedInvoiceValue
    createdAt
    updatedAt
    createdByAdmin
    __typename
  }
}
` as GeneratedQuery<
  APITypes.GetAccountStatusQueryVariables,
  APITypes.GetAccountStatusQuery
>;
export const listAccountStatuses = /* GraphQL */ `query ListAccountStatuses(
  $filter: AccountStatusFilterInput
  $limit: Int
  $nextToken: String
) {
  listAccountStatuses(filter: $filter, limit: $limit, nextToken: $nextToken) {
    items {
      id
      owner
      totalUnapprovedInvoiceValue
      createdAt
      updatedAt
      createdByAdmin
      __typename
    }
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListAccountStatusesQueryVariables,
  APITypes.ListAccountStatusesQuery
>;
export const getCurrentAccountTransaction = /* GraphQL */ `query GetCurrentAccountTransaction($id: ID!) {
  getCurrentAccountTransaction(id: $id) {
    id
    owner
    type
    amount
    description
    createdAt
    updatedAt
    createdByAdmin
    __typename
  }
}
` as GeneratedQuery<
  APITypes.GetCurrentAccountTransactionQueryVariables,
  APITypes.GetCurrentAccountTransactionQuery
>;
export const listCurrentAccountTransactions = /* GraphQL */ `query ListCurrentAccountTransactions(
  $filter: CurrentAccountTransactionFilterInput
  $limit: Int
  $nextToken: String
) {
  listCurrentAccountTransactions(
    filter: $filter
    limit: $limit
    nextToken: $nextToken
  ) {
    items {
      id
      owner
      type
      amount
      description
      createdAt
      updatedAt
      createdByAdmin
      __typename
    }
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListCurrentAccountTransactionsQueryVariables,
  APITypes.ListCurrentAccountTransactionsQuery
>;
export const adminListUsers = /* GraphQL */ `query AdminListUsers(
  $limit: Int
  $nextToken: String
  $filter: UserFilterInput
) {
  adminListUsers(limit: $limit, nextToken: $nextToken, filter: $filter) {
    users {
      username
      sub
      status
      enabled
      createdAt
      updatedAt
      attributes {
        name
        value
        __typename
      }
      id
      email
      lastModifiedAt
      groups
      __typename
    }
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.AdminListUsersQueryVariables,
  APITypes.AdminListUsersQuery
>;
