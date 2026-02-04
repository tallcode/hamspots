import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { EventEmitter } from 'events';
import { DxClusterClient } from './cluster-client.js';
import { SpotCache } from './lru-cache.js';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import path from 'path';
import { logger } from 'hono/logger'

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = new Hono();

const spotEvents = new EventEmitter();
spotEvents.setMaxListeners(100); // 允许更多并发订阅者
const spotCache = new SpotCache(1000);

// 1. 初始化多个 Cluster 节点进行聚合
const clusters = [
  { host: 'dxspider.co.uk', port: 7300 },
  // { host: 'dxc.nc7j.com', port: 7373 }
  // { host: 'dxc.k1ttt.net', port: 7300 },
  // { host: 'db0erf.de', port: 8000 }
];

clusters.forEach(c => {
  const client = new DxClusterClient(c.host, c.port, 'BG5ATV');
  client.connect();
  // 汇总所有节点的 spot
  client.on('spot', (spot) => {
    spotCache.add(spot);
    spotEvents.emit('broadcast', spot);
  });
});


app.use('*', logger());
// 历史缓存接口
app.get('/api/spots', (c) => {
  return c.json({ data: spotCache.getAll() });
});
// 2. 实现 SSE 路由
app.get('/sse/spots', async (c) => {
  return streamSSE(c, async (stream) => {
    // 监听聚合后的事件
    const listener = (spot) => {
      stream.writeSSE({
        data: JSON.stringify(spot),
        event: 'new-spot',
        id: String(spot.timestamp),
      });
    };

    spotEvents.on('broadcast', listener);

    // 当客户端断开 SSE 连接时清理监听器
    stream.onAbort(() => {
      spotEvents.off('broadcast', listener);
      console.log('SSE Client disconnected');
    });

    // 保持连接的心跳
    while (true) {
      await stream.sleep(30000);
      // 使用 data 字段替代 comment 以避免 Hono 处理兼容性问题
      await stream.writeSSE({ event: 'ping', data: 'keep-alive' });
    }
  });
});

// 3. Web 页面（/）展示 SSE 数据
app.get('/', async (c) => {
  const html = await fs.readFile(path.join(__dirname, 'index.html'), 'utf-8');
  return c.html(html);
});

app.onError((err, c) => {
  console.error(err);
  return c.text('Internal Server Error', 500);
});


serve({fetch: app.fetch,  port: 3000 }, (info) => {
  console.log(`Server running at http://localhost:${info.port}`);
});