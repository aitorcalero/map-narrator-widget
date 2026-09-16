import { React, hooks, type ImmutableObject } from 'jimu-core'
import { Select, TextInput } from 'jimu-ui'
import { MapWidgetSelector, SettingRow, SettingSection } from 'jimu-ui/advanced/setting-components'
import type { AllWidgetSettingProps } from 'jimu-for-builder'
import type { Config } from '../config'
import messages from './translations/default'

export default function Setting (props: AllWidgetSettingProps<ImmutableObject<Config>>) {
  const translate = hooks.useTranslation(messages)
  const updateConfig = (key: keyof Config, value: string) => props.onSettingChange({ id: props.id, config: props.config.set(key, value) })

  return (
    <SettingSection title={translate('settingsTitle')}>
      <SettingRow label={translate('mapLabel')}>
        <MapWidgetSelector useMapWidgetIds={props.useMapWidgetIds} onSelect={(useMapWidgetIds) => props.onSettingChange({ id: props.id, useMapWidgetIds })} />
      </SettingRow>
      <SettingRow label={translate('apiUrlLabel')}>
        <TextInput aria-label={translate('apiUrlLabel')} placeholder='https://api.example.com/api/map-description' value={props.config.apiUrl ?? ''} onChange={(event) => updateConfig('apiUrl', event.target.value)} />
      </SettingRow>
      <SettingRow label={translate('styleLabel')}>
        <Select aria-label={translate('styleLabel')} value={props.config.style ?? 'technical'} onChange={(event) => updateConfig('style', event.target.value)}>
          <option value='technical'>{translate('technical')}</option>
          <option value='citizen'>{translate('citizen')}</option>
        </Select>
      </SettingRow>
    </SettingSection>
  )
}
