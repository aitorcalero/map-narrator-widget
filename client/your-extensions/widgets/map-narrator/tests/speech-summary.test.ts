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
  it('includes the main narration and visual details while excluding limitations', () => {
    const summary = buildSpeechSummary(description)

    expect(summary).toContain('Descripción completa')
    expect(summary).toContain('Distribución espacial')
    expect(summary).toContain('Elementos visuales')
    expect(summary).toContain('La red conecta el centro con el norte.')
    expect(summary).not.toContain('No se analizaron entidades individuales.')
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
