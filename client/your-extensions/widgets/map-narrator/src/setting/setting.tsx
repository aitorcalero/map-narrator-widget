import { React, type ImmutableObject } from 'jimu-core'
import { Select, Switch, TextArea, TextInput } from 'jimu-ui'
import { MapWidgetSelector, SettingRow, SettingSection } from 'jimu-ui/advanced/setting-components'
import type { AllWidgetSettingProps } from 'jimu-for-builder'
import type { Config } from '../config'
import { getLocaleMessages, useBrowserLocale } from '../locale'

export default function Setting (props: AllWidgetSettingProps<ImmutableObject<Config>>) {
  const locale = useBrowserLocale()
  const messages = getLocaleMessages(locale)
  const updateConfig = (key: keyof Config, value: string) => props.onSettingChange({ id: props.id, config: props.config.set(key, value) })

  return (
    <SettingSection title={messages.settingsTitle}>
      <SettingRow label={messages.mapLabel} flow='wrap'>
        <MapWidgetSelector useMapWidgetIds={props.useMapWidgetIds} onSelect={(useMapWidgetIds) => props.onSettingChange({ id: props.id, useMapWidgetIds })} />
      </SettingRow>
      <SettingRow label={messages.apiUrlLabel} flow='wrap'>
        <TextInput aria-label={messages.apiUrlLabel} placeholder='https://api.example.com/api/map-description' value={props.config.apiUrl ?? ''} onChange={(event) => updateConfig('apiUrl', event.target.value)} />
      </SettingRow>
      <SettingRow label={messages.visualModeLabel} flow='wrap'>
        <div>
          <Switch checked={props.config.visualMode === true} onChange={(event) => props.onSettingChange({ id: props.id, config: props.config.set('visualMode', event.target.checked) })} />
          <p className='mt-2 mb-0' style={{ color: '#fff', fontSize: '0.75rem' }}>{messages.visualModeHelp}</p>
        </div>
      </SettingRow>
      <SettingRow label={messages.customPromptLabel} flow='wrap'>
        <div>
          <TextArea
            aria-label={messages.customPromptLabel}
            placeholder={messages.customPromptPlaceholder}
            maxLength={500}
            value={props.config.customPrompt ?? ''}
            onChange={(event) => updateConfig('customPrompt', event.target.value)}
          />
          <p className='mt-2 mb-0' style={{ color: '#fff', fontSize: '0.75rem' }}>{messages.customPromptHelp}</p>
        </div>
      </SettingRow>
      <SettingRow label={messages.styleLabel} flow='wrap'>
        <Select aria-label={messages.styleLabel} value={props.config.style ?? 'technical'} onChange={(event) => updateConfig('style', event.target.value)}>
          <option value='technical'>{messages.technical}</option>
          <option value='citizen'>{messages.citizen}</option>
        </Select>
      </SettingRow>
    </SettingSection>
  )
}
