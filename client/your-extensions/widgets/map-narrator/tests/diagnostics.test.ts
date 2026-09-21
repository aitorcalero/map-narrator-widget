import { createDiagnosticEntry } from '../src/runtime/diagnostics'

describe('createDiagnosticEntry', () => {
  it('records request and response metadata without screenshot bytes or secrets', () => {
    const entry = createDiagnosticEntry({
      mode: 'visual',
      apiUrl: 'http://127.0.0.1:8787/api/map-description',
      context: { title: 'Mapa de prueba', extent: { xmin: 0, ymin: 0, xmax: 1, ymax: 1 }, layers: [] },
      visual: { enabled: true, imageDataUrl: 'data:image/png;base64,secret-image-bytes', width: 1280, height: 720 },
      locale: 'es',
      style: 'accessible',
      status: 502,
      response: { error: { code: 'UPSTREAM_ERROR', message: 'Description service unavailable' } },
      durationMs: 321
    })

    expect(entry).toMatchObject({ mode: 'visual', status: 502, durationMs: 321, request: { locale: 'es', style: 'accessible' }, visual: { sent: true, width: 1280, height: 720 } })
    expect(JSON.stringify(entry)).not.toContain('secret-image-bytes')
    expect(JSON.stringify(entry)).not.toContain('OPENAI_API_KEY')
  })
})
