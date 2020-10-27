import RelayRequest from '@opengsn/gsn/dist/src/common/EIP712/RelayRequest'

export interface WyreOrderReservationRequest {
  dest: string,
  amount: number,
  referenceId: string,
  destCurrency: string,
  paymentMethod: string,
  sourceCurrency: string,
  referrerAccountId: string,
  lockFields: string[]
}

export interface WyreDebitCardDetails {
  number: string
  year: string
  month: string
  cvv: string
}

export interface WyreAddress {
  street1: string
  city: string
  state: string
  postalCode: string
  country: string
}

export interface GsnConstPaymentDetails {
  dest: string
  referrerAccountId: string
  sourceCurrency: string
  destCurrency: string
}

export interface GsnUserDetails {
  givenName: string
  familyName: string
  email: string
  phone: string
  address: WyreAddress
}

export interface WyrePaymentIds {
  reservationId: string
  referenceId: string
}

export interface GsnPaymentDetails {
  amount: string
  debitCard: WyreDebitCardDetails
}

export type WyrePaymentRequest = GsnConstPaymentDetails & GsnUserDetails & GsnPaymentDetails & WyrePaymentIds

export interface ApproveRequest {
  relayRequest: RelayRequest,
  domain: string,
  referenceId: string,
  orderId: string
}

export interface ENSGSNRequest {
  domain: string,
  buyer: string
}
