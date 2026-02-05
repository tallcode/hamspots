import { EventEmitter } from 'node:events'
import net from 'node:net'
import process from 'node:process'
import { connect, StringCodec } from 'nats'
import { parseSpot } from './utils/parseSpot.js'

export class DxClusterClient extends EventEmitter {
  constructor(host, port, callsign) {
    super()
    this.host = host
    this.port = port
    this.callsign = callsign
    this.client = null
    this.reconnectInterval = 5000 // 重连间隔 5s
  }

  connect() {
    this.client = net.createConnection({ host: this.host, port: this.port }, () => {
      this.client.write(`${this.callsign}\n`)
    })

    this.client.on('data', (data) => {
      const rawString = data.toString()
      if (rawString) {
        const lines = rawString.trim().split('\n')
        lines.forEach((line) => {
          console.log(`[${this.host}] ${line}`)
          const spot = parseSpot(line)
          if (spot)
            this.emit('spot', spot)
        })
      }
    })

    // 错误处理与自动重连
    this.client.on('error', err => console.error(`[${this.host}] Error:`, err.message))
    this.client.on('close', () => {
      console.log(`[${this.host}] Connection closed. Retrying in ${this.reconnectInterval / 1000}s...`)
      setTimeout(() => this.connect(), this.reconnectInterval)
    })
  }
}

async function start() {
  const natsConnectionString = process.env.NATS_URL || 'nats://localhost:4222'
  const nc = await connect({ servers: [natsConnectionString] })
  const sc = StringCodec()

  // 从环境变量读取集群配置
  const clusterHost = process.env.CLUSTER_HOST
  const clusterPort = process.env.CLUSTER_PORT
  const callsign = process.env.CALLSIGN || 'BG5ATV'

  if (!clusterHost || !clusterPort) {
    console.error('Error: CLUSTER_HOST and CLUSTER_PORT environment variables are required')
    process.exit(1)
  }

  console.log(`[${clusterHost}] Starting cluster service`)

  const client = new DxClusterClient(clusterHost, Number.parseInt(clusterPort), callsign)
  client.connect()
  client.on('spot', (spot) => {
    nc.publish('spots.parsed', sc.encode(JSON.stringify(spot)))
  })
}

start()
