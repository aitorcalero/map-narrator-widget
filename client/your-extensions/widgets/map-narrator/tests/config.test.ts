import { resolveApiUrl } from '../src/config'

describe('resolveApiUrl', () => {
  it('uses the configured HTTPS endpoint and otherwise disables requests', () => {
    expect(resolveApiUrl({ apiUrl: 'https://narrator.example.com/api/map-description' })).toBe('https://narrator.example.com/api/map-description')
    expect(resolveApiUrl({})).toBeUndefined()
  })

  it('rejects insecure or invalid endpoints', () => {
    expect(resolveApiUrl({ apiUrl: 'http://narrator.example.com/api/map-description' })).toBeUndefined()
    expect(resolveApiUrl({ apiUrl: 'not a URL' })).toBeUndefined()
  })
})
