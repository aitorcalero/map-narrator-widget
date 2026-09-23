import { buildSpeechSummary, type SpeechDescription } from '../src/runtime/speech-summary'

const description: SpeechDescription = {
  title: 'Movilidad urbana',
  description: 'Descripción completa con detalles técnicos y limitaciones.',
  spatialLayout: ['Los carriles se concentran al norte.'],
  visualElements: ['Se observan líneas azules.'],
  visibleLabels: ['Centro.'],
  legendAndSymbols: ['La línea azul representa carriles bici.'],
  highlightedLayers: ['Carriles bici'],
  observedPatterns: ['La red conecta el centro con el norte.'],
  limitations: ['No se analizaron entidades individuales.']
}

describe('buildSpeechSummary', () => {
  it('prioritizes visual content and excludes limitations from speech', () => {
    const summary = buildSpeechSummary(description)

    expect(summary).toContain('Distribución espacial')
    expect(summary).toContain('Elementos visuales')
    expect(summary).toContain('La red conecta el centro con el norte.')
    expect(summary).not.toContain('Descripción completa')
    expect(summary).not.toContain('No se analizaron entidades individuales.')
    const fullDescription = [
      description.title,
      description.description,
      ...(description.spatialLayout ?? []),
      ...(description.visualElements ?? []),
      ...(description.visibleLabels ?? []),
      ...(description.legendAndSymbols ?? []),
      ...description.highlightedLayers,
      ...description.observedPatterns,
      ...description.limitations
    ].join('\n\n')
    expect(summary.length).toBeLessThan(fullDescription.length)
  })

  it('falls back to the full description when optional visual fields are empty', () => {
    const summary = buildSpeechSummary({
      ...description,
      spatialLayout: [],
      visualElements: [],
      visibleLabels: [],
      legendAndSymbols: [],
      observedPatterns: [],
      highlightedLayers: []
    })

    expect(summary).toContain(description.description)
    expect(summary).not.toContain('No se analizaron entidades individuales.')
  })

  it('bounds unusually long speech summaries', () => {
    const summary = buildSpeechSummary({
      ...description,
      spatialLayout: ['x'.repeat(3000)]
    })

    expect(summary.length).toBe(2400)
    expect(summary.endsWith('…')).toBe(true)
  })
})
