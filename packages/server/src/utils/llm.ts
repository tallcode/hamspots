import OpenAI from 'openai'

// 初始化 openai 客户端
const openai = new OpenAI({
  apiKey: '', // 从环境变量读取
  baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
})
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'

// ...

async function detect(content: string) {
  try {
    const messages: ChatCompletionMessageParam[] =  [{
        role: 'user',
        content: [
            '你是一个业余无线电爱好者，下面是你接收到的一个DX Spot信息，请分析这个信息',
            '1. 是否包含不合适的词汇(讨论非业余/航空海事铁路频率/粗口/抱怨/政治/人身攻击/争议内容/LGBT)',
            '2. 判断通信模式是PH、DIGI还是CW。 通过Comment和频率相结合进行判断, 如果不能判断返回null。 ',
            '3. 判断要给出理由, 理由简短中文。',
            '请严格按照以下JSON格式返回结果：',
            '{"badword": boolean, "mode": "PH" | "DIGI" | "CW" | null, "reason": string}',
            '请确保返回的JSON格式正确且不包含多余的文本。',
            '',
            content,
        ].join('\n'),
    }];
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
              mode: {
                type: 'string',
                enum: ['PH', 'DIGI', 'CW', null],
                description: '通信模式',
              },
              reason: {
                type: 'string',
                description: '模式判断的理由',
              },
            },
            required: ['badword', 'mode', 'reason'],
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
    console.log('结果:', result)
    return result
  }
  catch (error) {
    console.error('Error:', error)
    return null
  }
}

detect(JSON.stringify({
  de: 'EA3HPX',
  freq: '7022.0',
  dx: 'FY4JIFY',
  comment: 'up 2.4',
  time: '0708Z',
}))
