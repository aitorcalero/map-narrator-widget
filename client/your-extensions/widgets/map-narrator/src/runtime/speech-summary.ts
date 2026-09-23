export type SpeechDescription = {
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

const MAX_SPEECH_SUMMARY_LENGTH = 2400

function nonEmpty (items: string[] | undefined): string[] {
  return (items ?? []).filter(item => item.trim().length > 0)
}

function labelled (label: string, items: string[]): string {
  return items.length > 0 ? `${label}: ${items.join(' ')}` : ''
}

export function buildSpeechSummary (description: SpeechDescription): string {
  const visualParts = [
    description.title,
    labelled('Distribución espacial', nonEmpty(description.spatialLayout)),
    labelled('Elementos visuales', nonEmpty(description.visualElements)),
    labelled('Etiquetas visibles', nonEmpty(description.visibleLabels)),
    labelled('Leyenda y símbolos', nonEmpty(description.legendAndSymbols)),
    labelled('Patrones', nonEmpty(description.observedPatterns)),
    labelled('Capas destacadas', nonEmpty(description.highlightedLayers))
  ].filter(Boolean)

  const parts = visualParts.length > 1
    ? visualParts
    : [description.title, description.description, labelled('Patrones', nonEmpty(description.observedPatterns)), labelled('Capas destacadas', nonEmpty(description.highlightedLayers))].filter(Boolean)

  const summary = parts.join('\n\n')
  return summary.length <= MAX_SPEECH_SUMMARY_LENGTH
    ? summary
    : `${summary.slice(0, MAX_SPEECH_SUMMARY_LENGTH - 1).trimEnd()}…`
}
