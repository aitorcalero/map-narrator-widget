const ELEVENLABS_URL = 'https://api.elevenlabs.io/v1/text-to-speech'
const MAX_TEXT_LENGTH = 12_000

function createElevenLabsSynthesizer ({
  apiKey,
  voiceId,
  model = 'eleven_multilingual_v2',
  fetchImpl = fetch
} = {}) {
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY is required')
  if (!voiceId) throw new Error('ELEVENLABS_VOICE_ID is required')

  return async function synthesize (text) {
    if (typeof text !== 'string' || text.trim().length === 0 || text.length > MAX_TEXT_LENGTH) {
      throw Object.assign(new Error('text must be a non-empty string within the supported length'), { status: 400, code: 'INVALID_SPEECH_REQUEST' })
    }

    const response = await fetchImpl(`${ELEVENLABS_URL}/${encodeURIComponent(voiceId)}`, {
      method: 'POST',
      headers: {
        accept: 'audio/mpeg',
        'content-type': 'application/json',
        'xi-api-key': apiKey
      },
      body: JSON.stringify({ text, model_id: model })
    })

    if (!response.ok) {
      throw Object.assign(new Error('ElevenLabs speech request failed'), {
        status: 502,
        code: `ELEVENLABS_${response.status}`,
        upstreamRequestId: response.headers.get('request-id') ?? response.headers.get('x-request-id') ?? undefined
      })
    }

    return {
      audio: Buffer.from(await response.arrayBuffer()),
      contentType: response.headers.get('content-type') ?? 'audio/mpeg'
    }
  }
}

module.exports = { MAX_TEXT_LENGTH, createElevenLabsSynthesizer }
