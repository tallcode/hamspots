// 频率范围配置 [最小频率kHz, 最大频率kHz, ...标记]
const FREQ_RANGES = [
  // LF (Low Frequency)
  [135.7, 137.8, 'LF', '137kHz'],
  [472, 479, 'LF', '472kHz'],
  // HF (High Frequency)
  [1800, 2000, 'HF', '1.8MHz'],
  [3500, 4000, 'HF', '3.5MHz'],
  [5000, 5500, 'HF', 'WARC', '5MHz'],
  [7000, 7300, 'HF', '7MHz'],
  [10100, 10150, 'HF', 'WARC', '10MHz'],
  [14000, 14350, 'HF', '14MHz'],
  [18068, 18168, 'HF', 'WARC', '18MHz'],
  [21000, 21450, 'HF', '21MHz'],
  [24890, 24990, 'HF', 'WARC', '24MHz'],
  [28000, 29700, 'HF', '28MHz'],
  // VHF (Very High Frequency)
  [50000, 54000, 'VHF', '50MHz'],
  [70000, 71000, 'VHF', '70MHz'],
  [144000, 148000, 'VHF', '144MHz'],
  // UHF (Ultra High Frequency)
  [220000, 225000, 'UHF', '220MHz'],
  [430000, 440000, 'UHF', '430MHz'],
  [1200000, 1300000, 'UHF', '1.2GHz'],
  // SHF (Super High Frequency)
  [2300000, 2450000, 'SHF', '2.3GHz'],
  [3400000, 3500000, 'SHF', '3.4GHz'],
  [5650000, 5925000, 'SHF', '5.6GHz'],
  [10000000, 10500000, 'SHF', '10GHz'],
  [24000000, 24250000, 'SHF', '24GHz'],
  [47000000, 47200000, 'SHF', '47GHz'],
]

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

const DIGI_FREQS = [
  // FT8 常用频率
  1840,
  3573,
  7074,
  10136,
  14074,
  18110,
  21074,
  24915,
  28074,
  50313,
  50323,
  144174,
  // FT4 常用频率
  3568,
  3575,
  7047,
  10140,
  14080,
  18104,
  21140,
  24919,
  28180,
  50318,
  144170,
]

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
  if (DIGI_FREQS.some(f => (freq >= f) && (freq - f) <= 3)) {
    return ['DIGI']
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
