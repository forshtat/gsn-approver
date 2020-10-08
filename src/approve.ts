// import {RelayServer} from '@opengsn/gsn/dist/src/relayserver/RelayServer'
// Docs on event and context https://www.netlify.com/docs/functions/#the-handler-method
import chalk from 'chalk'
import { APIGatewayEvent, Context } from 'aws-lambda'

import { calculateHashcash } from '@opengsn/paymasters/dist/src/HashCashApproval'

export async function handler (
  event: APIGatewayEvent,
  context: Context
) {
  let calculateHashcash1 = calculateHashcash('0x1abB7814d355bDb11c812A17cA54BCdb3E31FB14', '0', 1)
  console.log(chalk.red('WWAAAAA!'), calculateHashcash1)

  try {
    const subject = event.queryStringParameters?.name || 'World'
    return {
      statusCode: 200,
      body: JSON.stringify({ message: `Hello ${subject}` }),
      // // more keys you can return:
      // headers: { "headerName": "headerValue", ... },
      // isBase64Encoded: true,
    }
  } catch (err) {
    return { statusCode: 500, body: err.toString() }
  }
}
