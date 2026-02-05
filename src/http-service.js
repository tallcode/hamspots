import { EventEmitter } from 'node:events'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { streamSSE } from 'hono/streaming'
import { MongoClient } from 'mongodb'
import { connect as natsConnect, StringCodec } from 'nats'
import { formatSpotTime } from './utils/parseSpot.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const NATS_URL = process.env.NATS_URL || 'nats://localhost:4222'
const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017'
const DB_NAME = 'dxsummit'
const COLLECTION_NAME = 'spots'

const app = new Hono()
const spotEvents = new EventEmitter()
spotEvents.setMaxListeners(100)

// Connect to MongoDB
let collection
const mongoClient = new MongoClient(MONGO_URL)
mongoClient.connect().then(() => {
  const db = mongoClient.db(DB_NAME)
  collection = db.collection(COLLECTION_NAME)
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

// 格式化spot对象，添加timeDisplay字段
function formatSpot(spot) {
  if (spot.time) {
    return {
      ...spot,
      timeDisplay: formatSpotTime(spot.time),
    }
  }
  return spot
}

// API to get historical spots
app.get('/api/spots', async (c) => {
  if (!collection) {
    return c.json({ error: 'Not connected to database' }, 503)
  }
  const spots = await collection.find().sort({ createdAt: -1 }).limit(100).toArray()
  const formattedSpots = spots.map(formatSpot)
  return c.json({ data: formattedSpots })
})

// SSE route for new spots
app.get('/sse/spots', async (c) => {
  return streamSSE(c, async (stream) => {
    const listener = (spot) => {
      const formattedSpot = formatSpot(spot)
      stream.writeSSE({
        data: JSON.stringify(formattedSpot),
        event: 'new-spot',
        id: spot._id.toString(),
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

// Serve frontend
app.get('/', async (c) => {
  const html = await fs.readFile(path.join(__dirname, 'index.html'), 'utf-8')
  return c.html(html)
})

app.onError((err, c) => {
  console.error(err)
  return c.text('Internal Server Error', 500)
})

const port = Number.parseInt(process.env.PORT || '3000', 10)
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Server running at http://localhost:${info.port}`)
})
