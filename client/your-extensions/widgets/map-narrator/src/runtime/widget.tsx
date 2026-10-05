import { React, type AllWidgetProps } from 'jimu-core'
import { Alert, Button, Typography } from 'jimu-ui'
import { useTheme } from 'jimu-theme'
import { JimuMapViewComponent, type JimuMapView } from 'jimu-arcgis'
import type { Config } from '../config'
import { resolveApiUrl, resolveNarrationMode } from '../config'
import { buildMapContext } from './map-context'
import { captureVisualMap } from './visual-capture'
import { createDiagnosticEntry, openDiagnosticWindow } from './diagnostics'
import { narrationContentStyle } from './layout'
import { inlineSpinnerStyle } from './styles'
import { focusAudioAfterGeneration } from './audio-focus'
import { ProgressTracker } from './progress-tracker'
import { getMetadataDescribeSteps, getSpeechSteps, getVisualDescribeSteps } from './progress-steps'
import { buildSpeechSummary, type SpeechDescription } from './speech-summary'
import { getLocaleMessages, getLocalizedApiError, useBrowserLocale } from '../locale'

const WIDGET_VERSION = '1.2.1 · stable'
type ProgressFlow = 'metadata' | 'visual' | 'speech'
type OperationStatus = 'progressCapture' | 'progressAnalyzeVisual' | 'progressAnalyzeMetadata'

