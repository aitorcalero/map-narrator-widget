import { focusAudioAfterGeneration } from '../src/runtime/audio-focus'

describe('focusAudioAfterGeneration', () => {
  it('focuses the audio player after a successful generation', () => {
    const focus = jest.fn()

    focusAudioAfterGeneration({ focus }, 'blob:audio')

    expect(focus).toHaveBeenCalledTimes(1)
  })

  it('does not focus the player when generation did not produce audio', () => {
    const focus = jest.fn()

    focusAudioAfterGeneration({ focus }, undefined)

    expect(focus).not.toHaveBeenCalled()
  })
})
