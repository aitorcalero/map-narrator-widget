import type { LocaleMessages } from '../locale'

export interface ProgressStep {
  key: string
  label: string
}

export function getVisualDescribeSteps (messages: LocaleMessages): ProgressStep[] {
  return [
    { key: 'capture', label: messages.progressCapture },
    { key: 'send', label: messages.progressAnalyzeVisual },
    { key: 'process', label: messages.progressProcessResponse }
  ]
}

export function getMetadataDescribeSteps (messages: LocaleMessages): ProgressStep[] {
  return [
    { key: 'send', label: messages.progressAnalyzeMetadata },
    { key: 'process', label: messages.progressProcessResponse }
  ]
}

export function getSpeechSteps (messages: LocaleMessages): ProgressStep[] {
  return [
    { key: 'prepare', label: messages.progressPrepareSpeech },
    { key: 'send', label: messages.progressSynthesizeSpeech },
    { key: 'download', label: messages.progressDownloadSpeech }
  ]
}
