import { focusAudioAfterGeneration } from '../src/runtime/audio-focus'

describe('focusAudioAfterGeneration', () => {
  it('focuses and plays the audio player after a successful generation', () => {
    const focus = jest.fn()
    const play = jest.fn().mockResolvedValue(undefined)

    focusAudioAfterGeneration({ focus, play }, 'blob:audio')

    expect(focus).toHaveBeenCalledTimes(1)
    expect(play).toHaveBeenCalledTimes(1)
  })

  it('does not interact with the player when generation did not produce audio', () => {
    const focus = jest.fn()
    const play = jest.fn().mockResolvedValue(undefined)

    focusAudioAfterGeneration({ focus, play }, undefined)

    expect(focus).not.toHaveBeenCalled()
    expect(play).not.toHaveBeenCalled()
  })
})
