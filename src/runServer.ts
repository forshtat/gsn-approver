import commander from 'commander'

import { ApproverServer } from './ApproverServer'

commander
  .version('0.0.1')
  .option('-p, --port <port>', 'port to listen on', '7000')
  .parse(process.argv)

function run (): void {
  console.log('Starting GSN Approver Server process...\n')
  new ApproverServer(commander.port)
}

run()
