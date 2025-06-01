/* tslint:disable */
/* eslint-disable */
//  This file was automatically generated and should not be edited.

export enum LedgerEntryType {
  INVOICE = "INVOICE",
  CREDIT_NOTE = "CREDIT_NOTE",
  INCREASE_ADJUSTMENT = "INCREASE_ADJUSTMENT",
  DECREASE_ADJUSTMENT = "DECREASE_ADJUSTMENT",
  CASH_RECEIPT = "CASH_RECEIPT",
}


export enum CurrentAccountTransactionType {
  PAYMENT_REQUEST = "PAYMENT_REQUEST",
  CASH_RECEIPT = "CASH_RECEIPT",
}


export type UserAttribute = {
  __typename: "UserAttribute",
  name: string,
  value?: string | null,
};

export type CreateLedgerEntryInput = {
  type: LedgerEntryType,
  amount: number,
  description?: string | null,
};

export type LedgerEntry = {
  __typename: "LedgerEntry",
  id: string,
  owner: string,
  type: LedgerEntryType,
  amount: number,
  description?: string | null,
  createdAt: string,
  updatedAt: string,
  createdByAdmin?: string | null,
};

export type UpdateLedgerEntryInput = {
  id: string,
  type?: LedgerEntryType | null,
  amount?: number | null,
  description?: string | null,
};

export type AdminCreateLedgerEntryInput = {
  type: LedgerEntryType,
  amount: number,
  description?: string | null,
  targetUserId: string,
};

export type UpdateAccountStatusInput = {
  id: string,
  totalUnapprovedInvoiceValue: number,
};

export type AccountStatus = {
  __typename: "AccountStatus",
  id: string,
  owner: string,
  totalUnapprovedInvoiceValue: number,
  createdAt: string,
  updatedAt: string,
  createdByAdmin?: string | null,
};

export type AdminCreateAccountStatusInput = {
  accountId: string,
  initialUnapprovedInvoiceValue: number,
  status: string,
};

export type AdminAddCashReceiptInput = {
  targetOwnerId: string,
  amount: number,
  description?: string | null,
};

export type CurrentAccountTransaction = {
  __typename: "CurrentAccountTransaction",
  id: string,
  owner: string,
  type: CurrentAccountTransactionType,
  amount: number,
  description?: string | null,
  createdAt: string,
  updatedAt: string,
  createdByAdmin?: string | null,
};

export type SendPaymentRequestInput = {
  amount: number,
};

export type AdminRequestPaymentForUserInput = {
  targetUserId: string,
  amount: number,
  paymentDescription?: string | null,
};

export type AdminPaymentRequestResult = {
  __typename: "AdminPaymentRequestResult",
  success: boolean,
  message?: string | null,
  transactionId?: string | null,
};

export type LedgerEntryFilterInput = {
  id?: ModelIDFilterInput | null,
  owner?: ModelStringFilterInput | null,
  type?: ModelStringFilterInput | null,
  createdAt?: ModelStringFilterInput | null,
};

export type ModelIDFilterInput = {
  eq?: string | null,
  ne?: string | null,
};

export type ModelStringFilterInput = {
  eq?: string | null,
  ne?: string | null,
  le?: string | null,
  lt?: string | null,
  ge?: string | null,
  gt?: string | null,
  contains?: string | null,
  notContains?: string | null,
  between?: Array< string | null > | null,
  beginsWith?: string | null,
};

export type LedgerEntryConnection = {
  __typename: "LedgerEntryConnection",
  items?:  Array<LedgerEntry | null > | null,
  nextToken?: string | null,
};

export type AccountStatusConnection = {
  __typename: "AccountStatusConnection",
  items?:  Array<AccountStatus | null > | null,
  nextToken?: string | null,
};

export type CurrentAccountTransactionFilterInput = {
  id?: ModelIDFilterInput | null,
  owner?: ModelStringFilterInput | null,
  type?: ModelStringFilterInput | null,
  createdAt?: ModelStringFilterInput | null,
};

export type CurrentAccountTransactionConnection = {
  __typename: "CurrentAccountTransactionConnection",
  items?:  Array<CurrentAccountTransaction | null > | null,
  nextToken?: string | null,
};

export type UserListResult = {
  __typename: "UserListResult",
  users?:  Array<CognitoUser | null > | null,
  nextToken?: string | null,
};

