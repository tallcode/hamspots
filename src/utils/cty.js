import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function loadCtyDat(filePath) {
  const content = fs.readFileSync(path.join(__dirname, filePath), 'utf-8')
  const lines = content.split(/\r?\n/)

  const prefixMap = new Map()
  const exactMap = new Map()

  let currentEntity = null

  for (let line of lines) {
    line = line.trim()
    if (!line)
      continue

    if (line.includes(':') && line.endsWith(':')) {
      // 解析 Header 行
      const parts = line.split(':')
      currentEntity = {
        name: parts[0].trim(),
        cq: parts[1].trim(),
        itu: parts[2].trim(),
        continent: parts[3].trim(),
        lat: Number.parseFloat(parts[4]),
        lng: Number.parseFloat(parts[5]),
        tz: parts[6].trim(),
        primary: parts[7].trim(),
      }
    }
    else if (currentEntity) {
      // 解析前缀行 (处理以逗号分隔，分号结尾的情况)
      const cleanLine = line.replace(';', '')
      const prefixes = cleanLine.split(',')

      for (let p of prefixes) {
        p = p.trim()
        if (!p)
          continue

        // 移除占位符如 [24] 或 (30.5) 等辅助信息，保留纯前缀
        const rawPrefix = p.replace(/\[.*?\]|\(.*?\)/g, '')

        if (rawPrefix.startsWith('=')) {
          // 精确匹配
          exactMap.set(rawPrefix.substring(1), currentEntity)
        }
        else {
          // 前缀匹配
          prefixMap.set(rawPrefix, currentEntity)
        }
      }
    }
  }
  return { prefixMap, exactMap }
}

const { prefixMap, exactMap } = loadCtyDat('../data/cty.dat')

const ignoredSuffixes = new Set(['P', 'M', 'AM', 'MM', 'QRP', 'LH', 'IOTA', 'B', 'R'])
function lookup(target) {
  if (exactMap.has(target))
    return exactMap.get(target)

  for (let len = target.length; len > 0; len--) {
    const prefix = target.substring(0, len)
    if (prefixMap.has(prefix)) {
      return prefixMap.get(prefix)
    }
  }
  return null
}
export function getDXCC(callsign) {
  if (!callsign)
    return null
  const call = callsign.toUpperCase()
  const parts = call.split('/')

  // 1. 预处理：剔除已知无意义后缀 (从右往左)
  while (parts.length > 1 && ignoredSuffixes.has(parts[parts.length - 1])) {
    parts.pop()
  }

  // 2. 只有一部分，直接查
  if (parts.length === 1) {
    return lookup(parts[0])
  }

  // 3. 多部分处理 (核心改进)
  // 过滤掉纯数字（如 /7, /0），这些通常是地区号，不参与 DXCC 归属判定
  const filteredParts = parts.filter(p => !/^\d$/.test(p))
  if (filteredParts.length === 0) {
    return null
  }
  // 4. 长度优先匹配：短的通常是临时前缀 (如 W1/BY1AA)，长的通常是主呼号
  // 这种启发式算法在处理 W1/BY1AA 或 BY1AA/W1 时非常有效
  const sortedParts = [...filteredParts].sort((a, b) => a.length - b.length)
  for (const part of sortedParts) {
    const result = lookup(part)
    if (result)
      return result
  }

  return null
}
