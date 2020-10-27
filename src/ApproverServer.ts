import Web3 from 'web3'
import bodyParser from 'body-parser'
import cors from 'cors'
import express from 'express'
import { Request, Response } from 'express-serve-static-core'
import FileSync from 'lowdb/adapters/FileSync'

import { ApproveRequest, ENSGSNRequest } from './Interfaces'
import { ApproverLogic } from './ApproverLogic'
import lowdb from 'lowdb/lib/main'

const signerPrivateKeyString = process.env.PRIVATE_KEY ?? '0x3b210655710954adc488f0bd032d15fab0b0acc5d1126d3b2d437e7aa3ee1eeb'
const nodeUrl = process.env.NODE_URL ?? 'https://rinkeby.infura.io/v3/f40be2b1a3914db682491dc62a19ad43'
const registrarAddress = process.env.ETH_REIGSTRAR_CONTROLLER ?? '0x283Af0B28c62C092C9727F1Ee09c02CA627EB7F5'

// TODO:
//  1. add some input schema validation (ow?)

export class ApproverServer {
  private logic: ApproverLogic

  constructor (port: number) {

    const adapter = new FileSync('db.json')
    const db = lowdb(adapter)
    const signerPk = Buffer.from(signerPrivateKeyString.replace('0x', ''), 'hex')
    this.logic = new ApproverLogic(new Web3(new Web3.providers.HttpProvider(nodeUrl)), db, signerPk, registrarAddress)

    const app = express()
    app.use(cors())
    app.use(bodyParser.json())

    app.post('/reserve', this.reserveHandler.bind(this))
    app.post('/purchase', this.purchaseHandler.bind(this))
    app.post('/approve', this.approveHandler.bind(this))

    app.listen(port, () => {
      console.log('Listening on port', port)
    })
  }

  async reserveHandler (req: Request, res: Response): Promise<void> {
    const ensGsnRequest: ENSGSNRequest = req.body

    const recordExists = await this.logic.recordExists(ensGsnRequest.domain)
    console.log(`record ${ensGsnRequest.domain} exists: ${recordExists}`)
    if (recordExists) {
      res.status(400).send({
        error: `Domain name ${ensGsnRequest.domain} is already registered`
      })
    }
    try {
      const { response, referenceId } = await this.logic.createReservation(ensGsnRequest.buyer, ensGsnRequest.domain)
      res.send({
        wyreResponse: response,
        referenceId
      })
    } catch (error) {
      console.log(error)
      res.status(500).send({ error: JSON.stringify(error, Object.getOwnPropertyNames(error)) })
      return
    }
  }

  async purchaseHandler (req: Request, res: Response): Promise<void> {
    const { paymentIds, paymentDetails, userDetails } = req.body
    try {
      const response = await this.logic.createPayment(paymentIds, paymentDetails, userDetails)
      console.log('purchaseHandler', req.body, response)
      res.send({ response })
    } catch (err) {
      console.error(err)
      res.status(500).send({ error: err.toString() })
    }
  }

  async approveHandler (req: Request, res: Response): Promise<void> {
    const approveRequest: ApproveRequest = req.body
    const { isValidRequest, isCommitment } = this.logic.verifyRequestData(approveRequest.domain, approveRequest.relayRequest)
    const isPaidFor = await this.logic.verifyPayment(approveRequest.orderId, approveRequest.referenceId, approveRequest.domain, approveRequest.relayRequest.request.from)
    const isAlreadyRegistered = await this.logic.recordExists(approveRequest.domain)

    if (isAlreadyRegistered || !isValidRequest || !isPaidFor) {
      res.status(400).send({ error: `isAlreadyRegistered: ${isAlreadyRegistered} isValidRequest: ${isValidRequest} isPaidFor: ${isPaidFor}` })
      return
    }
    try {
      const approvalData = this.logic.signApproval(approveRequest.referenceId, isCommitment, approveRequest.relayRequest)
      console.log(`
    approval request: ${req.body}
    signer key: ${signerPrivateKeyString}
    approval data: ${approvalData}
    `)
      res.send({ approvalData })
      return
    } catch (err) {
      res.status(500).send({ error: err.toString() })
    }
  }
}