export type CognitoUser = {
  __typename: "CognitoUser",
  username: string,
  sub: string,
  status?: string | null,
  enabled?: boolean | null,
  createdAt?: string | null,
  updatedAt?: string | null,
  attributes?:  Array<UserAttribute | null > | null,
  id: string,
  email?: string | null,
  lastModifiedAt?: string | null,
  groups?: Array< string | null > | null,
};

export type CreateLedgerEntryMutationVariables = {
  input: CreateLedgerEntryInput,
};

export type CreateLedgerEntryMutation = {
  createLedgerEntry?:  {
    __typename: "LedgerEntry",
    id: string,
    owner: string,
    type: LedgerEntryType,
    amount: number,
    description?: string | null,
    createdAt: string,
    updatedAt: string,
    createdByAdmin?: string | null,
  } | null,
};

export type UpdateLedgerEntryMutationVariables = {
  input: UpdateLedgerEntryInput,
};

export type UpdateLedgerEntryMutation = {
  updateLedgerEntry?:  {
    __typename: "LedgerEntry",
    id: string,
    owner: string,
    type: LedgerEntryType,
    amount: number,
    description?: string | null,
    createdAt: string,
    updatedAt: string,
    createdByAdmin?: string | null,
  } | null,
};

export type DeleteLedgerEntryMutationVariables = {
  id: string,
};

export type DeleteLedgerEntryMutation = {
  deleteLedgerEntry?:  {
    __typename: "LedgerEntry",
    id: string,
    owner: string,
    type: LedgerEntryType,
    amount: number,
    description?: string | null,
    createdAt: string,
    updatedAt: string,
    createdByAdmin?: string | null,
  } | null,
};

export type AdminCreateLedgerEntryMutationVariables = {
  input: AdminCreateLedgerEntryInput,
};

export type AdminCreateLedgerEntryMutation = {
  adminCreateLedgerEntry?:  {
    __typename: "LedgerEntry",
    id: string,
    owner: string,
    type: LedgerEntryType,
    amount: number,
    description?: string | null,
    createdAt: string,
    updatedAt: string,
    createdByAdmin?: string | null,
  } | null,
};

export type UpdateAccountStatusMutationVariables = {
  input: UpdateAccountStatusInput,
};

export type UpdateAccountStatusMutation = {
  updateAccountStatus?:  {
    __typename: "AccountStatus",
    id: string,
    owner: string,
    totalUnapprovedInvoiceValue: number,
    createdAt: string,
    updatedAt: string,
    createdByAdmin?: string | null,
  } | null,
};

export type AdminCreateAccountStatusMutationVariables = {
  input: AdminCreateAccountStatusInput,
};

export type AdminCreateAccountStatusMutation = {
  adminCreateAccountStatus?:  {
    __typename: "AccountStatus",
    id: string,
    owner: string,
    totalUnapprovedInvoiceValue: number,
    createdAt: string,
    updatedAt: string,
    createdByAdmin?: string | null,
  } | null,
};

export type AdminAddCashReceiptMutationVariables = {
  input: AdminAddCashReceiptInput,
};

export type AdminAddCashReceiptMutation = {
  adminAddCashReceipt?:  {
    __typename: "CurrentAccountTransaction",
    id: string,
    owner: string,
    type: CurrentAccountTransactionType,
    amount: number,
    description?: string | null,
    createdAt: string,
    updatedAt: string,
    createdByAdmin?: string | null,
  } | null,
};

export type SendPaymentRequestEmailMutationVariables = {
  input: SendPaymentRequestInput,
};

export type SendPaymentRequestEmailMutation = {
  sendPaymentRequestEmail?: string | null,
};

export type AdminRequestPaymentForUserMutationVariables = {
  input: AdminRequestPaymentForUserInput,
};

export type AdminRequestPaymentForUserMutation = {
  adminRequestPaymentForUser?:  {
    __typename: "AdminPaymentRequestResult",
    success: boolean,
    message?: string | null,
    transactionId?: string | null,
  } | null,
};

export type GetLedgerEntryQueryVariables = {
  id: string,
};

export type GetLedgerEntryQuery = {
  getLedgerEntry?:  {
    __typename: "LedgerEntry",
    id: string,
    owner: string,
    type: LedgerEntryType,
    amount: number,
    description?: string | null,
    createdAt: string,
    updatedAt: string,
    createdByAdmin?: string | null,
  } | null,
};

export type ListLedgerEntriesQueryVariables = {
  filter?: LedgerEntryFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
};

