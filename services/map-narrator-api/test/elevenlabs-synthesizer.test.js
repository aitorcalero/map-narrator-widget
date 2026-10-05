const test = require('node:test')
const assert = require('node:assert/strict')

const { createElevenLabsSynthesizer } = require('../src/elevenlabs-synthesizer')

test('sends bounded text to ElevenLabs and returns audio', async () => {
  let request
  const synthesize = createElevenLabsSynthesizer({
    apiKey: 'eleven-test-key',
    voiceId: 'voice-123',
    fetchImpl: async (url, options) => {
      request = { url, options }
      return new Response(Buffer.from('audio'), { status: 200, headers: { 'content-type': 'audio/mpeg' } })
    }
  })

  const result = await synthesize('Descripción del mapa')

  assert.equal(request.url, 'https://api.elevenlabs.io/v1/text-to-speech/voice-123')
  assert.equal(request.options.headers['xi-api-key'], 'eleven-test-key')
  assert.deepEqual(JSON.parse(request.options.body), { text: 'Descripción del mapa', model_id: 'eleven_multilingual_v2' })
  assert.equal(result.contentType, 'audio/mpeg')
  assert.deepEqual(result.audio, Buffer.from('audio'))
})

test('retries retryable upstream failures and eventually returns audio', async () => {
  let attempts = 0
  const delays = []
  const synthesize = createElevenLabsSynthesizer({
    apiKey: 'eleven-test-key',
    voiceId: 'voice-123',
    maxRetries: 2,
    retryDelayMs: 5,
    sleep: async (ms) => { delays.push(ms) },
    fetchImpl: async () => {
      attempts += 1
      if (attempts < 2) return new Response('', { status: 503 })
      return new Response(Buffer.from('audio-ok'), { status: 200, headers: { 'content-type': 'audio/mpeg' } })
    }
  })

  const result = await synthesize('Texto')

  assert.equal(attempts, 2)
  assert.deepEqual(delays, [5])
  assert.deepEqual(result.audio, Buffer.from('audio-ok'))
})

test('maps quota exceeded as a non-retryable error', async () => {
  let attempts = 0
  const synthesize = createElevenLabsSynthesizer({
    apiKey: 'eleven-test-key',
    voiceId: 'voice-123',
    maxRetries: 3,
    fetchImpl: async () => {
      attempts += 1
      return new Response(JSON.stringify({ detail: { status: 'quota_exceeded' } }), {
        status: 401,
        headers: { 'content-type': 'application/json' }
      })
    }
  })

  await assert.rejects(() => synthesize('Texto'), { code: 'ELEVENLABS_QUOTA_EXCEEDED', status: 402 })
  assert.equal(attempts, 1)
})

test('retries timeout failures before giving up', async () => {
  let attempts = 0
  const delays = []
  const synthesize = createElevenLabsSynthesizer({
    apiKey: 'eleven-test-key',
    voiceId: 'voice-123',
    maxRetries: 1,
    retryDelayMs: 7,
    sleep: async (ms) => { delays.push(ms) },
    fetchImpl: async () => {
      attempts += 1
      throw Object.assign(new Error('aborted'), { name: 'AbortError' })
    }
  })

  await assert.rejects(() => synthesize('Texto'), { code: 'ELEVENLABS_TIMEOUT', status: 504 })
  assert.equal(attempts, 2)
  assert.deepEqual(delays, [7])
})

test('rejects invalid text before calling ElevenLabs', async () => {
  let called = false
  const synthesize = createElevenLabsSynthesizer({
    apiKey: 'eleven-test-key',
    voiceId: 'voice-123',
    fetchImpl: async () => {
      called = true
      return new Response(null, { status: 200 })
    }
  })

  await assert.rejects(() => synthesize(''), { code: 'INVALID_SPEECH_REQUEST', status: 400 })
  assert.equal(called, false)
})
