import { React } from 'jimu-core'
import { stickyProgressStyle } from './layout'
import type { ProgressStep } from './progress-steps'

export interface ProgressTrackerProps {
  steps: ProgressStep[]
  currentIndex: number
  elapsedSeconds: number
}

/**
 * Barra de progreso fija en la parte inferior del widget. Muestra los pasos reales
 * del proceso en curso (captura, envío, procesamiento / preparación, síntesis, descarga)
 * junto con un contador de segundos transcurridos para que el usuario sepa que el
 * widget sigue trabajando y no se ha quedado colgado.
 */
export function ProgressTracker (props: ProgressTrackerProps) {
  const { steps, currentIndex, elapsedSeconds } = props
  if (currentIndex < 0 || steps.length === 0) return null
  const currentStep = steps[currentIndex]

  return (
    <div
      className='map-narrator-progress-tracker'
      style={stickyProgressStyle}
      role='status'
      aria-live='polite'
      aria-busy='true'
    >
      <div className='d-flex gap-1 mb-2' aria-hidden='true'>
        {steps.map((step, index) => (
          <div
            key={step.key}
            className={
              'flex-fill rounded' +
              (index < currentIndex
                ? ' bg-primary'
                : index === currentIndex
                  ? ' bg-primary progress-bar-striped progress-bar-animated'
                  : ' bg-secondary bg-opacity-25')
            }
            style={{ height: '6px' }}
          />
        ))}
      </div>
      <div className='d-flex justify-content-between align-items-center small'>
        <span>
          <span className='spinner-border spinner-border-sm me-2' aria-hidden='true' />
          {currentStep?.label}
        </span>
        <span className='text-muted' aria-label={`Tiempo transcurrido: ${elapsedSeconds} segundos`}>
          {elapsedSeconds}s
        </span>
      </div>
    </div>
  )
}
