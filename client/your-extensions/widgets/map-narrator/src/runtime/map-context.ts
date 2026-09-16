export interface MapLayerMetadata {
  title: string
  type: string
  visible: boolean
  opacity: number
  definitionExpression?: string
  renderer?: { type: string, field?: string }
}

export interface MapNarrationContext {
  title: string
  extent: { xmin: number, ymin: number, xmax: number, ymax: number, spatialReference?: { wkid: number } }
  scale?: number
  basemap?: string
  layers: MapLayerMetadata[]
}

const MAX_LAYERS = 12

function stringValue (value: unknown, fallback: string, maxLength = 160): string {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, maxLength) : fallback
}

export function buildMapContext (view: any): MapNarrationContext {
  if (!view?.extent || !view?.map) throw new Error('Map view is not ready')

  const extent = view.extent
  const layers = Array.from(view.map.layers ?? []).slice(0, MAX_LAYERS).map((layer: any): MapLayerMetadata => {
    const metadata: MapLayerMetadata = {
      title: stringValue(layer.title, 'Untitled layer'),
      type: stringValue(layer.type, 'unknown', 80),
      visible: Boolean(layer.visible),
      opacity: typeof layer.opacity === 'number' && Number.isFinite(layer.opacity) ? Math.max(0, Math.min(1, layer.opacity)) : 1
    }
    if (typeof layer.definitionExpression === 'string' && layer.definitionExpression.trim()) {
      metadata.definitionExpression = layer.definitionExpression.trim().slice(0, 500)
    }
    if (layer.renderer?.type) {
      metadata.renderer = { type: stringValue(layer.renderer.type, 'unknown', 80) }
      if (typeof layer.renderer.field === 'string' && layer.renderer.field.trim()) {
        metadata.renderer.field = layer.renderer.field.trim().slice(0, 160)
      }
    }
    return metadata
  })

  const context: MapNarrationContext = {
    title: stringValue(view.map.portalItem?.title ?? view.map.title, 'Untitled map'),
    extent: {
      xmin: Number(extent.xmin), ymin: Number(extent.ymin), xmax: Number(extent.xmax), ymax: Number(extent.ymax)
    },
    layers
  }
  if (Number.isInteger(extent.spatialReference?.wkid)) context.extent.spatialReference = { wkid: extent.spatialReference.wkid }
  if (typeof view.scale === 'number' && Number.isFinite(view.scale) && view.scale > 0) context.scale = view.scale
  if (view.map.basemap?.title) context.basemap = stringValue(view.map.basemap.title, 'Unknown basemap')
  return context
}
