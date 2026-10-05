import { metadataDescribeSteps, speechSteps, visualDescribeSteps } from '../src/runtime/progress-steps'

describe('progress-steps', () => {
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
})
