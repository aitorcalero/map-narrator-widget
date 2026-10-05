export interface ProgressStep {
  key: string
  label: string
}

/** Pasos reales del flujo de descripción en modo visual: captura de pantalla, envío a la API y procesamiento de la respuesta. */
export const visualDescribeSteps: ProgressStep[] = [
  { key: 'capture', label: 'Capturando la vista actual del mapa…' },
  { key: 'send', label: 'Analizando visualmente el mapa…' },
  { key: 'process', label: 'Procesando la respuesta de la API…' }
]

/** Pasos reales del flujo de descripción en modo metadatos: no hay captura, se envía directamente y se procesa la respuesta. */
export const metadataDescribeSteps: ProgressStep[] = [
  { key: 'send', label: 'Analizando la configuración visible del mapa…' },
  { key: 'process', label: 'Procesando la respuesta de la API…' }
]

/** Pasos reales del flujo de generación de audio: preparar el resumen, sintetizar con ElevenLabs y descargar el resultado. */
export const speechSteps: ProgressStep[] = [
  { key: 'prepare', label: 'Preparando el resumen de audio…' },
  { key: 'send', label: 'Sintetizando audio con ElevenLabs…' },
  { key: 'download', label: 'Descargando el audio generado…' }
]
