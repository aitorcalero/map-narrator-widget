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
