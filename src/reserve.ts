import { APIGatewayEvent } from 'aws-lambda'
import Web3 from 'web3'
import { HttpProvider } from 'web3-core'

import { Utils } from './utils/utils'

const registrarAddress = process.env.ETH_REIGSTRAR_CONTROLLER ?? '0xe7410170f87102DF0055eB195163A03B7F2Bff4A'

interface ENSGSNRequest {
  domain: string,
  buyer: string
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
  const ensGsnRequest: ENSGSNRequest = JSON.parse(event.body)
  const nodeUrl = process.env.NODE_URL ?? 'https://rinkeby.infura.io/v3/f40be2b1a3914db682491dc62a19ad43'
  const utils = new Utils(new Web3(new HttpProvider(nodeUrl)), registrarAddress)

  const isDomainAvailable = await utils.recordExists(ensGsnRequest.domain)
  if (!isDomainAvailable) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: `Domain name ${ensGsnRequest.domain} is already registered`
      })
    }
  }

  const responseHeaders = {
    'Access-Control-Allow-Origin': '*'
  }
  try {
    const { response, referenceId } = await utils.createReservation(ensGsnRequest.buyer, ensGsnRequest.domain)
    return {
      statusCode: 200,
      headers: responseHeaders,
      body: {
        wyreResponse: JSON.stringify(response),
        referenceId
      }
    }
  } catch (error) {
    console.log(error)
    return {
      statusCode: 500,
      headers: responseHeaders,
      body: JSON.stringify(error, Object.getOwnPropertyNames(error))
    }
  }
}
