import Web3 from 'web3'
import RelayRequest from '@opengsn/gsn/dist/src/common/EIP712/RelayRequest'

import ETHRegsitrarController from './ETHRegsitrarController.json'

import { ApproverLogic } from '../src/ApproverLogic'
import assert from 'assert'
import {
  GsnPaymentDetails,
  GsnUserDetails,
  WyrePaymentIds
} from '../src/Interfaces'
import { LowdbSync } from 'lowdb'

const nodeUrl = 'https://rinkeby.infura.io/v3/f40be2b1a3914db682491dc62a19ad43'
const newDomain = 'please-do-not-register-this-domain.eth'
const stubDb = {
  write: function () {
  }
} as LowdbSync<any>

describe('checkDomainNameAvailable', function () {
  let web3: Web3
  let utils: ApproverLogic

  before(function () {
    web3 = new Web3(nodeUrl)
    utils = new ApproverLogic(web3, stubDb, '')
  })

  it('should return true if address registered', async function () {
    const res = await utils.recordExists('ethereum.eth')
    assert.strictEqual(res, true)
  })

  it('should return false if address not registered', async function () {
    const res = await utils.recordExists(newDomain)
    assert.strictEqual(res, false)
  })
})

describe('paymentDone', function () {
  const reservation: string = ''
  const domain: string = newDomain
  const buyer: string = '0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1'
  const referenceId: string = `${buyer}:${domain}:${Date.now()}`

  let utils: ApproverLogic
  before(function () {
    utils = new ApproverLogic({} as Web3, stubDb, '')
  })

  it('should return false if domain info does not match the referenceId', async function () {
    const res = await utils.verifyPayment(reservation, `${buyer}:wrong-domain.eth:${Date.now()}`, domain, buyer)
    assert.strictEqual(res, false)
  })

  it('should return false if payment for domain not done', async function () {
    const res = await utils.verifyPayment(reservation, referenceId, domain, buyer)
    assert.strictEqual(res, false)
  })

  describe('paying for domain', function () {
    const paymentDetails: GsnPaymentDetails = {
      amount: '1',
      debitCard: {
        number: '4111111111111111',
        year: '2023',
        month: '01',
        cvv: '123'
      }
    }
    const userDetails: GsnUserDetails = {
      givenName: 'John',
      familyName: 'Doe',
      email: 'doe@example.com',
      phone: '+1-202-555-0178',
      address: {
        street1: '1550 Bryant Street',
        city: 'San Francisco',
        state: 'CA',
        postalCode: '94103',
        country: 'US'
      }
    }

    let reservationId: string
    let referenceId: string
    let orderId: string

    it('should create a wallet order reservation', async function () {
      const { response, referenceId: referenceIdCreated } = await utils.createReservation(buyer, domain)
      assert.notStrictEqual(referenceIdCreated, undefined)
      assert.strictEqual(response.reservation.length > 0, true)
      referenceId = referenceIdCreated!
      reservationId = response.reservation
    })

    it('should pay for a wallet order reservation', async function () {
      const paymentIds: WyrePaymentIds = { reservationId, referenceId }
      const { response } = await utils.createPayment(paymentIds, paymentDetails, userDetails)
      orderId = response.id
    })

    it('should return true if payment for domain was made', async function () {
      const res = await utils.verifyPayment(orderId, referenceId, domain, buyer)
      assert.strictEqual(res, true)
    })
  })
})

describe('verifyRequestData', function () {
  const registrarAddress = '0xe7410170f87102DF0055eB195163A03B7F2Bff4A'
  const buyer = '0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1'
  let relayRequest: RelayRequest
  let web3: Web3
  let utils: ApproverLogic
  let data: string

  before(function () {
    web3 = new Web3(nodeUrl)
    utils = new ApproverLogic(web3, stubDb, registrarAddress)
    // @ts-ignore
    const registrar = new web3.eth.Contract(ETHRegsitrarController.abi)
    data = registrar.methods.register(newDomain, buyer, 0, '0x0000000000000000000000000000000000000000000000000000000000000000').encodeABI()
    relayRequest = {
      request: {
        data,
        to: registrarAddress,
        from: '',
        value: '',
        nonce: '',
        gas: ''
      },
      relayData: {
        gasPrice: '',
        pctRelayFee: '',
        baseRelayFee: '',
        relayWorker: '',
        paymaster: '',
        paymasterData: '',
        clientId: '',
        forwarder: ''
      }
    }
  })

  it('should return false for calls to wrong address')
  it('should return false for calls to wrong method')

  it('should return false for calls to register wrong domain', function () {
    const res = utils.verifyRequestData('wrong-domain.eth', relayRequest)
    assert.strictEqual(res, false)
  })

  it('should return true for calls to register domain', function () {
    const res = utils.verifyRequestData(newDomain, relayRequest)
    assert.strictEqual(res, true)
  })
})
