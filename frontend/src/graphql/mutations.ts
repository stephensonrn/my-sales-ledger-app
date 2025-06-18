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
    owner
    id
    type
    amount
    description
    createdAt
    updatedAt
    createdByAdmin
    __typename
  }
}
` as GeneratedMutation<
  APITypes.CreateLedgerEntryMutationVariables,
  APITypes.CreateLedgerEntryMutation
>;
export const updateLedgerEntry = /* GraphQL */ `mutation UpdateLedgerEntry($input: UpdateLedgerEntryInput!) {
  updateLedgerEntry(input: $input) {
    owner
    id
    type
    amount
    description
    createdAt
    updatedAt
    createdByAdmin
    __typename
  }
}
` as GeneratedMutation<
  APITypes.UpdateLedgerEntryMutationVariables,
  APITypes.UpdateLedgerEntryMutation
>;
export const deleteLedgerEntry = /* GraphQL */ `mutation DeleteLedgerEntry($id: ID!) {
  deleteLedgerEntry(id: $id) {
    owner
    id
    type
    amount
    description
    createdAt
    updatedAt
    createdByAdmin
    __typename
  }
}
` as GeneratedMutation<
  APITypes.DeleteLedgerEntryMutationVariables,
  APITypes.DeleteLedgerEntryMutation
>;
export const adminCreateLedgerEntry = /* GraphQL */ `mutation AdminCreateLedgerEntry($input: AdminCreateLedgerEntryInput!) {
  adminCreateLedgerEntry(input: $input) {
    owner
    id
    type
    amount
    description
    createdAt
    updatedAt
    createdByAdmin
    __typename
  }
}
` as GeneratedMutation<
  APITypes.AdminCreateLedgerEntryMutationVariables,
  APITypes.AdminCreateLedgerEntryMutation
>;
export const updateAccountStatus = /* GraphQL */ `mutation UpdateAccountStatus($input: UpdateAccountStatusInput!) {
  updateAccountStatus(input: $input) {
    owner
    id
    totalUnapprovedInvoiceValue
    createdAt
    updatedAt
    createdByAdmin
    __typename
  }
}
` as GeneratedMutation<
  APITypes.UpdateAccountStatusMutationVariables,
  APITypes.UpdateAccountStatusMutation
>;
export const adminCreateAccountStatus = /* GraphQL */ `mutation AdminCreateAccountStatus($input: AdminCreateAccountStatusInput!) {
  adminCreateAccountStatus(input: $input) {
    owner
    id
    totalUnapprovedInvoiceValue
    createdAt
    updatedAt
    createdByAdmin
    __typename
  }
}
` as GeneratedMutation<
  APITypes.AdminCreateAccountStatusMutationVariables,
  APITypes.AdminCreateAccountStatusMutation
>;
export const adminAddCashReceipt = /* GraphQL */ `mutation AdminAddCashReceipt($input: AdminAddCashReceiptInput!) {
  adminAddCashReceipt(input: $input) {
    owner
    id
    type
    amount
    description
    createdAt
    updatedAt
    createdByAdmin
    __typename
  }
}
` as GeneratedMutation<
  APITypes.AdminAddCashReceiptMutationVariables,
  APITypes.AdminAddCashReceiptMutation
>;
export const sendPaymentRequestEmail = /* GraphQL */ `mutation SendPaymentRequestEmail($input: SendPaymentRequestInput!) {
  sendPaymentRequestEmail(input: $input)
}
` as GeneratedMutation<
  APITypes.SendPaymentRequestEmailMutationVariables,
  APITypes.SendPaymentRequestEmailMutation
>;
export const adminRequestPaymentForUser = /* GraphQL */ `mutation AdminRequestPaymentForUser($input: AdminRequestPaymentForUserInput!) {
  adminRequestPaymentForUser(input: $input) {
    success
    message
    transactionId
    __typename
  }
}
` as GeneratedMutation<
  APITypes.AdminRequestPaymentForUserMutationVariables,
  APITypes.AdminRequestPaymentForUserMutation
>;
