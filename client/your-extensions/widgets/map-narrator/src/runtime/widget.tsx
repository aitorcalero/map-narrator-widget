import { React, type AllWidgetProps } from 'jimu-core'
import { Button } from 'jimu-ui'
import { JimuMapViewComponent, type JimuMapView } from 'jimu-arcgis'
import type { Config } from '../config'
import { resolveApiUrl } from '../config'
import { buildMapContext } from './map-context'
import { narrationContentStyle } from './layout'

type Description = {
  title: string
  description: string
  highlightedLayers: string[]
  observedPatterns: string[]
  limitations: string[]
}

export default function Widget (props: AllWidgetProps<Config>) {
  const [mapView, setMapView] = React.useState<JimuMapView>()
  const [description, setDescription] = React.useState<Description>()
  const [error, setError] = React.useState<string>()
  const [loading, setLoading] = React.useState(false)
  const apiUrl = resolveApiUrl(props.config)
  const mapWidgetId = props.useMapWidgetIds?.[0]

  const onDescribe = async () => {
    if (!mapView?.view || !apiUrl) return
    setLoading(true)
    setError(undefined)
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          context: buildMapContext(mapView.view),
          locale: document.documentElement.lang || 'es',
          style: props.config?.style ?? 'technical'
        })
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload?.error?.message ?? 'No se pudo generar la descripción.')
      setDescription(payload.description)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo generar la descripción.')
    } finally {
      setLoading(false)
    }
  }

  const disabledMessage = !mapWidgetId
    ? 'Selecciona un widget de mapa en la configuración.'
    : !apiUrl
      ? 'Configura una URL HTTPS para la API de narración.'
      : !mapView?.view
        ? 'Esperando a que cargue el mapa.'
        : undefined

  return (
    <div className='widget-map-narrator jimu-widget h-100 p-3 d-flex flex-column overflow-hidden'>
      <h3 className='h5'>Narrador del mapa</h3>
      <p className='text-muted'>Genera un resumen basado en la extensión y las capas visibles del mapa.</p>
      <Button type='primary' onClick={onDescribe} disabled={Boolean(disabledMessage) || loading} aria-describedby='map-narrator-status'>
        {loading ? 'Analizando mapa…' : 'Describir mapa'}
      </Button>
      <div id='map-narrator-status' className='mt-3' role='status' aria-live='polite'>
        {disabledMessage ?? (loading ? 'Analizando la configuración visible del mapa…' : '')}
      </div>
      {error && <div className='alert alert-danger mt-3' role='alert'>{error}</div>}
      {description && (
        <section className='mt-3' style={narrationContentStyle} aria-label='Descripción generada del mapa'>
          <h4 className='h6'>{description.title}</h4>
          <p>{description.description}</p>
          {description.highlightedLayers.length > 0 && <p><strong>Capas destacadas:</strong> {description.highlightedLayers.join(', ')}</p>}
          {description.observedPatterns.length > 0 && <p><strong>Patrones:</strong> {description.observedPatterns.join(' ')}</p>}
          <p><strong>Limitaciones:</strong> {description.limitations.join(' ')}</p>
        </section>
      )}
      {mapWidgetId && <JimuMapViewComponent useMapWidgetId={mapWidgetId} onActiveViewChange={setMapView} />}
    </div>
  )
}
