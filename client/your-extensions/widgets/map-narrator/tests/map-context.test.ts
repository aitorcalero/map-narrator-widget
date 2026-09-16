import { buildMapContext } from '../src/runtime/map-context'

describe('buildMapContext', () => {
  it('creates bounded non-sensitive metadata from a map view', () => {
    const context = buildMapContext({
      map: {
        portalItem: { title: 'Movilidad urbana' },
        basemap: { title: 'Topographic' },
        layers: Array.from({ length: 13 }, (_, index) => ({
          title: `Capa ${index + 1}`,
          type: 'feature',
          visible: true,
          opacity: 0.7,
          definitionExpression: 'activo = 1',
          renderer: { type: 'simple', field: 'clase' },
          features: [{ geometry: { x: 1 }, attributes: { secret: 'never' } }]
        }))
      },
      extent: { xmin: 1, ymin: 2, xmax: 3, ymax: 4, spatialReference: { wkid: 4326 } },
      scale: 10000
    } as any)

    expect(context.title).toBe('Movilidad urbana')
    expect(context.layers).toHaveLength(12)
    expect(context.layers[0]).toEqual({
      title: 'Capa 1', type: 'feature', visible: true, opacity: 0.7,
      definitionExpression: 'activo = 1', renderer: { type: 'simple', field: 'clase' }
    })
    expect(JSON.stringify(context)).not.toContain('secret')
    expect(JSON.stringify(context)).not.toContain('geometry')
  })
})
