const MAX_CAPTURE_DIMENSION = 1280
const PNG_PREFIX = 'data:image/png;base64,'

export interface VisualCapture {
  enabled: true
  imageDataUrl: string
  width: number
  height: number
}

export async function captureVisualMap (view: any): Promise<VisualCapture> {
  if (!view?.when || !view?.takeScreenshot || !Number.isFinite(view.width) || !Number.isFinite(view.height)) {
    throw new Error('Map view is not ready')
  }
  await view.when()
  const scale = Math.min(1, MAX_CAPTURE_DIMENSION / Math.max(view.width, view.height))
  const width = Math.max(1, Math.round(view.width * scale))
  const height = Math.max(1, Math.round(view.height * scale))
  const screenshot = await view.takeScreenshot({ format: 'png', width, height })
  if (typeof screenshot?.dataUrl !== 'string' || !screenshot.dataUrl.startsWith(PNG_PREFIX)) {
    throw new Error('Map screenshot is not PNG')
  }
  return { enabled: true, imageDataUrl: screenshot.dataUrl, width, height }
}
