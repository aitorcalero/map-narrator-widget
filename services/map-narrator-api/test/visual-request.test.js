const test = require('node:test')
const assert = require('node:assert/strict')

const { normalizeVisualRequest } = require('../src/visual-request')

const validPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIW2Nk+M/wHwAF/gL+MZ2AyAAAAABJRU5ErkJggg=='
const validJpeg = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAH/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAEFAqf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/AT//xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/AT//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAY/Aqf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/IV//2gAMAwEAAgADAAAAEP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Qf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Qf//EABQQAQAAAAAAAAAAAAAAAAAAACD/2gAIAQEAAT8hH//Z'

test('accepts a bounded PNG visual request', () => {
  const visual = normalizeVisualRequest({ enabled: true, imageDataUrl: validPng, width: 1, height: 1 })
  assert.deepEqual(visual, { enabled: true, dataUrl: validPng, mimeType: 'image/png', width: 1, height: 1 })
})

test('accepts a bounded JPEG visual request', () => {
  const visual = normalizeVisualRequest({ enabled: true, imageDataUrl: validJpeg, width: 1, height: 1 })
  assert.equal(visual.mimeType, 'image/jpeg')
})

test('rejects malformed image, excessive bytes, and excessive dimensions', () => {
  assert.throws(() => normalizeVisualRequest({ enabled: true, imageDataUrl: 'data:image/jpeg;base64,AA==', width: 1, height: 1 }), /JPEG/)
  assert.throws(() => normalizeVisualRequest({ enabled: true, imageDataUrl: 'not-a-data-url', width: 1, height: 1 }), /PNG or JPEG/)
  assert.throws(() => normalizeVisualRequest({ enabled: true, imageDataUrl: validPng, width: 1281, height: 720 }), /dimensions/)
  assert.throws(() => normalizeVisualRequest({ enabled: true, imageDataUrl: `data:image/png;base64,${'A'.repeat(5_600_004)}`, width: 1, height: 1 }), /too large/)
  assert.throws(() => normalizeVisualRequest({ enabled: true, imageDataUrl: 'data:image/png;base64,QUFBQQ==', width: 1, height: 1 }), /valid PNG/)
})
