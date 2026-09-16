const test = require('node:test')
const assert = require('node:assert/strict')

const { normalizeMapContext } = require('../src/map-context')

test('normalizes bounded metadata without features or geometry', () => {
  const normalized = normalizeMapContext({
    title: 'Movilidad urbana',
    extent: { xmin: 1, ymin: 2, xmax: 3, ymax: 4, spatialReference: { wkid: 4326 } },
    scale: 12000,
    basemap: 'Topographic',
    layers: Array.from({ length: 14 }, (_, index) => ({
      title: `Capa ${index + 1}`,
      type: 'feature',
      visible: true,
      opacity: 1,
      definitionExpression: 'status = active',
      renderer: { type: 'simple', field: 'category' },
      features: [{ attributes: { private: 'do not send' }, geometry: { x: 1, y: 2 } }]
    }))
  })

  assert.equal(normalized.layers.length, 12)
  assert.deepEqual(normalized.layers[0], {
    title: 'Capa 1',
    type: 'feature',
    visible: true,
    opacity: 1,
    definitionExpression: 'status = active',
    renderer: { type: 'simple', field: 'category' }
  })
  assert.equal(JSON.stringify(normalized).includes('private'), false)
  assert.equal(JSON.stringify(normalized).includes('geometry'), false)
})

test('rejects invalid extents and malformed layers', () => {
  assert.throws(
    () => normalizeMapContext({ title: 'Mapa', extent: { xmin: 1 }, layers: [] }),
    /extent/i
  )
  assert.throws(
    () => normalizeMapContext({ title: 'Mapa', extent: { xmin: 1, ymin: 2, xmax: 3, ymax: 4 }, layers: [{}] }),
    /layer/i
  )
})
