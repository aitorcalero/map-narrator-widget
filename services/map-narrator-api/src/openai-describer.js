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
        max_output_tokens: 260,
        input: `Describe this GIS map only from the supplied metadata. Write in ${request.locale}. Style: ${request.style}. Separate observed facts from cautious inferences; never invent entities, values, causes, or spatial relationships. Always state relevant limitations.\n\n${JSON.stringify(request.context)}`,
        text: {
          format: { type: 'json_schema', name: 'map_description', strict: true, schema: DESCRIPTION_SCHEMA }
        }
      })
    })

    if (!response.ok) {
      const error = new Error('OpenAI Responses API request failed')
      error.code = 'UPSTREAM_ERROR'
      throw error
    }

    try {
      const payload = await response.json()
      return assertDescription(JSON.parse(responseText(payload)))
    } catch {
      const error = new Error('OpenAI returned invalid structured content')
      error.code = 'UPSTREAM_ERROR'
      throw error
    }
  }
}

module.exports = { DESCRIPTION_SCHEMA, createOpenAIDescriber }
