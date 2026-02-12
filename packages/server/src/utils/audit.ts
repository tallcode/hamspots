import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'
import type { Spot } from './parseSpot.js'
import { array as badwordsList } from 'badwords-list'
import OpenAI from 'openai'
import 'dotenv/config'

const API_KEY = process.env.API_KEY

// 初始化 openai 客户端
const openai = API_KEY ? new OpenAI({
  apiKey: process.env.API_KEY, // 从环境变量读取
  baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
}) : null

async function LLMDetect(comment: string) {
  if (!openai) {
    return null
  }
  try {
    const messages: ChatCompletionMessageParam[] = [{
      role: 'user',
      content: [
        '你是一个业余无线电爱好者，下面是你接收到的一个DX Spot信息，请分析这个信息',
        '是否包含不合适公开的词汇(尤其是要符合中国地区的法律,符合中华民族的传统美德,照顾中国人民的情绪)包括但不限于',
        ' - 违反国家法律法规的内容,尤其是中国法律',
        ' - 涉及暴力、色情、赌博等敏感内容',
        ' - 讨论非业余，特别是航空海事铁路频率',
        ' - 粗口/抱怨/人身攻击',
        ' - 政治敏感/争议内容/敏感事件/领土争议',
        ' - LGBTQ+/宗教/种族/性别歧视',
        ' - 道德败坏',
        ' - 泄露个人隐私信息',
        '判断要给出理由, 理由简短中文。',
        '请严格按照以下JSON格式返回结果：',
        '{"badword": boolean, reason: string}',
        '请确保返回的JSON格式正确且不包含多余的文本。',
      ].join('\n'),
    }, {
      role: 'user',
      content: [
        '以下下是接收到的Spot中的Comment信息:',
        comment,
      ].join('\n'),
    }]
    const response = await openai.chat.completions.create({
      model: 'qwen-flash',
      messages,
      stream: false,
      enable_thinking: false,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'ham_radio_analysis',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              badword: {
                type: 'boolean',
                description: '是否包含敏感词',
              },
              reason: {
                type: 'string',
                description: '理由，简短中文',
              },
            },
            required: ['badword', 'reason'],
            additionalProperties: false,
          },
        },
      },
    } as any)

    const contentStr = response.choices[0].message.content
    if (!contentStr) {
      console.error('Response content is null')
      return null
    }
    const result = JSON.parse(contentStr)
    return result
  }
  catch (error) {
    console.error('Error:', error)
    return null
  }
}

const goodWordsRegList = [
  // 常见问候和缩写
  /\b(73|88|thx|tnx|tu|de|dx|cq|cw|ssb|ft8|ft4)\b/gi,
  // QSO 相关术语
  /\b(qso|qrp|qsl|qrz|qrx|qrt|qrv|qth|om|usb|lsb|fm|rtty)\b/gi,
  // 比赛和活动
  /\b(contest|wwff|cqww|wpx|arrl|lotw|wapc|vucc|iota|sota|pota|dxcc|iaru|itu)\b/gi,
  // 卫星和模式
  /\b(sat|satellite|jt65|jt9|psk31|sstv)\b/gi,
  // 技术用语
  /\b(pse|fb|vgd|ur|es|hw|cuagn|bcnu|rrr|bk)\b/gi,
  // 设备相关
  /\b(pwr|ant|antenna|rig|beam|yagi|dipole|vertical|wx)\b/gi,
  // 频段
  /\b(hf|vhf|uhf|10m|15m|20m|40m|80m|160m)\b/gi,
  // 呼号相关
  /\b(sk|xyl|yl)\b/gi,
  // 单位和信号报告
  /\b\d+hz\b/gi,
  /\b\d+db\b/gi,
  /\b\d+km\b/gi,
  /\b[A-R]{2}\d{2}(?:[A-R]{2})?\b/gi, // Maidenhead locator 格式，如 FN42
  /\b(5\d{1,2}|59\d?)\b/g, // 信号报告 599, 59, 579 等
]

const badWordsRegExpList = badwordsList.map((word: string) => new RegExp(`\\b${word.replace(/(\W)/g, '\\$1')}\\b`, 'gi'))

function isProfane(string: string): boolean {
  return badWordsRegExpList.some((wordExp: RegExp) => wordExp.test(string))
}

export async function auditCommnet(spot: Spot) {
  const { comment } = spot
  if (!comment || comment.trim().length === 0) {
    return { hiddenComment: false }
  }
  if(comment.length > 100) {
    console.log(`Comment flagged as inappropriate due to length > 100: "${comment}"`)
    return { hiddenComment: true }
  }
  // 先用本地敏感词库过滤一遍
  if (isProfane(comment)) {
    console.log(`Comment flagged as inappropriate by badwords-list: "${comment}"`)
    return { hiddenComment: true }
  }
  let _comment = comment.replace(/[\r\n]+/g, ' ').trim()
  if (_comment.length < 5) {
    return { hiddenComment: false }
  }
  // 先简单过滤一些常见的好词，减少调用次数
  for (const goodPattern of goodWordsRegList) {
    _comment = _comment.replace(goodPattern, '').trim()
    if (_comment.length < 5) {
      return { hiddenComment: false }
    }
  }
  // 过滤掉数字和特殊符号后，如果长度过短，则认为是好评论
  const strippedComment = _comment.replace(/[^a-z]/gi, '')
  if (strippedComment.length < 10) {
    return { hiddenComment: false }
  }
  // 调用 LLM 进行审核
  if (!openai) {
    console.warn('OpenAI client not initialized, skipping LLM audit') 
    return { hiddenComment: false }
  }
  const { badword, reason } = (await LLMDetect(comment).catch(() => null)) || { badword: false }
  if (badword) {
    console.log(`Comment flagged as inappropriate by LLM: "${comment}". Reason: ${reason}`)
  }
  else {
    console.log(`Comment passed LLM audit: "${comment}"`)
  }
  return { hiddenComment: badword }
}

// console.log(await auditCommnet({
//   de: 'EA3HPX',
//   freq: '14270.0',
//   dx: 'FY4JIFY',
//   comment: '',
//   time: Date.now(),
//   createdAt: new Date(),
// }))
