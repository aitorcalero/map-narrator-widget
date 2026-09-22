const MAX_VISUAL_BYTES = 4 * 1024 * 1024
const MAX_VISUAL_WIDTH = 1280
const MAX_VISUAL_HEIGHT = 1280
const PNG_DATA_URL_PREFIX = 'data:image/png;base64,'
const JPEG_DATA_URL_PREFIX = 'data:image/jpeg;base64,'

function decodedByteLength (base64) {
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0
  return Math.floor(base64.length * 3 / 4) - padding
}

function jpegDimensions (buffer) {
  let offset = 2
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1
      continue
    }
    const marker = buffer[offset + 1]
    if (marker === 0xd9 || marker === 0xda) break
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2
      continue
    }
    const segmentLength = buffer.readUInt16BE(offset + 2)
    if (segmentLength < 2 || offset + segmentLength + 2 > buffer.length) break
    const isStartOfFrame = (marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)
    if (isStartOfFrame) {
      return { width: buffer.readUInt16BE(offset + 7), height: buffer.readUInt16BE(offset + 5) }
    }
    offset += segmentLength + 2
  }
  return undefined
}

function normalizeVisualRequest (visual) {
  if (!visual?.enabled || typeof visual.imageDataUrl !== 'string') {
    throw new TypeError('visual request must contain a PNG or JPEG data URL')
  }
  if (!Number.isInteger(visual.width) || !Number.isInteger(visual.height) || visual.width < 1 || visual.height < 1 || visual.width > MAX_VISUAL_WIDTH || visual.height > MAX_VISUAL_HEIGHT) {
    throw new TypeError('visual image dimensions are invalid')
  }
  const prefix = visual.imageDataUrl.startsWith(PNG_DATA_URL_PREFIX)
    ? PNG_DATA_URL_PREFIX
    : visual.imageDataUrl.startsWith(JPEG_DATA_URL_PREFIX)
      ? JPEG_DATA_URL_PREFIX
      : undefined
  if (!prefix) throw new TypeError('visual request must contain a PNG or JPEG data URL')
  const base64 = visual.imageDataUrl.slice(prefix.length)
  if (!base64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) throw new TypeError('visual request must contain a valid image data URL')
  if (decodedByteLength(base64) > MAX_VISUAL_BYTES) throw new RangeError('visual image is too large')
  const buffer = Buffer.from(base64, 'base64')
  if (buffer.length !== decodedByteLength(base64)) throw new TypeError('visual request must contain a valid image')
  let imageDimensions
  if (prefix === PNG_DATA_URL_PREFIX) {
    if (buffer.length < 24 || !buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) || buffer.subarray(12, 16).toString('ascii') !== 'IHDR') {
      throw new TypeError('visual request must contain a valid PNG')
    }
    imageDimensions = { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
  } else {
    if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8 || buffer[2] !== 0xff) {
      throw new TypeError('visual request must contain a valid JPEG')
    }
    imageDimensions = jpegDimensions(buffer)
    if (!imageDimensions) throw new TypeError('visual request must contain a valid JPEG')
  }
  if (imageDimensions.width !== visual.width || imageDimensions.height !== visual.height) throw new TypeError('visual image dimensions do not match image')
  return { enabled: true, dataUrl: visual.imageDataUrl, mimeType: prefix === PNG_DATA_URL_PREFIX ? 'image/png' : 'image/jpeg', width: visual.width, height: visual.height }
}

module.exports = { MAX_VISUAL_BYTES, MAX_VISUAL_WIDTH, MAX_VISUAL_HEIGHT, normalizeVisualRequest }
