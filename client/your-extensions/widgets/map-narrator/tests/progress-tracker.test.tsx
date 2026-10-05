import { React } from 'jimu-core'
import { render, screen } from '@testing-library/react'
import { getLocaleMessages } from '../src/locale'
import { ProgressTracker } from '../src/runtime/progress-tracker'
import { getMetadataDescribeSteps, getSpeechSteps, getVisualDescribeSteps } from '../src/runtime/progress-steps'

describe('ProgressTracker', () => {
  const messages = getLocaleMessages('es')
  const metadataDescribeSteps = getMetadataDescribeSteps(messages)
  const speechSteps = getSpeechSteps(messages)
  const visualDescribeSteps = getVisualDescribeSteps(messages)

  it('no renderiza nada cuando no hay operación en curso', () => {
    const { container } = render(
      <ProgressTracker steps={[]} currentIndex={-1} elapsedSeconds={0} messages={messages} />
    )

    expect(container.firstChild).toBeNull()
    expect(container.innerHTML).toBe('')
  })

  it('no renderiza nada si hay pasos pero el índice sigue inactivo', () => {
    const { container } = render(
      <ProgressTracker steps={metadataDescribeSteps} currentIndex={-1} elapsedSeconds={0} messages={messages} />
    )

    expect(container.firstChild).toBeNull()
    expect(container.innerHTML).toBe('')
  })

  it('muestra la etiqueta del paso actual y el contador de segundos', () => {
    render(
      <ProgressTracker
        steps={metadataDescribeSteps}
        currentIndex={1}
        elapsedSeconds={7}
        messages={messages}
      />
    )

    expect(screen.getByText(metadataDescribeSteps[1].label)).toBeTruthy()
    expect(screen.getByText('7s')).toBeTruthy()
  })

  it('anuncia el tiempo transcurrido con una etiqueta accesible', () => {
    render(
      <ProgressTracker steps={speechSteps} currentIndex={0} elapsedSeconds={12} messages={messages} />
    )

    expect(screen.getByLabelText('Tiempo transcurrido: 12 segundos')).toBeTruthy()
  })

  it('expone el estado como región viva para lectores de pantalla', () => {
    render(
      <ProgressTracker steps={visualDescribeSteps} currentIndex={0} elapsedSeconds={1} messages={messages} />
    )

    const status = screen.getByRole('status')
    expect(status.getAttribute('aria-live')).toBe('polite')
    expect(status.getAttribute('aria-busy')).toBe('true')
  })

  it('dibuja un segmento por paso, tantos como tenga la lista', () => {
    render(
      <ProgressTracker steps={visualDescribeSteps} currentIndex={0} elapsedSeconds={1} messages={messages} />
    )

    const track = screen.getByRole('progressbar', { name: 'Progreso de la solicitud' })
    expect(track).toBeTruthy()
    expect(track.children).toHaveLength(visualDescribeSteps.length)
    expect(track.getAttribute('aria-valuetext')).toBe(visualDescribeSteps[0].label)
  })

  it('aplica estilos propios a cada segmento en lugar de depender de clases inexistentes', () => {
    const { container } = render(
      <ProgressTracker steps={metadataDescribeSteps} currentIndex={1} elapsedSeconds={3} messages={messages} />
    )

    const track = container.querySelector('[role="progressbar"]')
    const segments = Array.from(track?.children ?? [])

    // Regresión: antes dependían de `gap-1`, `bg-opacity-25`,
    // `progress-bar-striped` y `progress-bar-animated`, que no existen en EXB.
    for (const segment of segments) {
      expect(segment.className).not.toContain('gap-1')
      expect(segment.className).not.toContain('bg-opacity-25')
      expect(segment.className).not.toContain('progress-bar')
      // Cada segmento recibe una clase generada por Emotion.
      expect(segment.className).toMatch(/css-/)
    }
  })

  it('el indicador de actividad se renderiza con estilos propios y es decorativo', () => {
    const { container } = render(
      <ProgressTracker steps={metadataDescribeSteps} currentIndex={0} elapsedSeconds={2} messages={messages} />
    )

    // Regresión: `spinner-border` no existe en EXB y dejaba un span vacío.
    const spinner = container.querySelector('span[aria-hidden="true"]')
    expect(spinner).toBeTruthy()
    expect(spinner?.className).not.toContain('spinner-border')
    expect(spinner?.className).toMatch(/css-/)
  })

  it('mantiene la clase de identificación y el estilo base del panel', () => {
    const { container } = render(
      <ProgressTracker steps={metadataDescribeSteps} currentIndex={0} elapsedSeconds={2} messages={messages} />
    )

    const panel = container.querySelector('.map-narrator-progress-tracker') as HTMLElement
    expect(panel).toBeTruthy()
    expect(panel.style.marginTop).toBe('auto')
    expect(panel.style.borderTop).toContain('var(--sys-color-divider-secondary')
  })

  it('usa la variante tipográfica del tema en lugar de la clase small', () => {
    const { container } = render(
      <ProgressTracker steps={metadataDescribeSteps} currentIndex={0} elapsedSeconds={2} messages={messages} />
    )

    // Regresión: `small` como clase no existe; solo el selector de elemento `<small>`.
    const row = container.querySelector('.jimu-typography')
    expect(row).toBeTruthy()
    expect(row?.className).not.toMatch(/\bsmall\b/)
  })
})
