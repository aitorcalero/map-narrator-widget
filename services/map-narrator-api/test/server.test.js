const test = require('node:test')
const assert = require('node:assert/strict')
const { once } = require('node:events')
const http = require('node:http')

const { createServer } = require('../src/server')

async function request(server, payload) {
  const address = server.address()
  return await new Promise((resolve, reject) => {
    const body = JSON.stringify(payload)
    const req = http.request({
      host: '127.0.0.1',
      port: address.port,
      path: '/api/map-description',
      method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) }
    }, (response) => {
      let text = ''
      response.setEncoding('utf8')
      response.on('data', (chunk) => { text += chunk })
      response.on('end', () => resolve({ status: response.statusCode, body: JSON.parse(text) }))
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
