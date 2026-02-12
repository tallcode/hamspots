import type { Spot } from './parseSpot.js'
import { Buffer } from 'node:buffer'
import { markSpot } from './mark.js'

export interface FilterConfig {
  freqMarks?: {
    include?: string[]
    exclude?: string[]
  }
  specificFreq?: {
    include?: string[]
    exclude?: string[]
  }
  dxMarks?: {
    include?: string[]
    exclude?: string[]
  }
  modeMarks?: {
    include?: string[]
    exclude?: string[]
  }
  dxcc?: {
    include?: string[] // DXCC primary 前缀列表（只支持包含）
  }
  callsign?: string // 呼号过滤器（支持 ? * 通配符）
}

/**
 * 将呼号模式转换为正则表达式字符串
 * @param pattern - 用户输入的呼号模式
 * @returns 正则表达式字符串
 */
function getCallsignRegexPattern(pattern: string): string {
  const hasWildcard = pattern.includes('*') || pattern.includes('?')
  // 转义正则特殊字符，除了 * 和 ?
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&')

  if (hasWildcard) {
    // 将 * 转换为 .*，将 ? 转换为 .，并锚定首尾
    return `^${escaped.replace(/\*/g, '.*').replace(/\?/g, '.')}$`
  }
  else {
    // 默认包含匹配
    return escaped
  }
}

/**
 * 检查spot是否匹配过滤器配置
 * @param spot - 要检查的spot
 * @param filter - 过滤器配置
 * @returns 如果匹配返回true，否则返回false
 */
export function matchFilter(spot: Spot & { marks?: ReturnType<typeof markSpot> }, filter: FilterConfig): boolean {
  // 如果没有marks，先生成
  if (!spot.marks) {
    spot.marks = markSpot(spot)
  }

  const { freqMarks = [], dxMarks = [], modeMarks = [] } = spot.marks

  // 显式类型断言
  const freqMarksArray = freqMarks as string[]
  const dxMarksArray = dxMarks as string[]
  const modeMarksArray = modeMarks as string[]

  // 检查频率标记
  if (filter.freqMarks) {
    // 如果设置了include，必须包含至少一个
    if (filter.freqMarks.include && filter.freqMarks.include.length > 0) {
      const hasMatch = freqMarksArray.some(mark => filter.freqMarks!.include!.includes(mark))
      if (!hasMatch)
        return false
    }
    // 如果设置了exclude，不能包含任何一个
    if (filter.freqMarks.exclude && filter.freqMarks.exclude.length > 0) {
      const hasExcluded = freqMarksArray.some(mark => filter.freqMarks!.exclude!.includes(mark))
      if (hasExcluded)
        return false
    }
  }

  // 检查具体频率标记（如 1.8MHz, 3.5MHz 等）
  if (filter.specificFreq) {
    if (filter.specificFreq.include && filter.specificFreq.include.length > 0) {
      const hasMatch = freqMarksArray.some(mark => filter.specificFreq!.include!.includes(mark))
      if (!hasMatch)
        return false
    }
    if (filter.specificFreq.exclude && filter.specificFreq.exclude.length > 0) {
      const hasExcluded = freqMarksArray.some(mark => filter.specificFreq!.exclude!.includes(mark))
      if (hasExcluded)
        return false
    }
  }

  // 检查DX标记
  if (filter.dxMarks) {
    if (filter.dxMarks.include && filter.dxMarks.include.length > 0) {
      const hasMatch = dxMarksArray.some(mark => filter.dxMarks!.include!.includes(mark))
      if (!hasMatch)
        return false
    }
    if (filter.dxMarks.exclude && filter.dxMarks.exclude.length > 0) {
      const hasExcluded = dxMarksArray.some(mark => filter.dxMarks!.exclude!.includes(mark))
      if (hasExcluded)
        return false
    }
  }

  // 检查模式标记（特殊处理：如果modeMarks为空，说明模式不确定，不受过滤器影响）
  if (filter.modeMarks && modeMarksArray.length > 0) {
    if (filter.modeMarks.include && filter.modeMarks.include.length > 0) {
      const hasMatch = modeMarksArray.some(mark => filter.modeMarks!.include!.includes(mark))
      if (!hasMatch)
        return false
    }
    if (filter.modeMarks.exclude && filter.modeMarks.exclude.length > 0) {
      const hasExcluded = modeMarksArray.some(mark => filter.modeMarks!.exclude!.includes(mark))
      if (hasExcluded)
        return false
    }
  }

  // 检查 DXCC（只支持包含）
  if (filter.dxcc && 'dxcc' in spot && spot.dxcc) {
    const dxccPrimary = (spot.dxcc as any).primary
    if (filter.dxcc.include && filter.dxcc.include.length > 0) {
      if (!filter.dxcc.include.includes(dxccPrimary))
        return false
    }
  }

  // 检查呼号
  if (filter.callsign && spot.dx) {
    const pattern = getCallsignRegexPattern(filter.callsign)
    const regex = new RegExp(pattern, 'i')
    if (!regex.test(spot.dx))
      return false
  }

  return true
}

