import { React, type AllWidgetProps } from 'jimu-core'
import { Button } from 'jimu-ui'
import { JimuMapViewComponent, type JimuMapView } from 'jimu-arcgis'
import type { Config } from '../config'
import { resolveApiUrl, resolveNarrationMode } from '../config'
import { buildMapContext } from './map-context'
import { captureVisualMap } from './visual-capture'
import { createDiagnosticEntry, openDiagnosticWindow } from './diagnostics'
import { narrationContentStyle } from './layout'

type Description = {
  title: string
  description: string
  spatialLayout?: string[]
  visualElements?: string[]
  visibleLabels?: string[]
  legendAndSymbols?: string[]
  highlightedLayers: string[]
  observedPatterns: string[]
  limitations: string[]
}

function descriptionToSpeechText (description: Description): string {
  return [
    description.title,
    description.description,
    ...(description.spatialLayout ?? []),
    ...(description.visualElements ?? []),
    ...(description.visibleLabels ?? []),
    ...(description.legendAndSymbols ?? []),
    description.highlightedLayers.length > 0 ? `Capas destacadas: ${description.highlightedLayers.join(', ')}.` : '',
    description.observedPatterns.length > 0 ? `Patrones: ${description.observedPatterns.join(' ')}` : '',
    description.limitations.length > 0 ? `Limitaciones: ${description.limitations.join(' ')}` : ''
  ].filter(Boolean).join('\n\n')
}

