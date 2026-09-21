const test = require('node:test')
const assert = require('node:assert/strict')
const { once } = require('node:events')
const http = require('node:http')

const { createServer } = require('../src/server')

async function request(server, payload, extraHeaders = {}) {
  const address = server.address()
  return await new Promise((resolve, reject) => {
    const body = JSON.stringify(payload)
    const req = http.request({
      host: '127.0.0.1',
      port: address.port,
      path: '/api/map-description',
      method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body), ...extraHeaders }
    }, (response) => {
      let text = ''
      response.setEncoding('utf8')
      response.on('data', (chunk) => { text += chunk })
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body: JSON.parse(text) }))
    })
    req.on('error', reject)
    req.end(body)
  })
}

const validContext = {
  title: 'Movilidad urbana',
  extent: { xmin: 1, ymin: 2, xmax: 3, ymax: 4 },
  layers: [{ title: 'Carriles bici', type: 'feature', visible: true, opacity: 1 }]
}

test('returns a structured description for valid normalized map metadata', async (t) => {
  const server = createServer({
    describeMap: async () => ({
      title: 'Movilidad urbana',
      description: 'El mapa muestra una capa visible de carriles bici.',
      highlightedLayers: ['Carriles bici'],
      observedPatterns: [],
      limitations: ['No se analizaron entidades individuales.']
    })
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => server.close())

  const response = await request(server, { context: validContext, locale: 'es' })

  assert.equal(response.status, 200)
  assert.equal(response.body.cached, false)
  assert.equal(response.body.description.title, 'Movilidad urbana')
})

test('forwards validated visual input and never caches it', async (t) => {
  let calls = 0
  let seenVisual
  const server = createServer({
    describeMap: async (input) => {
      calls += 1
      seenVisual = input.visual
      return { title: 'Visual', description: 'Vista.', highlightedLayers: [], observedPatterns: [], limitations: [] }
    }
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => server.close())
  const visual = { enabled: true, imageDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIW2Nk+M/wHwAF/gL+MZ2AyAAAAABJRU5ErkJggg==', width: 1, height: 1 }

  const first = await request(server, { context: validContext, visual })
  const second = await request(server, { context: validContext, visual })

  assert.equal(first.body.cached, false)
  assert.equal(second.body.cached, false)
  assert.equal(calls, 2)
  assert.deepEqual(seenVisual, { enabled: true, dataUrl: visual.imageDataUrl, mimeType: 'image/png', width: 1, height: 1 })
})

test('reuses a successful description for an equivalent map context', async (t) => {
  let calls = 0
  const server = createServer({
    describeMap: async () => {
      calls += 1
      return { title: 'Movilidad urbana', description: 'Resumen.', highlightedLayers: [], observedPatterns: [], limitations: [] }
    }
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => server.close())

  const first = await request(server, { context: validContext, locale: 'es' })
  const second = await request(server, { locale: 'es', context: validContext })

  assert.equal(first.body.cached, false)
  assert.equal(second.body.cached, true)
  assert.equal(calls, 1)
})

test('allows only the configured Experience Builder origin', async (t) => {
  const server = createServer({
    allowedOrigin: 'https://127.0.0.1:3001',
    describeMap: async () => ({ title: 'Movilidad urbana', description: 'Resumen.', highlightedLayers: [], observedPatterns: [], limitations: [] })
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => server.close())

  const allowed = await request(server, { context: validContext }, { origin: 'https://127.0.0.1:3001' })
  const blocked = await request(server, { context: validContext, style: 'citizen' }, { origin: 'https://evil.example' })

  assert.equal(allowed.headers['access-control-allow-origin'], 'https://127.0.0.1:3001')
  assert.equal(blocked.status, 403)
  assert.equal(blocked.headers['access-control-allow-origin'], undefined)
})

test('rate-limits a caller before forwarding a second request', async (t) => {
  const server = createServer({
    maxRequestsPerWindow: 1,
    describeMap: async () => ({ title: 'Movilidad urbana', description: 'Resumen.', highlightedLayers: [], observedPatterns: [], limitations: [] })
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => server.close())

  const first = await request(server, { context: validContext })
  const second = await request(server, { context: validContext, style: 'citizen' })

  assert.equal(first.status, 200)
  assert.equal(second.status, 429)
  assert.equal(second.body.error.code, 'RATE_LIMITED')
})


test('emits a sanitized forensic event with request correlation for upstream failures', async (t) => {
  const events = []
  const upstreamError = Object.assign(new Error('OpenAI Responses API request failed'), { status: 502, code: 'OPENAI_401', upstreamRequestId: 'req_openai_401' })
  const server = createServer({
    forensics: (event) => events.push(event),
    describeMap: async () => { throw upstreamError }
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => server.close())

  const response = await request(server, { context: validContext })

  assert.equal(response.status, 502)
  assert.equal(response.body.error.code, 'OPENAI_401')
  assert.equal(response.body.diagnostic.stage, 'upstream')
  assert.equal(response.body.diagnostic.upstreamRequestId, 'req_openai_401')
  assert.match(response.body.diagnostic.requestId, /^[0-9a-f-]{36}$/)
  assert.deepEqual(events.length, 1)
  assert.equal(events[0].requestId, response.body.diagnostic.requestId)
  assert.equal(events[0].code, 'OPENAI_401')
  assert.doesNotMatch(JSON.stringify(events), /Movilidad urbana|Carriles bici|OPENAI_API_KEY/)
})

test('rejects malformed map metadata before calling the model', async (t) => {
  let called = false
  const server = createServer({ describeMap: async () => { called = true } })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => server.close())

  const response = await request(server, { context: { title: 'Mapa', layers: [] }, locale: 'es' })

  assert.equal(response.status, 400)
  assert.equal(response.body.error.code, 'INVALID_REQUEST')
  assert.equal(called, false)
})
