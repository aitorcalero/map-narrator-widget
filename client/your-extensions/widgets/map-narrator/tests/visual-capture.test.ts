import { captureVisualMap } from '../src/runtime/visual-capture'

describe('captureVisualMap', () => {
  it('captures a bounded JPEG screenshot from the current map view', async () => {
    const takeScreenshot = jest.fn().mockResolvedValue({ dataUrl: 'data:image/jpeg;base64,/9j/4AAQ' })
    const result = await captureVisualMap({ width: 2560, height: 1440, when: jest.fn().mockResolvedValue(undefined), takeScreenshot } as any)

    expect(takeScreenshot).toHaveBeenCalledWith({ format: 'jpg', quality: 75, width: 1280, height: 720 })
    expect(result).toEqual({ enabled: true, imageDataUrl: 'data:image/jpeg;base64,/9j/4AAQ', width: 1280, height: 720 })
  })

  it('rejects an unavailable view or a non-JPEG result', async () => {
    await expect(captureVisualMap(undefined as any)).rejects.toThrow('Map view is not ready')
    await expect(captureVisualMap({ width: 1, height: 1, when: jest.fn().mockResolvedValue(undefined), takeScreenshot: jest.fn().mockResolvedValue({ dataUrl: 'data:image/png;base64,AA==' }) } as any)).rejects.toThrow('JPEG')
  })
})
