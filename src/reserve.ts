import { APIGatewayEvent } from 'aws-lambda'
import request, { CoreOptions, Response } from 'request'

interface OrderReservationRequest {
  referrerAccountId: string,
  lockFields: string[]
  amount?: number,
  sourceCurrency?: string,
  destCurrency?: string,
  email: string,
  dest?: string,
  givenName?: string,
  familyName?: string,
  city?: string,
  phone?: string,
  street1?: string,
  country?: string,
  redirectUrl?: string,
  failureRedirectUrl?: string,
  paymentMethod?: string,
  state?: string,
  postalCode?: string
}

export async function handler (
  event: APIGatewayEvent
) {
  if (event.body == null || event.body.length === 0) {
    return { statusCode: 400, body: 'Empty Request Body' }
  }
  const orderReservationRequest: OrderReservationRequest = JSON.parse(event.body)

  const promise = new Promise((resolve, reject) => {
    const callback = function (error: any, response: Response, body: any): void {
      console.log('resolved', response.statusCode, body)
      if (response.statusCode === 200) {
        resolve(body)
      } else {
        reject(body)
      }
      return
    }
    let wyreSecretKey = process.env.WYRE_SECRET_KEY
    let options: CoreOptions = {
      json: true,
      headers: {
        'Authorization': `Bearer ${wyreSecretKey}`
      }
    }
    const uri = process.env.WYRE_RESERVE_URL ?? 'https://api.testwyre.com/v3/orders/reserve'
    const httpReservationRequest = request.post(uri, options, callback)
    httpReservationRequest.on('error', function (error: Error) {
      console.log('rejected')
      reject(error)
    })
    httpReservationRequest.write(JSON.stringify(orderReservationRequest))
    httpReservationRequest.end()
  })
  const responseHeaders = {
    'Access-Control-Allow-Origin': '*'
  }
  try {
    let response = await promise
    return {
      statusCode: 200,
      headers: responseHeaders,
      body: JSON.stringify(response)
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
