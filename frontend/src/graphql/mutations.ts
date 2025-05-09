/* tslint:disable */
/* eslint-disable */
// this is an auto generated file. This will be overwritten

import * as APITypes from "../API";
type GeneratedMutation<InputType, OutputType> = string & {
  __generatedMutationInput: InputType;
  __generatedMutationOutput: OutputType;
};

export const createLedgerEntry = /* GraphQL */ `mutation CreateLedgerEntry($input: CreateLedgerEntryInput!) {
  createLedgerEntry(input: $input) {
    id
    owner
    type
    amount
    description
    createdAt
    updatedAt
    __typename
  }
}
` as GeneratedMutation<
  APITypes.CreateLedgerEntryMutationVariables,
  APITypes.CreateLedgerEntryMutation
>;
export const updateLedgerEntry = /* GraphQL */ `mutation UpdateLedgerEntry($input: UpdateLedgerEntryInput!) {
  updateLedgerEntry(input: $input) {
    id
    owner
    type
    amount
    description
    createdAt
    updatedAt
    __typename
  }
}
` as GeneratedMutation<
  APITypes.UpdateLedgerEntryMutationVariables,
  APITypes.UpdateLedgerEntryMutation
>;
export const deleteLedgerEntry = /* GraphQL */ `mutation DeleteLedgerEntry($id: ID!) {
  deleteLedgerEntry(id: $id) {
    id
    owner
    type
    amount
    description
    createdAt
    updatedAt
    __typename
  }
}
` as GeneratedMutation<
  APITypes.DeleteLedgerEntryMutationVariables,
  APITypes.DeleteLedgerEntryMutation
>;
export const updateAccountStatus = /* GraphQL */ `mutation UpdateAccountStatus($input: UpdateAccountStatusInput!) {
  updateAccountStatus(input: $input) {
    id
    owner
    totalUnapprovedInvoiceValue
    createdAt
    updatedAt
    __typename
  }
}
` as GeneratedMutation<
  APITypes.UpdateAccountStatusMutationVariables,
  APITypes.UpdateAccountStatusMutation
>;
export const adminAddCashReceipt = /* GraphQL */ `mutation AdminAddCashReceipt(
  $targetOwnerId: String!
  $amount: Float!
  $description: String
) {
  adminAddCashReceipt(
    targetOwnerId: $targetOwnerId
    amount: $amount
    description: $description
  ) {
    id
    owner
    type
    amount
    description
    createdAt
    updatedAt
    __typename
  }
}
` as GeneratedMutation<
  APITypes.AdminAddCashReceiptMutationVariables,
  APITypes.AdminAddCashReceiptMutation
>;
export const sendPaymentRequestEmail = /* GraphQL */ `mutation SendPaymentRequestEmail($amount: Float!) {
  sendPaymentRequestEmail(amount: $amount)
}
` as GeneratedMutation<
  APITypes.SendPaymentRequestEmailMutationVariables,
  APITypes.SendPaymentRequestEmailMutation
>;
