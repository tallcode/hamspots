import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'
import type { Spot } from './parseSpot.js'
import process from 'node:process'
import { array as badwordsList } from 'badwords-list'
import OpenAI from 'openai'
import 'dotenv/config'

const API_KEY = process.env.API_KEY

// 初始化 openai 客户端
const openai = API_KEY
  ? new OpenAI({
      apiKey: API_KEY, // 从环境变量读取
      baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      timeout: 5 * 1000,
    })
  : null

async function LLMDetect(comment: string, advanced = false): Promise<{ badword: boolean, reason: string } | null> {
  if (!openai) {
    return null
  }
  try {
    const messages: ChatCompletionMessageParam[] = [{
      role: 'user',
      content: [
        // '你是一个业余无线电爱好者，下面是你接收到的一个DX Spot信息，请分析这个信息',
        // '是否包含不合适公开的词汇(尤其是要符合中国地区的法律，符合中华民族的传统美德，照顾中国人民的情绪。注意不要过渡推测或者联想，仅从字面上的含义来判断。不确定的时候先放过)，包括',
        // ' - 违反法律',
        // ' - 敏感内容(暴力、色情、赌博、毒品、诈骗)',
        // ' - 非业余(讨论非业余无线电，注意仅**当明**确讨论某种**业务**无线电，特别是航空海事铁路频率时才算，其他泛指的无线电不算)',
        // ' - 粗口',
        // ' - 人身攻击',
        // ' - 政治(敏感事件/领土争议)',
        // ' - 不适合讨论(LGBTQ+/宗教/迷信/人权/战争)',
        // ' - 歧视(种族/性别)',
        // ' - 泄露隐私(个人信息/位置/联系方式)',
        // ' - 广告(推广其他产品/包含网址，尤其是短链接)',
        // ' - 其他(可能引起争议或不适合公开讨论的内容)',
        // '判断要给出理由, 理由为上面描述的几种情况中**非括号内**的部分。',
        // '请严格按照以下JSON格式返回结果：',
        // '{"badword": boolean, reason: string}',
        // '请确保返回的JSON格式正确且不包含多余的文本。',
        'You are an amateur radio enthusiast. Below is a DX Spot comment you received. Please analyze this message.',
        'Determine if it contains content inappropriate for public display (especially considering compliance with Chinese laws, traditional virtues, and public sentiment. Judge based on literal meaning without over-interpretation. If unsure, assume it is safe). Categories include:',
        ' - Violation of laws',
        ' - Sensitive content (violence, pornography, gambling, drugs, fraud)',
        ' - Non-amateur (Discussing non-amateur radio services. NOTE: Only count if explicitly discussing SPECIFIC commercial services like aviation, marine, railway. General radio terms are fine.)',
        ' - Profanity',
        ' - Personal attacks',
        ' - Political (sensitive topics/events/disputes/territorial issues)',
        ' - Inappropriate topics (LGBTQ+/religion/superstition/human rights/war)',
        ' - Discrimination (race/gender)',
        ' - Privacy leaks (personal info/location/contact details)',
        ' - Spam/Ads (promoting products/websites, especially short links)',
        ' - Other (potentially controversial or unsuitable content)',
        'Provide a reason for your judgment. The reason must be one of the categories listed above (excluding the text in parentheses).',
        'Please return the result strictly in the following JSON format:',
        '{"badword": boolean, reason: string}',
        'Ensure the returned JSON is valid and contains no extra text.',
      ].join('\n'),
    }, {
      role: 'user',
      content: [
        // '以下下是接收到的Spot中的Comment信息:',
        'Here is the comment from the Spot:',
        comment,
      ].join('\n'),
    }]
    const response = await openai.chat.completions.create({
      model: advanced ? 'qwen-plus' : 'qwen-flash',
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
                description: '理由',
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
  /\b(73|88|thx|tnx|tu|de|dx|cq|cw|ssb|ft8|ft4|gm|ga|ge|gd|gl|gb|cul|hpe|sri|dr|fer|nw|pls|hi|om)\b/gi,
  // QSO 相关术语
  /\b(qso|qrp|qsl|qrz|qrx|qrt|qrv|qth|qsb|qsy|qrm|qrn|qrl|qro|qru)\b/gi,
  // 比赛和活动
  /\b(contest|award|wwff|cqww|wpx|arrl|lotw|wapc|vucc|iota|sota|pota|yota|dxcc|iaru|itu|wac|waz|wwa|rda|rdxc|jidx|fd|field\s?day|pacc|rdc|naqp|sprint)\b/gi,
  // 卫星和模式
  /\b(sat|satellite|jt65|jt9|psk31|sstv|usb|lsb|fm|rtty|am|varac|vara|js8|wspr|msk144|q65|hell|olivia|thor|throb|domino|mt63)\b/gi,
  // 技术用语
  /\b(pse|fb|vgd|ur|es|hw|cu|agn|buro|rrr|bk|wx|band|anto|call|calling|beacon|cqing|rpt|rcvd|cfmd|hr|abt|condx|nil|tks|wkg|wkd|cl|cls|corr|correct)\b/gi,
  // 操作相关
  /\b(up|dwn|down|split|simplex|qsx|pileup|lp|sp)\b/gi,
  // 设备相关
  /\b(pwr|ant|antenna|rig|beam|yagi|dipole|vertical|gp|efhw|tx|rx|kw|amp|linear|ele|el|\dele)\b/gi,
  // 频段
  /\b(hf|vhf|uhf|warc|shf|ehf|10m|12m|15m|17m|20m|30m|40m|60m|80m|160m|6m|2m|70cm|23cm)\b/gi,
  // 呼号相关
  /\b(sk|xyl|yl|op|ops|stn)\b/gi,
  // 大洲缩写
  /\b(af|as|eu|na|oc|sa|an)\b/gi,
  // 单位和信号报告
  /\b\d+\s?(hz|khz|mhz|ghz)\b/gi,
  /\b\d+\s?db\b/gi,
  /\b\d+\s?km\b/gi,
  /\b\d+\s?w\b/gi,
  /\b[A-R]{2}\d{2}(?:[A-R]{2})?\b/gi, // Maidenhead locator 格式，如 FN42
  /\b5\d{1,2}\b/g, // 信号报告 599, 59, 579 等
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
  if (comment.length > 100) {
    console.log(`Comment flagged as inappropriate due to length > 100: "${comment}"`)
    return { hiddenComment: true }
  }
  // 先用本地敏感词库过滤一遍
  if (isProfane(comment)) {
    console.log(`Comment flagged as inappropriate by badwords-list: "${comment}"`)
    return { hiddenComment: true }
  }
  // 没有LLM就全部放行了
  if (!openai) {
    return { hiddenComment: false }
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
  const { badword: fastCheck } = (await LLMDetect(comment, false).catch(() => null)) || { badword: false }
  if (!fastCheck) {
    return { hiddenComment: false }
  }
  // 如果快速检查有问题，再用更强大的模型复核一次
  const { badword, reason } = (await LLMDetect(comment, true).catch(() => null)) || { badword: false, reason: '' }
  if (badword) {
    console.log(`Comment flagged as inappropriate by LLM: "${comment}"(${reason})`)
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
