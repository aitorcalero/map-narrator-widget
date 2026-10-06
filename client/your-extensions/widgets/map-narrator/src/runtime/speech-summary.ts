import type { LocaleMessages } from '../locale'

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

export function buildSpeechSummary (description: SpeechDescription, messages: LocaleMessages): string {
  const visualParts = [
    description.title,
    labelled(messages.spatialLayout, nonEmpty(description.spatialLayout)),
    labelled(messages.visualElements, nonEmpty(description.visualElements)),
    labelled(messages.visibleLabels, nonEmpty(description.visibleLabels)),
    labelled(messages.legendAndSymbols, nonEmpty(description.legendAndSymbols)),
    labelled(messages.patterns, nonEmpty(description.observedPatterns)),
    labelled(messages.highlightedLayers, nonEmpty(description.highlightedLayers))
  ].filter(Boolean)

  const summary = [
    description.title,
    description.description,
    ...visualParts.slice(1)
  ].filter(Boolean).join('\n\n')
  return summary.length <= MAX_SPEECH_SUMMARY_LENGTH
    ? summary
    : `${summary.slice(0, MAX_SPEECH_SUMMARY_LENGTH - 1).trimEnd()}…`
}
