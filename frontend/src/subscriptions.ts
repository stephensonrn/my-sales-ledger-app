/* tslint:disable */
/* eslint-disable */
// this is an auto generated file. This will be overwritten

import * as APITypes from "./graphql/API";
type GeneratedSubscription<InputType, OutputType> = string & {
  __generatedSubscriptionInput: InputType;
  __generatedSubscriptionOutput: OutputType;
};

export const onCreateLedgerEntry = /* GraphQL */ `subscription OnCreateLedgerEntry($owner: String) {
  onCreateLedgerEntry(owner: $owner) {
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
` as GeneratedSubscription<
  APITypes.OnCreateLedgerEntrySubscriptionVariables,
  APITypes.OnCreateLedgerEntrySubscription
>;
