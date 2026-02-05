function freqMark(freq) {
  // 频率标记
  const marks = []

  // 转换为 kHz
  const freqKHz = Number.parseFloat(freq)

  // LF (Low Frequency)
  if (freqKHz >= 135.7 && freqKHz <= 137.8) {
    marks.push('LF', '137kHz')
  }
  else if (freqKHz >= 472 && freqKHz <= 479) {
    marks.push('LF', '472kHz')
  }

  // HF (High Frequency)
  else if (freqKHz >= 1800 && freqKHz < 2000) {
    marks.push('HF', '1.8MHz')
  }
  else if (freqKHz >= 3500 && freqKHz < 4000) {
    marks.push('HF', '3.5MHz')
  }
  else if (freqKHz >= 5000 && freqKHz < 5500) {
    marks.push('HF', 'WARC', '5MHz')
  }
  else if (freqKHz >= 7000 && freqKHz < 7300) {
    marks.push('HF', '7MHz')
  }
  else if (freqKHz >= 10100 && freqKHz < 10150) {
    marks.push('HF', 'WARC', '10MHz')
  }
  else if (freqKHz >= 14000 && freqKHz < 14350) {
    marks.push('HF', '14MHz')
  }
  else if (freqKHz >= 18068 && freqKHz < 18168) {
    marks.push('HF', 'WARC', '18MHz')
  }
  else if (freqKHz >= 21000 && freqKHz < 21450) {
    marks.push('HF', '21MHz')
  }
  else if (freqKHz >= 24890 && freqKHz < 24990) {
    marks.push('HF', 'WARC', '24MHz')
  }
  else if (freqKHz >= 28000 && freqKHz < 29700) {
    marks.push('HF', '28MHz')
  }

  // VHF (Very High Frequency)
  else if (freqKHz >= 50000 && freqKHz < 54000) {
    marks.push('VHF', '50MHz')
  }
  else if (freqKHz >= 70000 && freqKHz < 71000) {
    marks.push('VHF', '70MHz')
  }
  else if (freqKHz >= 144000 && freqKHz < 148000) {
    marks.push('VHF', '144MHz')
  }

  // UHF (Ultra High Frequency)
  else if (freqKHz >= 220000 && freqKHz < 225000) {
    marks.push('UHF', '220MHz')
  }
  else if (freqKHz >= 430000 && freqKHz < 440000) {
    marks.push('UHF', '430MHz')
  }
  else if (freqKHz >= 1200000 && freqKHz < 1300000) {
    marks.push('UHF', '1.2GHz')
  }

  // SHF (Super High Frequency)
  else if (freqKHz >= 2300000 && freqKHz < 2450000) {
    marks.push('SHF', '2.3GHz')
  }
  else if (freqKHz >= 3400000 && freqKHz < 3500000) {
    marks.push('SHF', '3.4GHz')
  }
  else if (freqKHz >= 5650000 && freqKHz < 5925000) {
    marks.push('SHF', '5.6GHz')
  }
  else if (freqKHz >= 10000000 && freqKHz < 10500000) {
    marks.push('SHF', '10GHz')
  }
  else if (freqKHz >= 24000000 && freqKHz < 24250000) {
    marks.push('SHF', '24GHz')
  }
  else if (freqKHz >= 47000000 && freqKHz < 47200000) {
    marks.push('SHF', '47GHz')
  }

  return marks
}

function dxMark(dx) {
  // DX 后缀标记
  const marks = []

  if (!dx)
    return marks

  // QRP 低功率电台
  if (/\/QRPP?$/i.test(dx)) {
    marks.push('QRP')
  }

  // Mobile 移动电台
  if (/\/(?:M|MM|AM)$/i.test(dx)) {
    marks.push('Mobile')
  }

  // Portable 便携电台
  if (/\/P$/i.test(dx)) {
    marks.push('Portable')
  }

  // Beacon 信标电台
  if (/\/(?:B|BCN)$/i.test(dx) || /BEACON$/i.test(dx)) {
    marks.push('Beacon')
  }

  return marks
}

function modeMark(spot) {
  // 模式标记（根据 comment 字段）
  // DIGI PH CW 三类
  const marks = []
  if (!spot.comment)
    return marks

  const comment = spot.comment.toUpperCase()

  // 使用词边界匹配，确保是完整的单词
  if (/\bFT8\b/.test(comment) || /\bFT4\b/.test(comment) || /\bJT65\b/.test(comment) || /\bRTTY\b/.test(comment) || /\bPSK31\b/.test(comment)) {
    marks.push('DIGI')
  }
  if (/\bCW\b/.test(comment)) {
    marks.push('CW')
  }
  if (/\bPHONE\b/.test(comment) || /\bSSB\b/.test(comment) || /\bFM\b/.test(comment)) {
    marks.push('PH')
  }

  return marks
}

export function markSpot(spot) {
  return {
    freqMarks: freqMark(spot.freq),
    dxMarks: dxMark(spot.dx),
    modeMarks: modeMark(spot),
  }
}
