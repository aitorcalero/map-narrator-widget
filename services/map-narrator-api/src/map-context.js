const MAX_LAYERS = 12
const MAX_TITLE_LENGTH = 160
const MAX_EXPRESSION_LENGTH = 500

function boundedString(value, field, maxLength) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`${field} must be a non-empty string`)
  }
  return value.trim().slice(0, maxLength)
}

function finiteNumber(value, field) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${field} must be a finite number`)
  }
  return value
}

function normalizeExtent(extent) {
  if (!extent || typeof extent !== 'object') {
    throw new TypeError('extent is required')
  }

  const normalized = {
    xmin: finiteNumber(extent.xmin, 'extent.xmin'),
    ymin: finiteNumber(extent.ymin, 'extent.ymin'),
    xmax: finiteNumber(extent.xmax, 'extent.xmax'),
    ymax: finiteNumber(extent.ymax, 'extent.ymax')
  }

  if (normalized.xmin >= normalized.xmax || normalized.ymin >= normalized.ymax) {
    throw new TypeError('extent bounds are invalid')
  }

  const wkid = extent.spatialReference?.wkid
  if (Number.isInteger(wkid)) {
    normalized.spatialReference = { wkid }
  }

  return normalized
}

function normalizeLayer(layer) {
  if (!layer || typeof layer !== 'object') {
    throw new TypeError('layer must be an object')
  }

  const normalized = {
    title: boundedString(layer.title, 'layer.title', MAX_TITLE_LENGTH),
    type: boundedString(layer.type, 'layer.type', 80),
    visible: Boolean(layer.visible),
    opacity: typeof layer.opacity === 'number' && Number.isFinite(layer.opacity)
      ? Math.max(0, Math.min(1, layer.opacity))
      : 1
  }

  if (typeof layer.definitionExpression === 'string' && layer.definitionExpression.trim()) {
    normalized.definitionExpression = layer.definitionExpression.trim().slice(0, MAX_EXPRESSION_LENGTH)
  }

  if (layer.renderer && typeof layer.renderer === 'object' && typeof layer.renderer.type === 'string') {
    normalized.renderer = { type: layer.renderer.type.slice(0, 80) }
    if (typeof layer.renderer.field === 'string' && layer.renderer.field.trim()) {
      normalized.renderer.field = layer.renderer.field.trim().slice(0, 160)
    }
  }

  return normalized
}

function normalizeMapContext(input) {
  if (!input || typeof input !== 'object') {
    throw new TypeError('map context is required')
  }
  if (!Array.isArray(input.layers)) {
    throw new TypeError('layers must be an array')
  }

  const normalized = {
    title: boundedString(input.title, 'title', MAX_TITLE_LENGTH),
    extent: normalizeExtent(input.extent),
    layers: input.layers.slice(0, MAX_LAYERS).map(normalizeLayer)
  }

  if (typeof input.scale === 'number' && Number.isFinite(input.scale) && input.scale > 0) {
    normalized.scale = input.scale
  }
  if (typeof input.basemap === 'string' && input.basemap.trim()) {
    normalized.basemap = input.basemap.trim().slice(0, MAX_TITLE_LENGTH)
  }

  return normalized
}

module.exports = { MAX_LAYERS, normalizeMapContext }
