const ELEVENLABS_URL = 'https://api.elevenlabs.io/v1/text-to-speech'
const MAX_TEXT_LENGTH = 12_000

const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504])

function defaultSleep (ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function readErrorPayload (response) {
  try {
    const body = await response.text()
    return body ? JSON.parse(body) : undefined
  } catch {
    return undefined
  }
}

function buildUpstreamError ({ status, response, payload }) {
  const upstreamRequestId = response.headers.get('request-id') ?? response.headers.get('x-request-id') ?? undefined
  const upstreamStatus = payload?.detail?.status

  if (upstreamStatus === 'quota_exceeded') {
    return Object.assign(new Error('ElevenLabs quota exceeded. Add credits and try again.'), {
      status: 402,
      code: 'ELEVENLABS_QUOTA_EXCEEDED',
      upstreamRequestId,
      retryable: false
    })
  }

  return Object.assign(new Error('ElevenLabs speech request failed'), {
    status: 502,
    code: `ELEVENLABS_${status}`,
    upstreamRequestId,
    retryable: RETRYABLE_STATUSES.has(status)
  })
}

function createElevenLabsSynthesizer ({
  apiKey,
  voiceId,
  model = 'eleven_multilingual_v2',
  fetchImpl = fetch,
  timeoutMs = 40_000,
  maxRetries = 2,
  retryDelayMs = 600,
  sleep = defaultSleep
} = {}) {
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY is required')
  if (!voiceId) throw new Error('ELEVENLABS_VOICE_ID is required')

  return async function synthesize (text) {
    if (typeof text !== 'string' || text.trim().length === 0 || text.length > MAX_TEXT_LENGTH) {
      throw Object.assign(new Error('text must be a non-empty string within the supported length'), { status: 400, code: 'INVALID_SPEECH_REQUEST' })
    }

    let lastError
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
      try {
        const response = await fetchImpl(`${ELEVENLABS_URL}/${encodeURIComponent(voiceId)}`, {
          method: 'POST',
          headers: {
            accept: 'audio/mpeg',
            'content-type': 'application/json',
            'xi-api-key': apiKey
          },
          body: JSON.stringify({ text, model_id: model }),
          signal: controller.signal
        })

        if (!response.ok) {
          const payload = await readErrorPayload(response)
          throw buildUpstreamError({ status: response.status, response, payload })
        }

        return {
          audio: Buffer.from(await response.arrayBuffer()),
          contentType: response.headers.get('content-type') ?? 'audio/mpeg'
        }
      } catch (error) {
        if (error?.name === 'AbortError') {
          lastError = Object.assign(new Error('Speech generation timed out. Please retry.'), {
            status: 504,
            code: 'ELEVENLABS_TIMEOUT',
            retryable: true
          })
        } else if (error && typeof error === 'object' && 'code' in error) {
          lastError = error
        } else {
          lastError = Object.assign(new Error('Speech service request failed'), {
            status: 502,
            code: 'ELEVENLABS_NETWORK_ERROR',
            retryable: true
          })
        }
      } finally {
        clearTimeout(timeoutId)
      }

      if (!lastError?.retryable || attempt === maxRetries) {
        throw lastError
      }
      await sleep(retryDelayMs * (attempt + 1))
    }

    throw lastError
  }
}

module.exports = { MAX_TEXT_LENGTH, createElevenLabsSynthesizer }
