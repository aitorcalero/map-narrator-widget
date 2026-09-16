const test = require('node:test')
const assert = require('node:assert/strict')

const { createOpenAIDescriber } = require('../src/openai-describer')

const request = {
  context: {
    title: 'Movilidad urbana',
    extent: { xmin: 1, ymin: 2, xmax: 3, ymax: 4 },
    layers: [{ title: 'Carriles bici', type: 'feature', visible: true, opacity: 1 }]
  },
  locale: 'es',
  style: 'technical',
  promptVersion: 'v1'
}

test('sends bounded structured-output request to the Responses API', async () => {
  let sent
  const describeMap = createOpenAIDescriber({
    apiKey: 'test-key',
    fetchImpl: async (_url, options) => {
      sent = JSON.parse(options.body)
      return new Response(JSON.stringify({
        output: [{
          type: 'message',
          content: [{
            type: 'output_text',
            text: JSON.stringify({
              title: 'Movilidad urbana',
              description: 'Una capa de carriles bici está visible.',
              highlightedLayers: ['Carriles bici'],
              observedPatterns: [],
              limitations: ['No se analizaron entidades individuales.']
            })
          }]
        }]
      }), { status: 200 })
    }
  })

  const result = await describeMap(request)

  assert.equal(sent.model, 'gpt-5-mini')
  assert.equal(sent.reasoning.effort, 'minimal')
  assert.equal(sent.max_output_tokens, 600)
  assert.equal(sent.text.format.type, 'json_schema')
  assert.equal(sent.input.includes('private'), false)
  assert.equal(result.title, 'Movilidad urbana')
})

test('exposes an upstream HTTP status without exposing OpenAI response details', async () => {
  const describeMap = createOpenAIDescriber({
    apiKey: 'test-key',
    fetchImpl: async () => new Response(JSON.stringify({ error: { code: 'unsupported_parameter' } }), { status: 400 })
  })

  await assert.rejects(() => describeMap(request), (error) => error.code === 'OPENAI_400' && error.status === 400 && error.message === 'OpenAI Responses API request failed')
})

test('identifies incomplete OpenAI output without exposing response data', async () => {
  const describeMap = createOpenAIDescriber({
    apiKey: 'test-key',
    fetchImpl: async () => new Response(JSON.stringify({ status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' }, output: [] }), { status: 200 })
  })

  await assert.rejects(() => describeMap(request), (error) => error.code === 'OPENAI_INCOMPLETE_MAX_OUTPUT_TOKENS')
})

test('fails safely when OpenAI returns invalid structured content', async () => {
  const describeMap = createOpenAIDescriber({
    apiKey: 'test-key',
    fetchImpl: async () => new Response(JSON.stringify({ output_text: 'not json' }), { status: 200 })
  })

  await assert.rejects(() => describeMap(request), { code: 'OPENAI_INVALID_STRUCTURED_OUTPUT' })
})

test('requires an API key without exposing it in errors', () => {
  assert.throws(() => createOpenAIDescriber({ apiKey: '' }), /OPENAI_API_KEY/)
})
