const MAX_VISUAL_BYTES = 1_500_000
const MAX_VISUAL_WIDTH = 1280
const MAX_VISUAL_HEIGHT = 1280
const PNG_DATA_URL_PREFIX = 'data:image/png;base64,'

function decodedByteLength (base64) {
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0
  return Math.floor(base64.length * 3 / 4) - padding
}

function normalizeVisualRequest (visual) {
  if (!visual?.enabled || typeof visual.imageDataUrl !== 'string' || !visual.imageDataUrl.startsWith(PNG_DATA_URL_PREFIX)) {
    throw new TypeError('visual request must contain a PNG data URL')
  }
  if (!Number.isInteger(visual.width) || !Number.isInteger(visual.height) || visual.width < 1 || visual.height < 1 || visual.width > MAX_VISUAL_WIDTH || visual.height > MAX_VISUAL_HEIGHT) {
    throw new TypeError('visual image dimensions are invalid')
  }
  const base64 = visual.imageDataUrl.slice(PNG_DATA_URL_PREFIX.length)
  if (!base64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) throw new TypeError('visual request must contain a PNG data URL')
  if (decodedByteLength(base64) > MAX_VISUAL_BYTES) throw new RangeError('visual image is too large')
  const buffer = Buffer.from(base64, 'base64')
  if (buffer.length !== decodedByteLength(base64) || buffer.length < 24 || !buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) || buffer.subarray(12, 16).toString('ascii') !== 'IHDR') {
    throw new TypeError('visual request must contain a valid PNG')
  }
  const pngWidth = buffer.readUInt32BE(16)
  const pngHeight = buffer.readUInt32BE(20)
  if (pngWidth !== visual.width || pngHeight !== visual.height) throw new TypeError('visual image dimensions do not match PNG')
  return { enabled: true, dataUrl: visual.imageDataUrl, mimeType: 'image/png', width: visual.width, height: visual.height }
}

module.exports = { MAX_VISUAL_BYTES, MAX_VISUAL_WIDTH, MAX_VISUAL_HEIGHT, normalizeVisualRequest }
