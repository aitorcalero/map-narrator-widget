export interface DiagnosticEntryInput {
  mode: 'metadata' | 'visual'
  apiUrl: string
  context: unknown
  visual?: { enabled: true, imageDataUrl: string, width: number, height: number }
  locale: string
  style: string
  status?: number
  response?: unknown
  error?: string
  durationMs: number
}

export function createDiagnosticEntry (input: DiagnosticEntryInput) {
  const endpoint = new URL(input.apiUrl)
  return {
    timestamp: new Date().toISOString(),
    mode: input.mode,
    endpoint: `${endpoint.protocol}//${endpoint.host}${endpoint.pathname}`,
    request: { context: input.context, locale: input.locale, style: input.style },
    visual: input.visual ? { sent: true, width: input.visual.width, height: input.visual.height } : { sent: false },
    status: input.status,
    response: input.response,
    error: input.error,
    durationMs: input.durationMs
  }
}

export function openDiagnosticWindow (entries: unknown[]): boolean {
  const popup = window.open('', 'map-narrator-diagnostics', 'popup=yes,width=900,height=700,resizable=yes,scrollbars=yes')
  if (!popup) return false
  popup.document.title = 'Map Narrator — Registro de diagnóstico'
  popup.document.body.replaceChildren()
  const heading = popup.document.createElement('h1')
  heading.textContent = 'Registro de diagnóstico local'
  const notice = popup.document.createElement('p')
  notice.textContent = 'No incluye claves de API ni bytes de capturas. Copia solo la información necesaria para diagnosticar un fallo.'
  const output = popup.document.createElement('pre')
  output.textContent = JSON.stringify(entries, null, 2)
  popup.document.body.append(heading, notice, output)
  return true
}