export type ListLedgerEntriesQuery = {
  listLedgerEntries?:  {
    __typename: "LedgerEntryConnection",
    items?:  Array< {
      __typename: "LedgerEntry",
      id: string,
      owner: string,
      type: LedgerEntryType,
      amount: number,
      description?: string | null,
      createdAt: string,
      updatedAt: string,
      createdByAdmin?: string | null,
    } | null > | null,
    nextToken?: string | null,
  } | null,
};

export type GetAccountStatusQueryVariables = {
  id: string,
};

export type GetAccountStatusQuery = {
  getAccountStatus?:  {
    __typename: "AccountStatus",
    id: string,
    owner: string,
    totalUnapprovedInvoiceValue: number,
    createdAt: string,
    updatedAt: string,
    createdByAdmin?: string | null,
  } | null,
};

export type ListAccountStatusesQueryVariables = {
  owner?: string | null,
};

export type ListAccountStatusesQuery = {
  listAccountStatuses?:  {
    __typename: "AccountStatusConnection",
    items?:  Array< {
      __typename: "AccountStatus",
      id: string,
      owner: string,
      totalUnapprovedInvoiceValue: number,
      createdAt: string,
      updatedAt: string,
    } | null > | null,
    nextToken?: string | null,
  } | null,
};

export type GetCurrentAccountTransactionQueryVariables = {
  id: string,
};

export type GetCurrentAccountTransactionQuery = {
  getCurrentAccountTransaction?:  {
    __typename: "CurrentAccountTransaction",
    id: string,
    owner: string,
    type: CurrentAccountTransactionType,
    amount: number,
    description?: string | null,
    createdAt: string,
    updatedAt: string,
    createdByAdmin?: string | null,
  } | null,
};

export type ListCurrentAccountTransactionsQueryVariables = {
  filter?: CurrentAccountTransactionFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
};

export type ListCurrentAccountTransactionsQuery = {
  listCurrentAccountTransactions?:  {
    __typename: "CurrentAccountTransactionConnection",
    items?:  Array< {
      __typename: "CurrentAccountTransaction",
      id: string,
      owner: string,
      type: CurrentAccountTransactionType,
      amount: number,
      description?: string | null,
      createdAt: string,
      updatedAt: string,
      createdByAdmin?: string | null,
    } | null > | null,
    nextToken?: string | null,
  } | null,
};

export type AdminListUsersQueryVariables = {
  limit?: number | null,
  nextToken?: string | null,
};

export type AdminListUsersQuery = {
  adminListUsers?:  {
    __typename: "UserListResult",
    users?:  Array< {
      __typename: "CognitoUser",
      username: string,
      sub: string,
      status?: string | null,
      enabled?: boolean | null,
      createdAt?: string | null,
      updatedAt?: string | null,
      attributes?:  Array< {
        __typename: "UserAttribute",
        name: string,
        value?: string | null,
      } | null > | null,
    } | null > | null,
    nextToken?: string | null,
  } | null,
};

export type OnCreateLedgerEntrySubscriptionVariables = {
  owner?: string | null,
};

export type OnCreateLedgerEntrySubscription = {
  onCreateLedgerEntry?:  {
    __typename: "LedgerEntry",
    id: string,
    owner: string,
    type: LedgerEntryType,
    amount: number,
    description?: string | null,
    createdAt: string,
    updatedAt: string,
    createdByAdmin?: string | null,
  } | null,
};

export type LedgerEntryFieldsFragment = {
  __typename: "LedgerEntry",
  id: string,
  owner: string,
  type: LedgerEntryType,
  amount: number,
  description?: string | null,
  createdAt: string,
  updatedAt: string,
  createdByAdmin?: string | null,
};

export type AccountStatusFieldsFragment = {
  __typename: "AccountStatus",
  id: string,
  owner: string,
  totalUnapprovedInvoiceValue: number,
  createdAt: string,
  updatedAt: string,
  createdByAdmin?: string | null,
};

export type CurrentAccountTransactionFieldsFragment = {
  __typename: "CurrentAccountTransaction",
  id: string,
  owner: string,
  type: CurrentAccountTransactionType,
  amount: number,
  description?: string | null,
  createdAt: string,
  updatedAt: string,
  createdByAdmin?: string | null,
};

export type UserAttributeFieldsFragment = {
  __typename: "UserAttribute",
  name: string,
  value?: string | null,
};

export type CognitoUserFieldsFragment = {
  __typename: "CognitoUser",
  username: string,
  sub: string,
  status?: string | null,
  enabled?: boolean | null,
  createdAt?: string | null,
  updatedAt?: string | null,
  attributes?:  Array< {
    __typename: "UserAttribute",
    name: string,
    value?: string | null,
  } | null > | null,
};
