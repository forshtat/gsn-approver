import RelayRequest from '@opengsn/gsn/dist/src/common/EIP712/RelayRequest'
import Web3 from 'web3'
import axios, { AxiosRequestConfig } from 'axios'
import { LowdbSync } from 'lowdb'
import { signRelayRequest } from '@opengsn/paymasters/src/VerifyingPaymasterUtils'

import {
  GsnPaymentDetails,
  GsnUserDetails,
  WyreOrderReservationRequest,
  WyrePaymentIds,
  WyrePaymentRequest
} from './Interfaces'
import { DatabaseSchema } from './DatabaseSchema'

const host: string = process.env.WYRE_HOST ?? 'https://api.testwyre.com/v3'
const dest: string = process.env.WYRE_PAYMENT_DESTINATION ?? 'ethereum:0x0892abeA6b9B7053B6721aa943fe950BadF94bFe'
const referrerAccountId: string = process.env.WYRE_ACCOUNT_ID ?? 'AC_8678L3X4MPC'
const wyreSecretKey = process.env.WYRE_SECRET_KEY ?? 'SK-GHREF9D4-CP4FA9YV-4RLDG666-CYAB99YP'
const config: AxiosRequestConfig = { headers: { 'Authorization': `Bearer ${wyreSecretKey}` } }

const sourceCurrency: string = 'USD'
const destCurrency: string = 'ETH'

export class ApproverLogic {
  constructor (
    private web3: Web3,
    private db: LowdbSync<DatabaseSchema>,
    private signerPrivateKey: Buffer,
    private registrarAddress: string
  ) {
    db.defaults({ reservations: [] }).write()
  }

  async recordExists (domain: string): Promise<boolean> {
    return await this.web3.eth.ens.recordExists(domain)
  }

  async verifyPayment (orderId: string, referenceId: string, domain: string, buyer: string): Promise<boolean> {
    const [buyerPaid, domainPaid] = referenceId.split(':')
    if (buyerPaid.toLowerCase() !== buyer.toLowerCase() || domainPaid.toLowerCase() !== domain.toLowerCase()) {
      console.log('reference ID does not match the domain')
      return false
    }

    try {
      const res = await axios.get(`https://api.testwyre.com/v3/orders/${orderId}`)
      console.log('wyre order details', res.status, res.data)
      const storedPayment = this.db.get('reservations').find({ wyreOrderId: orderId }).value()
      console.log('stored payment: ', storedPayment)
      if (res.data.status === 'COMPLETE' && storedPayment.referenceId === referenceId) {
        return true
      }
    } catch (e) {
      console.error('error', e.response.data)
    }
    return false
  }

  async createReservation (buyer: string, domain: string): Promise<{
    error: string | undefined
    response: any,
    referenceId: string | undefined
  }> {
    const timestamp = Date.now().toString()
    const referenceId = `${buyer}:${domain}:${timestamp}`

    const orderReservationRequest: WyreOrderReservationRequest = {
      lockFields: [],
      amount: 1,
      sourceCurrency,
      destCurrency,
      referrerAccountId,
      dest,
      paymentMethod: 'debit-card',
      referenceId
    }
    const url = host + '/orders/reserve'
    let response: any
    try {
      console.log(`config: ${JSON.stringify(config)}`)
      response = await axios.post(url, orderReservationRequest, config)
      console.log(response.data)
      let wyreReservationId = response.data.reservation
      this.db.get('reservations').push({
        referenceId,
        domain,
        buyer,
        timestamp,
        wyreReservationId,
        commitTxApproved: false,
        purchaseTxApproved: false
      }).write()
      return {
        error: undefined,
        response: response.data,
        referenceId
      }
    } catch (e) {
      console.error('error', e.response.data)
      return {
        error: JSON.stringify(e.response.data),
        response: undefined,
        referenceId
      }
    }
  }

  async createPayment (paymentIds: WyrePaymentIds, paymentDetails: GsnPaymentDetails, userDetails: GsnUserDetails): Promise<any> {
    const data: WyrePaymentRequest = {
      dest,
      referrerAccountId,
      sourceCurrency,
      destCurrency,
      amount: paymentDetails.amount,
      debitCard: paymentDetails.debitCard,
      referenceId: paymentIds.referenceId,
      reservationId: paymentIds.reservationId,
      address: userDetails.address,
      givenName: userDetails.givenName,
      familyName: userDetails.familyName,
      email: userDetails.email,
      phone: userDetails.phone
    }

    const reservationIdQuery = this.db.get('reservations').find({ wyreReservationId: paymentIds.reservationId })
    const reservation = reservationIdQuery.value()
    if (reservation.referenceId !== paymentIds.referenceId) {
      return { error: `Reservation with ID ${reservation.referenceId} is created for referenceId ${reservation.referenceId}, but input reference ID is ${paymentIds.referenceId}` }
    }

    const url = host + '/debitcard/process/partner'
    try {
      console.log(`config: ${JSON.stringify(config)}`)
      const res = await axios.post(url, data, config)
      console.log(res)
      reservationIdQuery.assign({ wyreOrderId: res.data.id }).write()
      return {
        response: res.data
      }
    } catch
      (e) {
      console.error('error', e.response.data)
      return {
        error: JSON.stringify(e.response.data)
      }
    }
  }

  verifyRequestData (domain: string, relayRequest: RelayRequest): { isValidRequest: boolean, isCommitment: boolean } {
    const method = relayRequest.request.data.slice(0, 10)
    const data = relayRequest.request.data.slice(10)

    if (this.registrarAddress.toLowerCase() !== relayRequest.request.to.toLowerCase()) {
      console.log(`Wrong destination! Expected: ${this.registrarAddress}, actual: ${relayRequest.request.to}`)
      return { isValidRequest: false, isCommitment: false }
    }
    const commitMethodIdentifier = '0xf14fcbc8'

    if (commitMethodIdentifier === method) {
      console.log('Commitment method! Not checked!')
      // TODO: validate commitment is for correct operation! (Need 'secret' as input here)
      return { isValidRequest: true, isCommitment: true }
    }

    const registerMethodIdentifier = '0x85f6d155'
    const registerWithConfigMethodIdentifier = '0xf7a16963'
    if (!(registerMethodIdentifier === method || registerWithConfigMethodIdentifier === method)) {
      console.log(`Wrong method signature! Expected: ${registerMethodIdentifier} or ${registerWithConfigMethodIdentifier}, actual: ${method}`)
      return { isValidRequest: false, isCommitment: false }
    }

    const registerMethodSignature = ['string', 'address', 'uint256', 'bytes32']
    const decodedRelayCallParameters = this.web3.eth.abi.decodeParameters(registerMethodSignature, data)
    const requestedDomain = decodedRelayCallParameters[0]
    if (requestedDomain.toLowerCase() !== domain.toLowerCase()) {
      console.log(`Wrong destination! Expected: ${domain}, actual: ${requestedDomain}`)
      return { isValidRequest: false, isCommitment: false }
    }
    return { isValidRequest: true, isCommitment: false }
  }

  async signApproval (referenceId: string, isCommitment: boolean, relayRequest: RelayRequest): Promise<string> {

    // TODO: check and

    return signRelayRequest(relayRequest, this.signerPrivateKey)
  }
}
