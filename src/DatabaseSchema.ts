
interface Reservation {
  wyreReservationId: string
  wyreOrderId?: string
  referenceId: string
  domain: string
  timestamp: string
  buyer: string

  // TODO: these flags mean it is not possible for GSN to re-ask for approval data on relay change, etc.
  //  need to support more advanced logic around it
  commitTxApproved: boolean
  purchaseTxApproved: boolean
}

export interface DatabaseSchema {
  reservations: Reservation[]
}
