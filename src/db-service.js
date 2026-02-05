import process from 'node:process'
import { MongoClient } from 'mongodb'
import { connect as natsConnect, StringCodec } from 'nats'
import { markSpot } from './utils/mark.js'

const NATS_URL = process.env.NATS_URL || 'nats://localhost:4222'
const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017'
const DB_NAME = 'dxsummit'
const COLLECTION_NAME = 'spots'
const TTL_SECONDS = 7 * 24 * 60 * 60 // 7 days
const DEDUP_WINDOW_MINUTES = Number.parseInt(process.env.DEDUP_WINDOW_MINUTES || '3', 10) // 去重时间窗口（分钟）

async function start() {
  // Connect to MongoDB
  const mongoClient = new MongoClient(MONGO_URL)
  await mongoClient.connect()
  const db = mongoClient.db(DB_NAME)
  const collection = db.collection(COLLECTION_NAME)

  // Create TTL index
  await collection.createIndex({ createdAt: 1 }, { expireAfterSeconds: TTL_SECONDS })
  // Create index for deduplication queries
  await collection.createIndex({ de: 1, freq: 1, dx: 1, createdAt: -1 })

  console.log(`Connected to MongoDB`)

  // Connect to NATS
  const nc = await natsConnect({ servers: [NATS_URL] })
  const sc = StringCodec()
  const sub = nc.subscribe('spots.parsed')
  console.log('Connected to NATS and subscribed to spots.parsed')

  // 应用层锁：防止并发处理相同的 de+freq+dx 组合
  const processing = new Map();

  (async () => {
    for await (const m of sub) {
      const spot = JSON.parse(sc.decode(m.data))
      // 将createdAt从字符串转换回Date对象
      spot.createdAt = new Date(spot.createdAt)

      const key = `${spot.de}_${spot.freq}_${spot.dx}`

      // 如果这个 key 正在处理中，等待它完成
      if (processing.has(key)) {
        await processing.get(key)
        continue // 重复的请求，跳过
      }

      // 创建处理 Promise 并存入 Map
      const processPromise = (async () => {
        try {
          // 检查时间窗口内是否已存在相同的 de、freq 和 dx
          const windowStart = new Date(spot.createdAt.getTime() - DEDUP_WINDOW_MINUTES * 60 * 1000)
          const existing = await collection.findOne({
            de: spot.de,
            freq: spot.freq,
            dx: spot.dx,
            createdAt: { $gte: windowStart },
          })

          if (!existing) {
            const marks = markSpot(spot)
            const _spot = { ...spot, marks }
            await collection.insertOne(_spot)
            nc.publish('spots.clean', sc.encode(JSON.stringify(_spot)))
            console.log(`spot: ${_spot.de} ${_spot.freq} ${_spot.dx}`)
          }
        }
        catch (error) {
          console.error('Error inserting spot into MongoDB:', error)
        }
        finally {
          processing.delete(key)
        }
      })()

      processing.set(key, processPromise)
    }
  })()
}

start()
