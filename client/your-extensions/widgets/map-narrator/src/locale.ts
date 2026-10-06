import { React } from 'jimu-core'
import englishMessages from './setting/translations/default'
import spanishMessages from './setting/translations/es'

export type Locale = 'en' | 'es'
export type LocaleMessages = { [Key in keyof typeof englishMessages]: string }

export function resolveBrowserLocale (languages?: readonly string[]): Locale {
  const preferredLanguages = languages ?? (
    typeof navigator === 'undefined'
      ? []
      : [...(navigator.languages ?? []), navigator.language]
  )

  for (const language of preferredLanguages) {
    const baseLanguage = language?.trim().toLowerCase().split(/[-_]/, 1)[0]
    if (baseLanguage === 'es' || baseLanguage === 'en') return baseLanguage
  }

  return 'en'
}

export function getLocaleMessages (locale: Locale): LocaleMessages {
  return locale === 'es' ? spanishMessages : englishMessages
}

export function useBrowserLocale (): Locale {
  const [locale, setLocale] = React.useState<Locale>(() => resolveBrowserLocale())

  React.useEffect(() => {
    const updateLocale = () => setLocale(resolveBrowserLocale())
    window.addEventListener('languagechange', updateLocale)
    return () => window.removeEventListener('languagechange', updateLocale)
  }, [])

  return locale
}

export function getLocalizedApiError (
  code: unknown,
  messages: LocaleMessages,
  operation: 'description' | 'speech'
): string {
  switch (code) {
    case 'RATE_LIMITED':
      return messages.apiRateLimited
    case 'ORIGIN_FORBIDDEN':
      return messages.apiOriginForbidden
    case 'ELEVENLABS_NOT_CONFIGURED':
      return messages.apiSpeechNotConfigured
    case 'ELEVENLABS_QUOTA_EXCEEDED':
      return messages.apiSpeechQuotaExceeded
    case 'ELEVENLABS_TIMEOUT':
      return messages.apiSpeechTimeout
    case 'ELEVENLABS_NETWORK_ERROR':
      return messages.apiSpeechUnavailable
    case 'INVALID_REQUEST':
    case 'INVALID_SPEECH_REQUEST':
    case 'PAYLOAD_TOO_LARGE':
      return messages.apiInvalidRequest
  }

  if (operation === 'description' && (code === 'UPSTREAM_ERROR' || (typeof code === 'string' && code.startsWith('OPENAI_')))) {
    return messages.apiDescriptionUnavailable
  }

  return operation === 'description' ? messages.descriptionRequestFailed : messages.speechRequestFailed
}