export default function Widget (props: AllWidgetProps<Config>) {
  const [mapView, setMapView] = React.useState<JimuMapView>()
  const [description, setDescription] = React.useState<Description>()
  const [error, setError] = React.useState<string>()
  const [loading, setLoading] = React.useState(false)
  const [speechLoading, setSpeechLoading] = React.useState(false)
  const [speechAudioUrl, setSpeechAudioUrl] = React.useState<string>()
  const [operationStatus, setOperationStatus] = React.useState<string>()
  const [diagnostics, setDiagnostics] = React.useState<unknown[]>([])
  const apiUrl = resolveApiUrl(props.config)
  const narrationMode = resolveNarrationMode(props.config)
  const mapWidgetId = props.useMapWidgetIds?.[0]
  const speechApiUrl = apiUrl?.replace(/\/api\/map-description\/?$/, '/api/speech')

  React.useEffect(() => () => {
    if (speechAudioUrl) URL.revokeObjectURL(speechAudioUrl)
  }, [speechAudioUrl])

  const onDescribe = async () => {
    if (!mapView?.view || !apiUrl) return
    if (narrationMode === 'visual') {
      setDescription(undefined)
      setSpeechAudioUrl(previous => {
        if (previous) URL.revokeObjectURL(previous)
        return undefined
      })
    }
    const startedAt = Date.now()
    const context = buildMapContext(mapView.view)
    const locale = document.documentElement.lang || 'es'
    const style = narrationMode === 'visual' ? 'accessible' : props.config?.style ?? 'technical'
    let visual: { enabled: true, imageDataUrl: string, width: number, height: number } | undefined
    setLoading(true)
    setError(undefined)
    try {
      visual = narrationMode === 'visual'
        ? (setOperationStatus('Capturando la vista actual del mapa…'), await captureVisualMap(mapView.view))
        : undefined
      setOperationStatus(visual ? 'Analizando visualmente el mapa…' : 'Analizando la configuración visible del mapa…')
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          context,
          locale,
          style,
          visual
        })
      })
      const payload = await response.json()
      if (!response.ok) {
        const message = payload?.error?.message ?? 'No se pudo generar la descripción.'
        setDiagnostics(entries => [...entries, createDiagnosticEntry({ mode: narrationMode, apiUrl, context, visual, locale, style, status: response.status, response: { error: payload?.error, diagnostic: payload?.diagnostic }, durationMs: Date.now() - startedAt })].slice(-20))
        setError(message)
        return
      }
      setDiagnostics(entries => [...entries, createDiagnosticEntry({ mode: narrationMode, apiUrl, context, visual, locale, style, status: response.status, response: { description: payload.description, diagnostic: payload.diagnostic }, durationMs: Date.now() - startedAt })].slice(-20))
      setDescription(payload.description)
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'No se pudo generar la descripción.'
      setDiagnostics(entries => [...entries, createDiagnosticEntry({ mode: narrationMode, apiUrl, context, visual, locale, style, error: message, durationMs: Date.now() - startedAt })].slice(-20))
      setError(message)
    } finally {
      setLoading(false)
      setOperationStatus(undefined)
    }
  }

  const onReadDescription = async () => {
    if (!description || !speechApiUrl) return
    setSpeechLoading(true)
    setError(undefined)
    try {
      const response = await fetch(speechApiUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: descriptionToSpeechText(description) })
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => undefined)
        throw new Error(payload?.error?.message ?? 'No se pudo generar el audio.')
      }
      const audioUrl = URL.createObjectURL(await response.blob())
      setSpeechAudioUrl(previous => {
        if (previous) URL.revokeObjectURL(previous)
        return audioUrl
      })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo generar el audio.')
    } finally {
      setSpeechLoading(false)
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
        {loading ? operationStatus ?? 'Analizando mapa…' : narrationMode === 'visual' ? 'Describir visualmente el mapa' : 'Describir metadatos del mapa'}
      </Button>
      <Button className='mt-2 align-self-start' type='tertiary' disabled={diagnostics.length === 0} onClick={() => {
        if (!openDiagnosticWindow(diagnostics)) setError('El navegador bloqueó la ventana de diagnóstico. Permite las ventanas emergentes e inténtalo de nuevo.')
      }}>
        Abrir registro de diagnóstico ({diagnostics.length})
      </Button>
      {narrationMode === 'visual' && <p className='text-muted mt-2 mb-0'>La captura se procesa para generar la descripción y no se guarda en el widget. El registro solo conserva tamaño y dimensiones, nunca los bytes de la imagen.</p>}
      <div id='map-narrator-status' className='mt-3' role='status' aria-live='polite'>
        {disabledMessage ?? operationStatus ?? ''}
      </div>
      {error && <div className='alert alert-danger mt-3' role='alert'>{error}</div>}
      {description && (
        <section className='mt-3' style={narrationContentStyle} aria-label='Descripción generada del mapa'>
          <h4 className='h6'>{description.title}</h4>
          <p>{description.description}</p>
          {description.spatialLayout && description.spatialLayout.length > 0 && <><h4 className='h6'>Distribución espacial</h4><ul>{description.spatialLayout.map((item, index) => <li key={`layout-${index}`}>{item}</li>)}</ul></>}
          {description.visualElements && description.visualElements.length > 0 && <><h4 className='h6'>Elementos visuales</h4><ul>{description.visualElements.map((item, index) => <li key={`visual-${index}`}>{item}</li>)}</ul></>}
          {description.legendAndSymbols && description.legendAndSymbols.length > 0 && <><h4 className='h6'>Leyenda y símbolos</h4><ul>{description.legendAndSymbols.map((item, index) => <li key={`legend-${index}`}>{item}</li>)}</ul></>}
          {description.visibleLabels && description.visibleLabels.length > 0 && <><h4 className='h6'>Etiquetas visibles</h4><ul>{description.visibleLabels.map((item, index) => <li key={`label-${index}`}>{item}</li>)}</ul></>}
          {description.highlightedLayers.length > 0 && <p><strong>Capas destacadas:</strong> {description.highlightedLayers.join(', ')}</p>}
          {description.observedPatterns.length > 0 && <p><strong>Patrones:</strong> {description.observedPatterns.join(' ')}</p>}
          <p><strong>Limitaciones:</strong> {description.limitations.join(' ')}</p>
          <Button className='mt-2' type='secondary' onClick={onReadDescription} disabled={speechLoading || !speechApiUrl}>
            {speechLoading ? 'Generando audio…' : 'Leer descripción'}
          </Button>
          {speechAudioUrl && <audio className='d-block mt-2 w-100' controls src={speechAudioUrl} aria-label='Audio de la descripción del mapa' />}
        </section>
      )}
      {mapWidgetId && <JimuMapViewComponent useMapWidgetId={mapWidgetId} onActiveViewChange={setMapView} />}
    </div>
  )
}
