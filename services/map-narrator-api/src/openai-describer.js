const DESCRIPTION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'description', 'highlightedLayers', 'observedPatterns', 'limitations'],
  properties: {
    title: { type: 'string', maxLength: 160 },
    description: { type: 'string', maxLength: 1600 },
    highlightedLayers: { type: 'array', maxItems: 12, items: { type: 'string', maxLength: 160 } },
    observedPatterns: { type: 'array', maxItems: 8, items: { type: 'string', maxLength: 300 } },
    limitations: { type: 'array', maxItems: 8, items: { type: 'string', maxLength: 300 } }
  }
}

const VISUAL_DESCRIPTION_SCHEMA = {
  ...DESCRIPTION_SCHEMA,
  required: [...DESCRIPTION_SCHEMA.required, 'spatialLayout', 'visualElements', 'visibleLabels', 'legendAndSymbols'],
  properties: {
    ...DESCRIPTION_SCHEMA.properties,
    spatialLayout: { type: 'array', maxItems: 8, items: { type: 'string', maxLength: 500 } },
    visualElements: { type: 'array', maxItems: 12, items: { type: 'string', maxLength: 500 } },
    visibleLabels: { type: 'array', maxItems: 20, items: { type: 'string', maxLength: 200 } },
    legendAndSymbols: { type: 'array', maxItems: 12, items: { type: 'string', maxLength: 500 } }
  }
}

const { buildVisualPrompt } = require('./prompt')

function buildResponseInput (request) {
  const visualInstructions = request.visual
    ? buildVisualPrompt(request.customPrompt)
    : 'Describe this GIS map only from the supplied metadata. Separate observed facts from cautious inferences; never invent entities, values, causes, or spatial relationships. Always state relevant limitations.'
  const text = `${visualInstructions} Write in ${request.locale}. Style: ${request.style}.\n\n${JSON.stringify(request.context)}`
  return request.visual
    ? [{ role: 'user', content: [{ type: 'input_text', text }, { type: 'input_image', image_url: request.visual.dataUrl, detail: 'high' }] }]
    : text
}

function assertDescription(value) {
  if (!value || typeof value !== 'object' || typeof value.title !== 'string' || typeof value.description !== 'string') {
    throw new Error('invalid structured response')
  }
  for (const key of ['highlightedLayers', 'observedPatterns', 'limitations']) {
    if (!Array.isArray(value[key]) || value[key].some((item) => typeof item !== 'string')) {
      throw new Error('invalid structured response')
    }
  }
  return value
}

function responseText (payload) {
  if (typeof payload?.output_text === 'string') return payload.output_text
  const content = payload?.output
    ?.filter((item) => item?.type === 'message')
    .flatMap((item) => Array.isArray(item.content) ? item.content : [])
    .find((item) => item?.type === 'output_text' && typeof item.text === 'string')
  if (typeof content?.text === 'string') return content.text
  throw new Error('OpenAI response does not contain output text')
}

function createOpenAIDescriber({ apiKey, model = 'gpt-5-mini', fetchImpl = globalThis.fetch }) {
  if (!apiKey) throw new Error('OPENAI_API_KEY is required')
  if (typeof fetchImpl !== 'function') throw new TypeError('fetch implementation is required')

  return async function describeMap(request) {
    const response = await fetchImpl('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        reasoning: { effort: 'minimal' },
        max_output_tokens: request.visual ? 2400 : 600,
        input: buildResponseInput(request),
        text: {
          format: { type: 'json_schema', name: request.visual ? 'visual_map_description' : 'map_description', strict: true, schema: request.visual ? VISUAL_DESCRIPTION_SCHEMA : DESCRIPTION_SCHEMA }
        }
      })
    })

    if (!response.ok) {
      const error = new Error('OpenAI Responses API request failed')
      error.status = response.status
      error.code = `OPENAI_${response.status}`
      const upstreamRequestId = response.headers.get('x-request-id')
      if (upstreamRequestId) error.upstreamRequestId = upstreamRequestId
      throw error
    }

    const payload = await response.json()
    if (payload.status === 'incomplete') {
      const reason = typeof payload.incomplete_details?.reason === 'string'
        ? payload.incomplete_details.reason.toUpperCase().replace(/[^A-Z0-9]+/g, '_')
        : 'UNKNOWN'
      const error = new Error('OpenAI response was incomplete')
      error.code = `OPENAI_INCOMPLETE_${reason}`
      throw error
    }
    try {
      return assertDescription(JSON.parse(responseText(payload)))
    } catch (cause) {
      if (cause?.code?.startsWith?.('OPENAI_INCOMPLETE_')) throw cause
      const error = new Error('OpenAI returned invalid structured content')
      error.code = 'OPENAI_INVALID_STRUCTURED_OUTPUT'
      throw error
    }
  }
}

module.exports = { DESCRIPTION_SCHEMA, createOpenAIDescriber }
