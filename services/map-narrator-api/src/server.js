const crypto = require('node:crypto')
const http = require('node:http')
const { normalizeMapContext } = require('./map-context')
const { normalizeVisualRequest } = require('./visual-request')

const MAX_BODY_BYTES = 3 * 1024 * 1024
const CACHE_TTL_MS = 5 * 60 * 1000

function sendJson(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  response.end(JSON.stringify(body))
}

function sendAudio(response, status, audio, contentType) {
  response.writeHead(status, { 'content-type': contentType, 'cache-control': 'no-store' })
  response.end(audio)
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let size = 0
    let content = ''
    request.setEncoding('utf8')
    request.on('data', (chunk) => {
      size += Buffer.byteLength(chunk)
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('request body is too large'), { status: 413, code: 'PAYLOAD_TOO_LARGE' }))
        request.destroy()
        return
      }
      content += chunk
    })
    request.on('end', () => {
      try {
        resolve(JSON.parse(content))
      } catch {
        reject(Object.assign(new Error('request body must be valid JSON'), { status: 400, code: 'INVALID_REQUEST' }))
      }
    })
    request.on('error', reject)
  })
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]))
  }
  return value
}

function cacheKey(request) {
  return crypto.createHash('sha256').update(JSON.stringify(canonicalize(request))).digest('hex')
}

function createServer ({
  describeMap,
  synthesizeSpeech,
  now = () => Date.now(),
  cache = new Map(),
  maxRequestsPerWindow = 20,
  rateWindowMs = 60 * 1000,
  rateCounters = new Map(),
  allowedOrigin,
  forensics = () => {}
}) {
  if (typeof describeMap !== 'function') throw new TypeError('describeMap must be a function')

  return http.createServer(async (request, response) => {
    const requestId = crypto.randomUUID()
    const startedAt = now()
    response.setHeader('x-request-id', requestId)
    const finish = (status, body, { stage, code, cached, visual, upstreamRequestId } = {}) => {
      const diagnostic = { requestId, stage, ...(code ? { code } : {}), ...(upstreamRequestId ? { upstreamRequestId } : {}) }
      forensics({ timestamp: new Date(startedAt).toISOString(), requestId, stage, status, ...(code ? { code } : {}), ...(upstreamRequestId ? { upstreamRequestId } : {}), ...(typeof cached === 'boolean' ? { cached } : {}), ...(typeof visual === 'boolean' ? { visual } : {}), durationMs: Math.max(0, now() - startedAt) })
      return sendJson(response, status, { ...body, diagnostic })
    }
    const origin = request.headers.origin
    const isApiRoute = request.url === '/api/map-description' || request.url === '/api/speech'
    if (allowedOrigin && isApiRoute && origin !== allowedOrigin) {
      return finish(403, { error: { code: 'ORIGIN_FORBIDDEN', message: 'Request origin is not allowed' } }, { stage: 'authorization', code: 'ORIGIN_FORBIDDEN' })
    }
    if (allowedOrigin && origin === allowedOrigin) {
      response.setHeader('access-control-allow-origin', allowedOrigin)
      response.setHeader('vary', 'Origin')
      response.setHeader('access-control-allow-methods', 'POST, OPTIONS')
      response.setHeader('access-control-allow-headers', 'content-type')
    }
    if (request.method === 'OPTIONS' && isApiRoute) {
      response.writeHead(origin === allowedOrigin ? 204 : 403)
      return response.end()
    }
    if (request.method === 'GET' && request.url === '/healthz') {
      return sendJson(response, 200, { status: 'ok' })
    }
    if (request.method === 'POST' && request.url === '/api/speech') {
      if (typeof synthesizeSpeech !== 'function') {
        return finish(503, { error: { code: 'ELEVENLABS_NOT_CONFIGURED', message: 'Speech service is not configured' } }, { stage: 'authorization', code: 'ELEVENLABS_NOT_CONFIGURED' })
      }
      try {
        const input = await readJson(request)
        const text = typeof input.text === 'string' ? input.text : ''
        const result = await synthesizeSpeech(text)
        return sendAudio(response, 200, result.audio, result.contentType)
      } catch (error) {
        const status = error.status ?? 502
        const code = error.code ?? 'UPSTREAM_ERROR'
        return finish(status, { error: { code, message: status === 502 ? 'Speech service unavailable' : error.message } }, { stage: status === 400 ? 'validation' : 'upstream', code, upstreamRequestId: error.upstreamRequestId })
      }
    }
    if (request.method !== 'POST' || request.url !== '/api/map-description') {
      return sendJson(response, 404, { error: { code: 'NOT_FOUND', message: 'Route not found' } })
    }

    const caller = request.socket.remoteAddress ?? 'unknown'
    const currentTime = now()
    const counter = rateCounters.get(caller)
    const activeCounter = !counter || counter.windowStartedAt + rateWindowMs <= currentTime
      ? { windowStartedAt: currentTime, count: 0 }
      : counter
    activeCounter.count += 1
    rateCounters.set(caller, activeCounter)
    if (activeCounter.count > maxRequestsPerWindow) {
      return finish(429, { error: { code: 'RATE_LIMITED', message: 'Too many narration requests' } }, { stage: 'rate-limit', code: 'RATE_LIMITED' })
    }

    try {
      const input = await readJson(request)
      let context
      try {
        context = normalizeMapContext(input.context)
      } catch (error) {
        error.status = 400
        error.code = 'INVALID_REQUEST'
        throw error
      }
      const locale = typeof input.locale === 'string' && input.locale ? input.locale.slice(0, 16) : 'es'
      const style = typeof input.style === 'string' && input.style ? input.style.slice(0, 32) : 'technical'
      let visual
      if (input.visual?.enabled) {
        try {
          visual = normalizeVisualRequest(input.visual)
        } catch (error) {
          error.status = 400
          error.code = 'INVALID_REQUEST'
          throw error
        }
      }
      const normalizedRequest = { context, locale, style, promptVersion: visual ? 'visual-v1' : 'v1', visual }
      if (!visual) {
        const key = cacheKey(normalizedRequest)
        const cached = cache.get(key)
        if (cached && cached.expiresAt > now()) {
          return finish(200, { description: cached.description, cached: true }, { stage: 'cache', cached: true, visual: false })
        }
        const description = await describeMap(normalizedRequest)
        cache.set(key, { description, expiresAt: now() + CACHE_TTL_MS })
        return finish(200, { description, cached: false }, { stage: 'completed', cached: false, visual: false })
      }

      const description = await describeMap(normalizedRequest)
      return finish(200, { description, cached: false }, { stage: 'completed', cached: false, visual: true })
    } catch (error) {
      const status = error.status ?? 502
      const code = error.code ?? 'UPSTREAM_ERROR'
      const stage = status === 400 ? 'validation' : 'upstream'
      return finish(status, { error: { code, message: status === 502 ? 'Description service unavailable' : error.message } }, { stage, code, upstreamRequestId: error.upstreamRequestId })
    }
  })
}

module.exports = { CACHE_TTL_MS, cacheKey, createServer }
