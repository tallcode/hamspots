import { EventEmitter } from 'node:events'
import process from 'node:process'

import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { streamSSE } from 'hono/streaming'
import { MongoClient, type Collection, type WithId, type Document } from 'mongodb'
import { connect as natsConnect, StringCodec } from 'nats'
import type { Spot } from './utils/parseSpot.js'

const NATS_URL = process.env.NATS_URL || 'nats://localhost:4222'
const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017'
const DB_NAME = 'dxsummit'
const COLLECTION_NAME = 'spots'

const app = new Hono()
const spotEvents = new EventEmitter()
spotEvents.setMaxListeners(100)

interface SpotWithId extends Spot {
  _id: string
}

// Connect to MongoDB
let collection: Collection<Spot> | undefined
const mongoClient = new MongoClient(MONGO_URL)
mongoClient.connect().then(() => {
  const db = mongoClient.db(DB_NAME)
  collection = db.collection<Spot>(COLLECTION_NAME)
  console.log('Connected to MongoDB')
})

// Connect to NATS and subscribe to clean spots
async function watchSpots() {
  const nc = await natsConnect({ servers: [NATS_URL] })
  const sc = StringCodec()
  const sub = nc.subscribe('spots.clean')
  console.log('Connected to NATS and subscribed to spots.clean');

  (async () => {
    for await (const m of sub) {
      const spot = JSON.parse(sc.decode(m.data))
      spotEvents.emit('broadcast', spot)
    }
  })()
}

watchSpots()

app.use('*', logger())

// 格式化spot对象
function formatSpot(spot: WithId<Spot> | Spot): Spot & { _id?: string } {
  const result: Spot & { _id?: string } = { ...spot, _id: undefined }
  if ('_id' in spot && spot._id) {
    result._id = spot._id.toString()
  }
  return result
}

// SSE route for new spots
app.get('/sse/spots', async (c) => {
  return streamSSE(c, async (stream) => {
    // 立即发送连接确认消息，确保客户端能立刻知道连接已建立，并发送服务器当前UTC时间
    await stream.writeSSE({
      event: 'connected',
      data: JSON.stringify({ serverTime: Date.now() }),
    })

    // 逐条发送历史记录
    if (collection) {
      try {
        const spots = await collection.find().sort({ createdAt: -1 }).limit(100).toArray()
        // 倒序发送，让前端unshift后最新的在最上面
        spots.reverse()
        for (const spot of spots) {
          const formattedSpot = formatSpot(spot)
          await stream.writeSSE({
            event: 'spot',
            data: JSON.stringify(formattedSpot),
            id: spot._id?.toString(),
          })
        }
      } catch (err) {
        console.error('Failed to load history for SSE', err)
      }
    }

    const listener = (spot: WithId<Spot>) => {
      const formattedSpot = formatSpot(spot)
      stream.writeSSE({
        data: JSON.stringify(formattedSpot),
        event: 'spot',
        id: spot._id?.toString(),
      })
    }

    spotEvents.on('broadcast', listener)

    stream.onAbort(() => {
      spotEvents.off('broadcast', listener)
      console.log('SSE Client disconnected')
    })

    while (true) {
      await stream.sleep(30000)
      await stream.writeSSE({ event: 'ping', data: 'keep-alive' })
    }
  })
})

app.onError((err, c) => {
  console.error(err)
  return c.text('Internal Server Error', 500)
})

const port = Number.parseInt(process.env.PORT || '3000', 10)
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Server running at http://localhost:${info.port}`)
})
