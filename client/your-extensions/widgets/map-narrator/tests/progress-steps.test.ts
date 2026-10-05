import { getLocaleMessages } from '../src/locale'
import { getMetadataDescribeSteps, getSpeechSteps, getVisualDescribeSteps } from '../src/runtime/progress-steps'

describe('progress-steps', () => {
  const messages = getLocaleMessages('es')
  const visualDescribeSteps = getVisualDescribeSteps(messages)
  const metadataDescribeSteps = getMetadataDescribeSteps(messages)
  const speechSteps = getSpeechSteps(messages)

  it('defines a capture, send and process step for the visual describe flow', () => {
    expect(visualDescribeSteps.map(step => step.key)).toEqual(['capture', 'send', 'process'])
  })

  it('skips the capture step for the metadata describe flow', () => {
    expect(metadataDescribeSteps.map(step => step.key)).toEqual(['send', 'process'])
  })

  it('defines a prepare, send and download step for the speech flow', () => {
    expect(speechSteps.map(step => step.key)).toEqual(['prepare', 'send', 'download'])
  })

  it('gives every step a non-empty label', () => {
    for (const steps of [visualDescribeSteps, metadataDescribeSteps, speechSteps]) {
      for (const step of steps) {
        expect(step.label.length).toBeGreaterThan(0)
      }
    }
  })

  it('localizes every step for English', () => {
    const englishMessages = getLocaleMessages('en')
    expect(getVisualDescribeSteps(englishMessages)[0].label).toBe(englishMessages.progressCapture)
    expect(getMetadataDescribeSteps(englishMessages)[0].label).toBe(englishMessages.progressAnalyzeMetadata)
    expect(getSpeechSteps(englishMessages)[0].label).toBe(englishMessages.progressPrepareSpeech)
  })
})