/**
 * 解析URL查询参数中的过滤器配置
 * @param filterParam - base64编码的JSON字符串
 * @returns 解析后的FilterConfig，如果解析失败返回空对象
 */
export function parseFilterParam(filterParam?: string): FilterConfig {
  if (!filterParam)
    return {}

  try {
    const decoded = Buffer.from(filterParam, 'base64').toString('utf8')
    const filter = JSON.parse(decoded) as FilterConfig
    return filter
  }
  catch (e) {
    console.warn('Failed to parse filter param:', e)
    return {}
  }
}

/**
 * 将FilterConfig编码为base64字符串
 * @param filter - 过滤器配置
 * @returns base64编码的JSON字符串
 */
export function encodeFilterParam(filter: FilterConfig): string {
  const json = JSON.stringify(filter)
  return Buffer.from(json, 'utf8').toString('base64')
}

/**
 * 根据过滤器配置构建MongoDB查询条件
 * 利用数据库中已保存的 marks 字段进行查询
 * @param filter - 过滤器配置
 * @returns MongoDB查询对象
 */
export function buildMongoQuery(filter: FilterConfig): any {
  const conditions: any[] = []

  // 处理频率标记 - 使用 marks.freqMarks 字段
  if (filter.freqMarks) {
    const freqConditions: any[] = []

    // Include逻辑：marks.freqMarks 数组至少包含一个指定标记
    if (filter.freqMarks.include && filter.freqMarks.include.length > 0) {
      freqConditions.push({
        'marks.freqMarks': { $in: filter.freqMarks.include },
      })
    }

    // Exclude逻辑：marks.freqMarks 数组不包含任何指定标记
    if (filter.freqMarks.exclude && filter.freqMarks.exclude.length > 0) {
      freqConditions.push({
        'marks.freqMarks': { $nin: filter.freqMarks.exclude },
      })
    }

    if (freqConditions.length > 0) {
      conditions.push({ $and: freqConditions })
    }
  }

  // 处理具体频率标记 - 使用 marks.freqMarks 字段（如 1.8MHz, 3.5MHz 等）
  if (filter.specificFreq) {
    const specificFreqConditions: any[] = []

    if (filter.specificFreq.include && filter.specificFreq.include.length > 0) {
      specificFreqConditions.push({
        'marks.freqMarks': { $in: filter.specificFreq.include },
      })
    }

    if (filter.specificFreq.exclude && filter.specificFreq.exclude.length > 0) {
      specificFreqConditions.push({
        'marks.freqMarks': { $nin: filter.specificFreq.exclude },
      })
    }

    if (specificFreqConditions.length > 0) {
      conditions.push({ $and: specificFreqConditions })
    }
  }

  // 处理DX标记 - 使用 marks.dxMarks 字段
  if (filter.dxMarks) {
    const dxConditions: any[] = []

    // Include逻辑
    if (filter.dxMarks.include && filter.dxMarks.include.length > 0) {
      dxConditions.push({
        'marks.dxMarks': { $in: filter.dxMarks.include },
      })
    }

    // Exclude逻辑
    if (filter.dxMarks.exclude && filter.dxMarks.exclude.length > 0) {
      dxConditions.push({
        'marks.dxMarks': { $nin: filter.dxMarks.exclude },
      })
    }

    if (dxConditions.length > 0) {
      conditions.push({ $and: dxConditions })
    }
  }

  // 处理模式标记 - 使用 marks.modeMarks 字段
  // 特殊处理：如果 modeMarks 为空数组（模式不确定），不受过滤器影响
  if (filter.modeMarks) {
    const modeConditions: any[] = []

    // Include逻辑：marks.modeMarks 数组至少包含一个指定标记，或为空数组
    if (filter.modeMarks.include && filter.modeMarks.include.length > 0) {
      modeConditions.push({
        $or: [
          { 'marks.modeMarks': { $in: filter.modeMarks.include } },
          { 'marks.modeMarks': { $size: 0 } }, // 模式不确定的记录不受影响
        ],
      })
    }

    // Exclude逻辑：marks.modeMarks 数组不包含任何指定标记，或为空数组
    if (filter.modeMarks.exclude && filter.modeMarks.exclude.length > 0) {
      modeConditions.push({
        $or: [
          { 'marks.modeMarks': { $nin: filter.modeMarks.exclude } },
          { 'marks.modeMarks': { $size: 0 } }, // 模式不确定的记录不受影响
        ],
      })
    }

    if (modeConditions.length > 0) {
      conditions.push({ $and: modeConditions })
    }
  }

  // 处理 DXCC 过滤器 - 使用 dxcc.primary 字段（只支持包含）
  if (filter.dxcc && filter.dxcc.include && filter.dxcc.include.length > 0) {
    conditions.push({
      'dxcc.primary': { $in: filter.dxcc.include },
    })
  }

  // 处理呼号过滤器
  if (filter.callsign) {
    const pattern = getCallsignRegexPattern(filter.callsign)
    conditions.push({
      dx: { $regex: pattern, $options: 'i' },
    })
  }

  // 组合所有条件
  if (conditions.length === 0) {
    return {}
  }
  else if (conditions.length === 1) {
    return conditions[0]
  }
  else {
    return { $and: conditions }
  }
}
