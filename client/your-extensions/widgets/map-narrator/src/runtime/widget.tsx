import { React, type AllWidgetProps } from 'jimu-core'
import { Button } from 'jimu-ui'
import { JimuMapViewComponent, type JimuMapView } from 'jimu-arcgis'
import type { Config } from '../config'
import { resolveApiUrl, resolveNarrationMode } from '../config'
import { buildMapContext } from './map-context'
import { captureVisualMap } from './visual-capture'
import { createDiagnosticEntry, openDiagnosticWindow } from './diagnostics'
import { narrationContentStyle } from './layout'
import { focusAudioAfterGeneration } from './audio-focus'
import { ProgressTracker } from './progress-tracker'
import { metadataDescribeSteps, speechSteps, type ProgressStep, visualDescribeSteps } from './progress-steps'
import { buildSpeechSummary, type SpeechDescription } from './speech-summary'

const WIDGET_VERSION = '1.1.0 · stable'

export default function Widget (props: AllWidgetProps<Config>) {
  const [mapView, setMapView] = React.useState<JimuMapView>()
  const [description, setDescription] = React.useState<SpeechDescription>()
  const [error, setError] = React.useState<string>()
  const [loading, setLoading] = React.useState(false)
  const [speechLoading, setSpeechLoading] = React.useState(false)
  const [speechAudioUrl, setSpeechAudioUrl] = React.useState<string>()
  const speechAudioRef = React.useRef<HTMLAudioElement>(null)
  const [operationStatus, setOperationStatus] = React.useState<string>()
  const [progressSteps, setProgressSteps] = React.useState<ProgressStep[]>([])
  const [progressIndex, setProgressIndex] = React.useState(-1)
  const [progressStartedAt, setProgressStartedAt] = React.useState<number>()
  const [elapsedSeconds, setElapsedSeconds] = React.useState(0)
  const [diagnostics, setDiagnostics] = React.useState<unknown[]>([])
  const apiUrl = resolveApiUrl(props.config)
  const narrationMode = resolveNarrationMode(props.config)
  const mapWidgetId = props.useMapWidgetIds?.[0]
  const speechApiUrl = apiUrl?.replace(/\/api\/map-description\/?$/, '/api/speech')

  React.useEffect(() => () => {
    if (speechAudioUrl) URL.revokeObjectURL(speechAudioUrl)
  }, [speechAudioUrl])

  React.useEffect(() => {
    focusAudioAfterGeneration(speechAudioRef.current, speechAudioUrl)
  }, [speechAudioUrl])

  React.useEffect(() => {
    if (!progressStartedAt) return
    const updateElapsed = () => setElapsedSeconds(Math.max(0, Math.floor((Date.now() - progressStartedAt) / 1000)))
    updateElapsed()
    const timer = window.setInterval(updateElapsed, 1000)
    return () => window.clearInterval(timer)
  }, [progressStartedAt])

  const startProgress = (steps: ProgressStep[]) => {
    setProgressSteps(steps)
    setProgressIndex(0)
    setProgressStartedAt(Date.now())
    setElapsedSeconds(0)
  }

  const finishProgress = () => {
    setProgressSteps([])
    setProgressIndex(-1)
    setProgressStartedAt(undefined)
  }

  const onDescribe = async () => {
    if (!mapView?.view || !apiUrl) return
    setDescription(undefined)
    setSpeechAudioUrl(previous => {
      if (previous) URL.revokeObjectURL(previous)
      return undefined
    })
    const startedAt = Date.now()
    const context = buildMapContext(mapView.view)
    const locale = document.documentElement.lang || 'es'
    const style = narrationMode === 'visual' ? 'accessible' : props.config?.style ?? 'technical'
    let visual: { enabled: true, imageDataUrl: string, width: number, height: number } | undefined
    setLoading(true)
    setError(undefined)
    startProgress(narrationMode === 'visual' ? visualDescribeSteps : metadataDescribeSteps)
    try {
      visual = narrationMode === 'visual'
        ? (setOperationStatus('Capturando la vista actual del mapa…'), await captureVisualMap(mapView.view))
        : undefined
      setProgressIndex(narrationMode === 'visual' ? 1 : 0)
      setOperationStatus(visual ? 'Analizando visualmente el mapa…' : 'Analizando la configuración visible del mapa…')
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          context,
          locale,
          style,
          customPrompt: props.config?.customPrompt,
          visual
        })
      })
      const payload = await response.json()
      setProgressIndex(narrationMode === 'visual' ? 2 : 1)
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
      finishProgress()
    }
  }

  const onReadDescription = async () => {
    if (!description || !speechApiUrl) return
    setSpeechLoading(true)
    setError(undefined)
    startProgress(speechSteps)
    try {
      const text = buildSpeechSummary(description)
      setProgressIndex(1)
      const response = await fetch(speechApiUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text })
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => undefined)
        throw new Error(payload?.error?.message ?? 'No se pudo generar el audio.')
      }
      setProgressIndex(2)
      const audioUrl = URL.createObjectURL(await response.blob())
      setSpeechAudioUrl(previous => {
        if (previous) URL.revokeObjectURL(previous)
        return audioUrl
      })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo generar el audio.')
    } finally {
      setSpeechLoading(false)
      finishProgress()
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
      <div className='d-flex align-items-start justify-content-between'>
        <h3 className='h5 mb-0'>Narrador del mapa</h3>
        <span className='small text-muted ms-3' aria-label='Versión del widget'>{WIDGET_VERSION}</span>
      </div>
      <p className='text-muted'>Genera un resumen basado en la extensión y las capas visibles del mapa.</p>
      <Button type='primary' onClick={onDescribe} disabled={Boolean(disabledMessage) || loading || speechLoading} aria-describedby='map-narrator-status' aria-busy={loading || speechLoading}>
        {loading && <span className='spinner-border spinner-border-sm me-2' aria-hidden='true' />}
        {loading ? operationStatus ?? 'Analizando mapa…' : narrationMode === 'visual' ? 'Describir visualmente el mapa' : 'Describir metadatos del mapa'}
      </Button>
      <Button className='mt-2 align-self-start' type='tertiary' disabled={diagnostics.length === 0} onClick={() => {
        if (!openDiagnosticWindow(diagnostics)) setError('El navegador bloqueó la ventana de diagnóstico. Permite las ventanas emergentes e inténtalo de nuevo.')
      }}>
        Abrir registro de diagnóstico ({diagnostics.length})
      </Button>
      {narrationMode === 'visual' && <p className='text-muted mt-2 mb-0'>La captura se procesa para generar la descripción y no se guarda en el widget. El registro solo conserva tamaño y dimensiones, nunca los bytes de la imagen.</p>}
      <div id='map-narrator-status' className='mt-3' role='status' aria-live='polite' aria-busy={loading}>
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
          <div className='mt-2'>
            {speechAudioUrl
              ? <audio ref={speechAudioRef} className='d-block w-100' controls src={speechAudioUrl} aria-label='Audio de la descripción del mapa' />
              : <div className='small text-muted'>Pulsa "Leer descripción" para generar el audio.</div>}
          </div>
        </section>
      )}
      <ProgressTracker steps={progressSteps} currentIndex={progressIndex} elapsedSeconds={elapsedSeconds} />
      {mapWidgetId && <JimuMapViewComponent useMapWidgetId={mapWidgetId} onActiveViewChange={setMapView} />}
    </div>
  )
}
