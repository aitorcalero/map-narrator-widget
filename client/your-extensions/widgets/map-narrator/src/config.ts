export interface Config {
  apiUrl?: string
  style?: 'technical' | 'citizen' | 'accessible'
  visualMode?: boolean
  customPrompt?: string
}

export function resolveNarrationMode (config: Config | undefined): 'metadata' | 'visual' {
  return config?.visualMode === true ? 'visual' : 'metadata'
}

export function resolveApiUrl (config: Config | undefined): string | undefined {
  if (!config?.apiUrl) return undefined
  try {
    const url = new URL(config.apiUrl)
    const isLoopback = url.hostname === '127.0.0.1' || url.hostname === 'localhost' || url.hostname === '[::1]'
    return url.protocol === 'https:' || (url.protocol === 'http:' && isLoopback) ? url.toString() : undefined
  } catch {
    return undefined
  }
}
