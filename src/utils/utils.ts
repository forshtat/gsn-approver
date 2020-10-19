import Web3 from 'web3'
import axios, { AxiosRequestConfig } from 'axios'
import RelayRequest from '@opengsn/gsn/dist/src/common/EIP712/RelayRequest'

import {
  GsnPaymentDetails,
  GsnUserDetails,
  WyreOrderReservationRequest,
  WyrePaymentIds,
  WyrePaymentRequest
} from './WyreTypes'

const host: string = process.env.WYRE_HOST ?? 'https://api.testwyre.com/v3'
const dest: string = process.env.WYRE_PAYMENT_DESTINATION!
const referrerAccountId: string = process.env.WYRE_ACCOUNT_ID ?? 'AC_8678L3X4MPC'
const config: AxiosRequestConfig = { headers: { 'Authorization': `Bearer ${process.env.WYRE_SECRET_KEY}` } }

const sourceCurrency: string = 'USD'
const destCurrency: string = 'ETH'

export class Utils {
  constructor (
    private web3: Web3,
    private registrarAddress: string
  ) {}

  async recordExists (domain: string): Promise<boolean> {
    return await this.web3.eth.ens.recordExists(domain)
  }

  async paymentDone (orderId: string, referenceId: string, domain: string, buyer: string): Promise<boolean> {
    const [buyerPaid, domainPaid] = referenceId.split(':')
    if (buyerPaid.toLowerCase() !== buyer.toLowerCase() || domainPaid.toLowerCase() !== domain.toLowerCase()) {
      console.log('reference ID does not match the domain')
      return false
    }

    try {
      const res = await axios.get(`https://api.testwyre.com/v3/orders/${orderId}`)
      console.log(res.status, res.data)
      // TODO: this is not a check as it does not verify orderId is paid or that it corresponds to the referenceId
      return res.status === 200
    } catch (e) {
      console.error('error', e.response.data)
      return false
    }
  }

  async createReservation (buyer: string, domain: string): Promise<{
    error: string | undefined
    response: any,
    referenceId: string | undefined
  }> {
    const timestamp = Date.now()
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
    let wyreSecretKey = process.env.WYRE_SECRET_KEY
    let axiosRequestConfig: AxiosRequestConfig = {
      headers: {
        'Authorization': `Bearer ${wyreSecretKey}`
      }
    }
    const url = host + '/orders/reserve'
    let response: any
    try {
      response = await axios.post(url, orderReservationRequest, axiosRequestConfig)
      console.log(response.data)
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

    const url = host + '/debitcard/process/partner'
    try {
      const res = await axios.post(url, data, config)
      console.log(res)
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

  verifyRequestData (domain: string, relayRequest: RelayRequest): boolean {
    const method = relayRequest.request.data.slice(0, 10)
    const data = relayRequest.request.data.slice(10)

    if (this.registrarAddress.toLowerCase() !== relayRequest.request.to.toLowerCase()) {
      console.log(`Wrong destination! Expected: ${this.registrarAddress}, actual: ${relayRequest.request.to}`)
      return false
    }
    const registerMethodIdentifier = '0x85f6d155'
    const registerWithConfigMethodIdentifier = '0xf7a16963'
    if (!(registerMethodIdentifier === method || registerWithConfigMethodIdentifier === method)) {
      console.log(`Wrong method signature! Expected: ${registerMethodIdentifier} or ${registerWithConfigMethodIdentifier}, actual: ${method}`)
      return false
    }

    const registerMethodSignature = ['string', 'address', 'uint256', 'bytes32']
    const decodedRelayCallParameters = this.web3.eth.abi.decodeParameters(registerMethodSignature, data)
    const requestedDomain = decodedRelayCallParameters[0]
    if (requestedDomain.toLowerCase() !== domain.toLowerCase()){
      console.log(`Wrong destination! Expected: ${domain}, actual: ${requestedDomain}`)
      return false
    }
    return true
  }
}
