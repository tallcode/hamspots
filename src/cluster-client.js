import net from 'net';
import { EventEmitter } from 'events';

export class DxClusterClient extends EventEmitter {
  constructor(host, port, callsign) {
    super();
    this.host = host;
    this.port = port;
    this.callsign = callsign;
    this.client = null;
    this.reconnectInterval = 5000; // 重连间隔 5s
  }

  connect() {
    console.log(`[${this.host}] Connecting...`);
    this.client = net.createConnection({ host: this.host, port: this.port }, () => {
      console.log(`[${this.host}] Connected!`);
      this.client.write(`${this.callsign}\n`);
    });

    this.client.on('data', (data) => {

        const rawString = data.toString();
    // 【调试核心】：打印服务器发回的所有原始文本
    console.log(`[${this.host}] RAW DATA: ${rawString.trim()}`);
    
    // 检查是否被服务器拒绝
    if (rawString.includes('Please enter your call')) {
      console.log(`[${this.host}] Node is asking for callsign...`);
    }

      const line = data.toString();
      const spot = this.parseSpot(line);
      if (spot) this.emit('spot', spot);
    });

    // 错误处理与自动重连
    this.client.on('error', (err) => console.error(`[${this.host}] Error:`, err.message));
    
    this.client.on('close', () => {
      console.log(`[${this.host}] Connection closed. Retrying in ${this.reconnectInterval / 1000}s...`);
      setTimeout(() => this.connect(), this.reconnectInterval);
    });
  }

  parseSpot(line) {
    // 典型的 DX Cluster 正则表达式
    const regex = /^DX de ([\w-]+):\s+([\d.]+)\s+([\w\d/]+)\s+(.*?)\s+(\d{4})Z/;
    const match = line.match(regex);
    if (match) {
      return {
        source: this.host,
        de: match[1],
        freq: match[2],
        dx: match[3],
        comment: match[4].trim(),
        time: match[5],
        timestamp: Date.now()
      };
    }
    return null;
  }
}