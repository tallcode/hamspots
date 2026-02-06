import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'

dayjs.extend(utc)

/**
 * 解析 DX Cluster SPOT 信息
 * @param {string} line - 原始的 DX Cluster 数据行
 * @returns {object | null} 解析后的 SPOT 对象，如果解析失败则返回 null
 */
// 典型的 DX Cluster 正则表达式
// 在DX和comment之间用单个空格分隔，避免量词重叠
const regex = /^DX de ([\w-]+):\s+([\d.]+)\s+([\w/]+)\s(.*)(\d{4})Z\s*$/
export function parseSpot(line) {
  const match = line.trim().match(regex)

  if (match) {
    const now = new Date()
    const timeStr = match[5] // "0708" 格式
    const hours = Number.parseInt(timeStr.substring(0, 2), 10)
    const minutes = Number.parseInt(timeStr.substring(2, 4), 10)

    // 构建UTC时间戳（结合今天的日期）
    const spotTime = dayjs.utc().hour(hours).minute(minutes).second(0).millisecond(0)

    return {
      de: match[1].replace(/-[\d#@]*$/, ''),
      freq: match[2],
      dx: match[3],
      comment: match[4].trim(),
      time: spotTime.valueOf(), // UTC时间戳（毫秒）
      createdAt: now,
    }
  }

  return null
}

/**
 * 格式化时间戳为 HH:mm:ss 格式
 * @param {number} timestamp - UTC时间戳（毫秒）
 * @returns {string} HH:mm:ss 格式的时间字符串
 */
export function formatSpotTime(timestamp) {
  return dayjs(timestamp).utc().format('HH:mm:ss')
}
