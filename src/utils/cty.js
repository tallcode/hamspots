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

  /**
   * 正则解析说明：
   * 1. ^(=?[^(\[< ]+) : 匹配前缀（可选 = 号开头），直到遇到 ( [ < 或空格
   * 2. (?:\(([^)]+)\))? : 捕获 ITU 分区例外，如 (23)
   * 3. (?:\[([^\]]+)\])? : 捕获 CQ 分区例外，如 [43]
   * 4. (?:<([^>]+)>)?    : 捕获经纬度例外，如 <31.2/121.4>
   */
  const prefixRegex = /^([^([< ]+)(?:\(([^)]+)\))?(?:\[([^\]]+)\])?(?:<([^>]+)>)?/

  for (let line of lines) {
    line = line.trim()
    if (!line)
      continue

    // 处理 Header 行 (以冒号分隔并以冒号结尾)
    if (line.includes(':') && line.endsWith(':')) {
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
    // 处理前缀行
    else if (currentEntity) {
      const cleanLine = line.replace(';', '')
      const prefixes = cleanLine.split(',')

      for (let p of prefixes) {
        p = p.trim()
        if (!p)
          continue

        const match = p.match(prefixRegex)
        if (match) {
          const rawPrefix = match[1].toUpperCase()
          const overrideItu = match[2]
          const overrideCq = match[3]
          const overrideCoords = match[4]

          // 基础数据对象
          const data = { ...currentEntity }

          // 应用例外覆盖
          if (overrideItu)
            data.itu = overrideItu
          if (overrideCq)
            data.cq = overrideCq
          if (overrideCoords) {
            const [lat, lng] = overrideCoords.split('/')
            data.lat = Number.parseFloat(lat)
            data.lng = Number.parseFloat(lng)
          }

          // 分配到对应的 Map
          if (rawPrefix.startsWith('=')) {
            exactMap.set(rawPrefix.substring(1), data)
          }
          else {
            prefixMap.set(rawPrefix, data)
          }
        }
      }
    }
  }

  return { prefixMap, exactMap }
}

const { prefixMap, exactMap } = loadCtyDat('../data/cty.dat')

const ignoredSuffixes = new Set(['P', 'M', 'AM', 'MM', 'QRP', 'LH', 'IOTA', 'B', 'R'])
function lookup(target, percise = false) {
  if (exactMap.has(target))
    return exactMap.get(target)
  // 精确匹配模式下不进行前缀查找
  if (percise) {
    return null
  }

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
  // 先精确匹配整体呼号 (如 BY1AA/9)
  const perciseResult = lookup(call, true)
  if (perciseResult) {
    return perciseResult
  }
  const parts = call.split('/')

  // 1. 预处理：剔除已知无意义后缀 (从右往左)
  while (parts.length > 1 && ignoredSuffixes.has(parts[parts.length - 1])) {
    parts.pop()
  }
  // 2. 只有一部分，直接查
  if (parts.length === 1) {
    return lookup(parts[0])
  }
  // 3. 多部分处理
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
