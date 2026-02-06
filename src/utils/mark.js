import { BAND_PLAN } from './bandplan.js'
import { FREQ_RANGES } from './freq.js'

function freqMark(freq) {
  // 频率标记
  const freqKHz = Number.parseFloat(freq)

  // 查找匹配的频率范围
  for (const range of FREQ_RANGES) {
    const [min, max, ...marks] = range
    if (freqKHz >= min && freqKHz < max) {
      return marks
    }
  }

  return []
}

// DX 后缀匹配的正则表达式
const QRP_REGEX = /\/QRPP?$/i
const MOBILE_REGEX = /\/(?:M|MM|AM)$/i
const PORTABLE_REGEX = /\/P$/i
const BEACON_REGEX = /\/B(?:CN)?$|BEACON$/i
function dxMark(dx) {
  // DX 后缀标记
  const marks = []

  if (!dx)
    return marks

  // QRP 低功率电台
  if (QRP_REGEX.test(dx)) {
    marks.push('QRP')
  }

  // Mobile 移动电台
  if (MOBILE_REGEX.test(dx)) {
    marks.push('Mobile')
  }

  // Portable 便携电台
  if (PORTABLE_REGEX.test(dx)) {
    marks.push('Portable')
  }

  // Beacon 信标电台
  if (BEACON_REGEX.test(dx)) {
    marks.push('Beacon')
  }

  return marks
}

const DIGI_REGEX = /\b(?:FT8|FT4|JT65|RTTY|PSK31)\b/i
const CW_REGEX = /\bCW\b/i
const PH_REGEX = /\b(?:PHONE|SSB|USB|LSB|FM)\b/i

function modeMark(spot) {
  // 模式标记（根据 comment 字段）
  // DIGI PH CW 三类
  const comment = spot.comment.toUpperCase() || ''

  // 使用词边界匹配，确保是完整的单词
  if (DIGI_REGEX.test(comment)) {
    return ['DIGI']
  }
  if (CW_REGEX.test(comment)) {
    return ['CW']
  }
  if (PH_REGEX.test(comment)) {
    return ['PH']
  }

  const freq = Number.parseFloat(spot.freq)
  const plan = BAND_PLAN.find(([min, max]) => freq >= min && freq < max)
  if (plan && plan.length > 2) {
    const modes = plan.slice(2)
    if (modes.length === 1) {
      return modes
    }
  }
  return []
}

export function markSpot(spot) {
  return {
    freqMarks: freqMark(spot.freq),
    dxMarks: dxMark(spot.dx),
    modeMarks: modeMark(spot),
  }
}
