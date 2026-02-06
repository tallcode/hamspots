import OpenAI from 'openai'

// 初始化 openai 客户端
const openai = new OpenAI({
  apiKey: '', // 从环境变量读取
  baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
})
async function detect(content) {
  try {
    const messages = [{
      role: 'user',
      content: [
        '你是一个业余无线电爱好者，下面是你接收到的一个DX Spot信息，请分析这个信息',
        '1. 是否包含不合适的词汇(讨论非业余/粗口/抱怨/政治)',
        '2. 判断通信模式是PH、DIGI还是CW。 优先通过Comment中的关键词判断，如果Comment中没有明显的模式关键词，则通过频率判断',
        '请严格按照以下JSON格式返回结果：',
        '{"badword": boolean, "mode": "PH" | "DIGI" | "CW"}',
        '请确保返回的JSON格式正确且不包含多余的文本。',
        '',
        content,
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
              mode: {
                type: 'string',
                enum: ['PH', 'DIGI', 'CW'],
                description: '通信模式',
              },
            },
            required: ['badword', 'mode'],
            additionalProperties: false,
          },
        },
      },
    })

    const result = JSON.parse(response.choices[0].message.content)
    console.log('结果:', result)
    return result
  }
  catch (error) {
    console.error('Error:', error)
  }
}

detect(JSON.stringify({
  de: 'EA3HPX',
  freq: '7022.0',
  dx: 'FY4JIFY',
  comment: 'TOO MANY PEOPLE WITHOUT BRAIN',
  time: '0708Z',
}))