export default function Widget (props: AllWidgetProps<Config>) {
  const theme = useTheme()
  const locale = useBrowserLocale()
  const messages = getLocaleMessages(locale)
  const [mapView, setMapView] = React.useState<JimuMapView>()
  const [description, setDescription] = React.useState<SpeechDescription>()
  const [error, setError] = React.useState<string>()
  const [loading, setLoading] = React.useState(false)
  const [speechLoading, setSpeechLoading] = React.useState(false)
  const [speechAudioUrl, setSpeechAudioUrl] = React.useState<string>()
  const speechAudioRef = React.useRef<HTMLAudioElement>(null)
  const [operationStatus, setOperationStatus] = React.useState<OperationStatus>()
  const [progressFlow, setProgressFlow] = React.useState<ProgressFlow>()
  const [progressIndex, setProgressIndex] = React.useState(-1)
  const [progressStartedAt, setProgressStartedAt] = React.useState<number>()
  const [elapsedSeconds, setElapsedSeconds] = React.useState(0)
  const [diagnostics, setDiagnostics] = React.useState<unknown[]>([])
  const apiUrl = resolveApiUrl(props.config)
  const narrationMode = resolveNarrationMode(props.config)
  const mapWidgetId = props.useMapWidgetIds?.[0]
  const speechApiUrl = apiUrl?.replace(/\/api\/map-description\/?$/, '/api/speech')
  const progressSteps = progressFlow === 'visual'
    ? getVisualDescribeSteps(messages)
    : progressFlow === 'metadata'
      ? getMetadataDescribeSteps(messages)
      : progressFlow === 'speech'
        ? getSpeechSteps(messages)
        : []

  const spinnerStyle = React.useMemo(
    () => inlineSpinnerStyle(theme, theme.sys.spacing(2)),
    [theme]
  )

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

  const startProgress = (flow: ProgressFlow) => {
    setProgressFlow(flow)
    setProgressIndex(0)
    setProgressStartedAt(Date.now())
    setElapsedSeconds(0)
  }

  const finishProgress = () => {
    setProgressFlow(undefined)
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
    const style = narrationMode === 'visual' ? 'accessible' : props.config?.style ?? 'technical'
    let visual: { enabled: true, imageDataUrl: string, width: number, height: number } | undefined
    setLoading(true)
    setError(undefined)
    startProgress(narrationMode === 'visual' ? 'visual' : 'metadata')
    try {
      visual = narrationMode === 'visual'
        ? (setOperationStatus('progressCapture'), await captureVisualMap(mapView.view))
        : undefined
      setProgressIndex(narrationMode === 'visual' ? 1 : 0)
      setOperationStatus(visual ? 'progressAnalyzeVisual' : 'progressAnalyzeMetadata')
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
        const message = getLocalizedApiError(payload?.error?.code, messages, 'description')
        setDiagnostics(entries => [...entries, createDiagnosticEntry({ mode: narrationMode, apiUrl, context, visual, locale, style, status: response.status, response: { error: payload?.error, diagnostic: payload?.diagnostic }, durationMs: Date.now() - startedAt })].slice(-20))
        setError(message)
        return
      }
      setDiagnostics(entries => [...entries, createDiagnosticEntry({ mode: narrationMode, apiUrl, context, visual, locale, style, status: response.status, response: { description: payload.description, diagnostic: payload.diagnostic }, durationMs: Date.now() - startedAt })].slice(-20))
      setDescription(payload.description)
    } catch (caught) {
      const diagnosticMessage = caught instanceof Error ? caught.message : messages.descriptionRequestFailed
      setDiagnostics(entries => [...entries, createDiagnosticEntry({ mode: narrationMode, apiUrl, context, visual, locale, style, error: diagnosticMessage, durationMs: Date.now() - startedAt })].slice(-20))
      setError(messages.descriptionRequestFailed)
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
    startProgress('speech')
    try {
      const text = buildSpeechSummary(description, messages)
      setProgressIndex(1)
      const response = await fetch(speechApiUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text, locale })
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => undefined)
        setError(getLocalizedApiError(payload?.error?.code, messages, 'speech'))
        return
      }
      setProgressIndex(2)
      const audioUrl = URL.createObjectURL(await response.blob())
      setSpeechAudioUrl(previous => {
        if (previous) URL.revokeObjectURL(previous)
        return audioUrl
      })
    } catch {
      setError(messages.speechRequestFailed)
    } finally {
      setSpeechLoading(false)
      finishProgress()
    }
  }

  const disabledMessage = !mapWidgetId
    ? messages.statusSelectMap
    : !apiUrl
      ? messages.statusConfigureApi
      : !mapView?.view
        ? messages.statusWaitingMap
        : undefined

  return (
    <div lang={locale} className='widget-map-narrator jimu-widget h-100 p-3 d-flex flex-column overflow-hidden'>
      {speechAudioUrl && <audio ref={speechAudioRef} lang={locale} className='d-block mb-2 w-100' controls src={speechAudioUrl} aria-label={messages.speechAudioLabel} />}
      <div className='d-flex align-items-start justify-content-between'>
        <Typography component='h3' variant='h5' className='mb-0'>{messages.widgetTitle}</Typography>
        <Typography component='span' variant='label3' color='backgroundHint' style={{ marginInlineStart: theme.sys.spacing(3) }} aria-label={messages.widgetVersionLabel}>{WIDGET_VERSION} · {locale.toUpperCase()}</Typography>
      </div>
      <Typography component='p' color='backgroundHint'>{messages.widgetIntroduction}</Typography>
      <Button type='primary' onClick={onDescribe} disabled={Boolean(disabledMessage) || loading || speechLoading} aria-describedby='map-narrator-status' aria-busy={loading || speechLoading}>
        {loading && <span css={spinnerStyle} aria-hidden='true' />}
        {loading ? (operationStatus ? messages[operationStatus] : messages.analyzingMap) : narrationMode === 'visual' ? messages.describeVisual : messages.describeMetadata}
      </Button>
      <Button className='mt-2 align-self-start' type='tertiary' disabled={diagnostics.length === 0} onClick={() => {
        if (!openDiagnosticWindow(diagnostics, messages, locale)) setError(messages.diagnosticsBlocked)
      }}>
        {messages.diagnosticsOpen.replace('{count}', String(diagnostics.length))}
      </Button>
      {narrationMode === 'visual' && <Typography component='p' color='backgroundHint' className='mt-2 mb-0'>{messages.privacyNote}</Typography>}
      <div id='map-narrator-status' className='mt-3' role='status' aria-live='polite' aria-busy={loading}>
        {disabledMessage ?? (operationStatus ? messages[operationStatus] : '')}
      </div>
      {error && (
        <Alert
          className='mt-3'
          type='error'
          text={error}
          withIcon
          fullWidth
          role='alert'
        />
      )}
      {description && (
        <section className='mt-3' style={narrationContentStyle} aria-label={messages.descriptionLabel}>
          <Typography component='h4' variant='h6'>{description.title}</Typography>
          <Typography component='p'>{description.description}</Typography>
          {description.spatialLayout && description.spatialLayout.length > 0 && <><Typography component='h4' variant='h6'>{messages.spatialLayout}</Typography><ul>{description.spatialLayout.map((item, index) => <li key={`layout-${index}`}>{item}</li>)}</ul></>}
          {description.visualElements && description.visualElements.length > 0 && <><Typography component='h4' variant='h6'>{messages.visualElements}</Typography><ul>{description.visualElements.map((item, index) => <li key={`visual-${index}`}>{item}</li>)}</ul></>}
          {description.legendAndSymbols && description.legendAndSymbols.length > 0 && <><Typography component='h4' variant='h6'>{messages.legendAndSymbols}</Typography><ul>{description.legendAndSymbols.map((item, index) => <li key={`legend-${index}`}>{item}</li>)}</ul></>}
          {description.visibleLabels && description.visibleLabels.length > 0 && <><Typography component='h4' variant='h6'>{messages.visibleLabels}</Typography><ul>{description.visibleLabels.map((item, index) => <li key={`label-${index}`}>{item}</li>)}</ul></>}
          {description.highlightedLayers.length > 0 && <Typography component='p'><strong>{messages.highlightedLayers}:</strong> {description.highlightedLayers.join(', ')}</Typography>}
          {description.observedPatterns.length > 0 && <Typography component='p'><strong>{messages.patterns}:</strong> {description.observedPatterns.join(' ')}</Typography>}
          <Typography component='p'><strong>{messages.limitations}:</strong> {description.limitations.join(' ')}</Typography>
          <Button className='mt-2' type='secondary' onClick={onReadDescription} disabled={speechLoading || !speechApiUrl}>
            {speechLoading ? messages.speechGenerating : messages.speechRead}
          </Button>
          <div className='mt-2'>
            {!speechAudioUrl && <Typography component='div' variant='label3' color='backgroundHint'>{messages.speechHint}</Typography>}
          </div>
        </section>
      )}
      <ProgressTracker steps={progressSteps} currentIndex={progressIndex} elapsedSeconds={elapsedSeconds} messages={messages} />
      {mapWidgetId && <JimuMapViewComponent useMapWidgetId={mapWidgetId} onActiveViewChange={setMapView} />}
    </div>
  )
}
