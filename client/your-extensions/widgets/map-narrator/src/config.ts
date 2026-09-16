export interface Config {
  apiUrl?: string
  style?: 'technical' | 'citizen'
}

export function resolveApiUrl (config: Config | undefined): string | undefined {
  if (!config?.apiUrl) return undefined
  try {
    const url = new URL(config.apiUrl)
    return url.protocol === 'https:' ? url.toString() : undefined
  } catch {
    return undefined
  }
}
