import {
  getLocaleMessages,
  getLocalizedApiError,
  resolveBrowserLocale
} from '../src/locale'

describe('browser locale', () => {
  it.each([
    [['es'], 'es'],
    [['es-ES'], 'es'],
    [['es_MX'], 'es'],
    [['en'], 'en'],
    [['en-US'], 'en'],
    [['fr-FR', 'es-ES'], 'es'],
    [['fr-FR', 'de-DE'], 'en']
  ] as const)('resolves %j to %s', (languages, expected) => {
    expect(resolveBrowserLocale(languages)).toBe(expected)
  })

  it('provides matching translation keys in both supported languages', () => {
    expect(Object.keys(getLocaleMessages('es')).sort()).toEqual(Object.keys(getLocaleMessages('en')).sort())
  })
})

describe('localized API errors', () => {
  it('translates known API errors into the selected language', () => {
    expect(getLocalizedApiError('ELEVENLABS_QUOTA_EXCEEDED', getLocaleMessages('es'), 'speech'))
      .toContain('créditos')
    expect(getLocalizedApiError('ELEVENLABS_QUOTA_EXCEEDED', getLocaleMessages('en'), 'speech'))
      .toContain('credits')
  })

  it('uses a localized fallback for unknown API errors', () => {
    expect(getLocalizedApiError('UNRECOGNIZED_ERROR', getLocaleMessages('en'), 'description'))
      .toBe(getLocaleMessages('en').descriptionRequestFailed)
  })
})
