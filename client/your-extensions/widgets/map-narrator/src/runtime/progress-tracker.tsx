import { React } from 'jimu-core'
import { css } from 'jimu-core/emotion'
import { useTheme } from 'jimu-theme'
import { Typography } from 'jimu-ui'
import { stickyProgressStyle } from './layout'
import {
  inlineSpinnerStyle,
  progressSegmentActiveStyle,
  progressSegmentDoneStyle,
  progressSegmentPendingStyle
} from './styles'
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
 *
 * Los segmentos se estilan con tokens del tema activo en lugar de clases de utilidad:
 * `gap-1`, `bg-opacity-25`, `progress-bar-striped` y `progress-bar-animated` no forman
 * parte del CSS que inyecta Experience Builder, así que no tenían efecto.
 */
export function ProgressTracker (props: ProgressTrackerProps) {
  const { steps, currentIndex, elapsedSeconds } = props
  const theme = useTheme()

  const spinnerStyle = React.useMemo(() => inlineSpinnerStyle(theme), [theme])
  const trackStyle = React.useMemo(() => css`
    display: flex;
    gap: ${theme.sys.spacing(1)};
    margin-bottom: ${theme.sys.spacing(2)};
  `, [theme])
  const counterStyle = React.useMemo(() => css`
    color: ${theme.sys.color.surface.paperHint};
  `, [theme])

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
      <div css={trackStyle} aria-hidden='true'>
        {steps.map((step, index) => (
          <div
            key={step.key}
            css={
              index < currentIndex
                ? progressSegmentDoneStyle(theme)
                : index === currentIndex
                  ? progressSegmentActiveStyle(theme)
                  : progressSegmentPendingStyle(theme)
            }
          />
        ))}
      </div>
      {/*
        `small` como clase no existe en Experience Builder: solo hay selector de
        elemento `<small>`. Se usa la variante tipográfica `label3` del tema, que
        equivale a 12px, el mismo tamaño que se pretendía.
      */}
      <Typography
        component='div'
        variant='label3'
        className='d-flex justify-content-between align-items-center'
      >
        <span>
          <span css={spinnerStyle} aria-hidden='true' />
          {currentStep?.label}
        </span>
        <span css={counterStyle} aria-label={`Tiempo transcurrido: ${elapsedSeconds} segundos`}>
          {elapsedSeconds}s
        </span>
      </Typography>
    </div>
  )
}
