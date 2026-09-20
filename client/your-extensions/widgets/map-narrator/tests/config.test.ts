import { resolveApiUrl, resolveNarrationMode } from '../src/config'

describe('resolveNarrationMode', () => {
  it('uses metadata mode by default and requires explicit visual opt-in', () => {
    expect(resolveNarrationMode({})).toBe('metadata')
    expect(resolveNarrationMode({ visualMode: true })).toBe('visual')
  })
})

describe('resolveApiUrl', () => {
  it('uses the configured HTTPS endpoint and otherwise disables requests', () => {
    expect(resolveApiUrl({ apiUrl: 'https://narrator.example.com/api/map-description' })).toBe('https://narrator.example.com/api/map-description')
    expect(resolveApiUrl({})).toBeUndefined()
  })

  it('permits a loopback HTTP endpoint for local development only', () => {
    expect(resolveApiUrl({ apiUrl: 'http://127.0.0.1:8787/api/map-description' })).toBe('http://127.0.0.1:8787/api/map-description')
    expect(resolveApiUrl({ apiUrl: 'http://localhost:8787/api/map-description' })).toBe('http://localhost:8787/api/map-description')
  })

  it('rejects insecure or invalid endpoints', () => {
    expect(resolveApiUrl({ apiUrl: 'http://narrator.example.com/api/map-description' })).toBeUndefined()
    expect(resolveApiUrl({ apiUrl: 'not a URL' })).toBeUndefined()
  })
})
