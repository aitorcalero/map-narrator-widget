const test = require('node:test')
const assert = require('node:assert/strict')

const { normalizeVisualRequest } = require('../src/visual-request')

const tinyPng = 'data:image/png;base64,iVBORw0KGgo='

test('accepts a bounded PNG visual request', () => {
  const visual = normalizeVisualRequest({ enabled: true, imageDataUrl: tinyPng, width: 1280, height: 720 })
  assert.deepEqual(visual, { enabled: true, dataUrl: tinyPng, mimeType: 'image/png', width: 1280, height: 720 })
})

test('rejects malformed image, excessive bytes, and excessive dimensions', () => {
  assert.throws(() => normalizeVisualRequest({ enabled: true, imageDataUrl: 'data:image/jpeg;base64,AA==', width: 1, height: 1 }), /PNG/)
  assert.throws(() => normalizeVisualRequest({ enabled: true, imageDataUrl: 'not-a-data-url', width: 1, height: 1 }), /PNG/)
  assert.throws(() => normalizeVisualRequest({ enabled: true, imageDataUrl: tinyPng, width: 1281, height: 720 }), /dimensions/)
  assert.throws(() => normalizeVisualRequest({ enabled: true, imageDataUrl: `data:image/png;base64,${'A'.repeat(2_000_004)}`, width: 1, height: 1 }), /too large/)
})
