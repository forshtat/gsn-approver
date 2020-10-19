import { APIGatewayEvent } from 'aws-lambda'
import { signRelayRequest } from '@opengsn/paymasters/dist/src/VerifyingPaymasterUtils'
import RelayRequest from '@opengsn/gsn/dist/src/common/EIP712/RelayRequest'
import { Utils } from './utils/utils'
import Web3 from 'web3'
import { HttpProvider } from 'web3-core'

const ACCOUNT_9 = '0xb0057716d5917badaf911b193b12b910811c1497b5bada8d7711f758981c3773'

const nodeUrl = process.env.NODE_URL ?? 'https://rinkeby.infura.io/v3/f40be2b1a3914db682491dc62a19ad43'
const registrarAddress = process.env.ETH_REIGSTRAR_CONTROLLER ?? '0xe7410170f87102DF0055eB195163A03B7F2Bff4A'

interface ApproveRequest {
  relayRequest: RelayRequest,
  domain: string,
  referenceId: string,
  orderId: string
}

export async function handler (
  event: APIGatewayEvent
) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }
  if (event.body == null || event.body.length === 0) {
    return { statusCode: 400, body: 'Empty Request Body' }
  }

  const approveRequest: ApproveRequest = JSON.parse(event.body)
  const signerPrivateKeyString = process.env.PRIVATE_KEY ?? ACCOUNT_9
  const signerPrivateKey = Buffer.from(signerPrivateKeyString.replace('0x', ''), 'hex')
  const responseHeaders = {
    'Access-Control-Allow-Origin': '*'
  }

  const utils = new Utils(new Web3(new HttpProvider(nodeUrl)), registrarAddress)
  const isValidRequest = utils.verifyRequestData(approveRequest.domain, approveRequest.relayRequest)
  const isPaidFor = await utils.paymentDone(approveRequest.orderId, approveRequest.referenceId, approveRequest.domain, approveRequest.relayRequest.request.from)
  const isAlreadyRegistered = await utils.recordExists(approveRequest.domain)

  if (isAlreadyRegistered || !isValidRequest || !isPaidFor){
    return {
      statusCode: 400,
      body: JSON.stringify({ error: `isAlreadyRegistered: ${isAlreadyRegistered} isValidRequest: ${isValidRequest} isPaidFor: ${isPaidFor}`}),
      headers: responseHeaders
    }
  }

  try {
    const approvalData = signRelayRequest(approveRequest.relayRequest, signerPrivateKey)
    console.log(`
    approval request: ${event.body}
    signer key: ${signerPrivateKeyString}
    approval data: ${approvalData}
    `)
    return {
      statusCode: 200,
      body: JSON.stringify({ approvalData }),
      headers: responseHeaders
    }
  } catch (err) {
    return { statusCode: 500, body: err.toString() }
  }
}
