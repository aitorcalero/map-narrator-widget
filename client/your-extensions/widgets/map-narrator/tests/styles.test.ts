import { mockTheme } from 'jimu-for-test'
import {
  inlineSpinnerStyle,
  progressSegmentActiveStyle,
  progressSegmentDoneStyle,
  progressSegmentPendingStyle
} from '../src/runtime/styles'

/**
 * Serializa el estilo de Emotion para poder inspeccionar el CSS generado.
 * `css` devuelve un objeto con la propiedad `styles`, que es el texto final.
 */
function serialize (style: unknown): string {
  const styles = (style as { styles?: string })?.styles
  if (typeof styles !== 'string') throw new Error('El estilo no expone CSS serializado')
  return styles
}

const theme = mockTheme as any

describe('inlineSpinnerStyle', () => {
  it('genera un indicador visible, no vacío, con animación real', () => {
    const css = serialize(inlineSpinnerStyle(theme))

    // Regresión: la clase `spinner-border` no existe en Experience Builder, así que
    // el indicador quedaba vacío. El estilo debe aportar tamaño y borde propios.
    expect(css).toContain('display: inline-block')
    expect(css).toContain('width: 1em')
    expect(css).toContain('height: 1em')
    expect(css).toContain('border:')
    expect(css).toContain('animation: map-narrator-spin')
    expect(css).toContain('@keyframes map-narrator-spin')
    expect(css).toContain('rotate(360deg)')
  })

  it('toma los colores del tema activo en lugar de valores fijos', () => {
    const css = serialize(inlineSpinnerStyle(theme))

    expect(css).toContain(theme.sys.color.divider.secondary)
    expect(css).toContain(theme.sys.color.primary.main)
  })

  it('acepta un margen final y lo omite cuando no se pide', () => {
    const withMargin = serialize(inlineSpinnerStyle(theme, '8px'))
    const withoutMargin = serialize(inlineSpinnerStyle(theme))

    expect(withMargin).toContain('margin-inline-end: 8px')
    expect(withoutMargin).not.toContain('margin-inline-end')
  })

  it('respeta prefers-reduced-motion', () => {
    const css = serialize(inlineSpinnerStyle(theme))

    expect(css).toContain('@media (prefers-reduced-motion: reduce)')
    expect(css).toContain('animation-duration: 2.4s')
  })
})

describe('segmentos de la barra de progreso', () => {
  it('el segmento completado usa el color primario del tema', () => {
    const css = serialize(progressSegmentDoneStyle(theme))

    expect(css).toContain(`background-color: ${theme.sys.color.primary.main}`)
    expect(css).toContain('height: 6px')
  })

  it('el segmento pendiente usa un tono tenue y no el color secundario a plena intensidad', () => {
    const css = serialize(progressSegmentPendingStyle(theme))

    // Regresión: `bg-secondary bg-opacity-25` pintaba el segmento con el color
    // secundario sólido, porque `bg-opacity-25` no existe en EXB.
    expect(css).toContain(theme.sys.color.action.disabled.default)
    expect(css).not.toContain('bg-opacity')
  })

  it('el segmento activo incluye rayado y desplazamiento propios', () => {
    const css = serialize(progressSegmentActiveStyle(theme))

    // Regresión: `progress-bar-striped` y `progress-bar-animated` no existen en EXB,
    // así que el segmento activo se veía como un color plano sin señal de actividad.
    expect(css).toContain('background-image: linear-gradient')
    expect(css).toContain('animation: map-narrator-progress')
    expect(css).toContain('@keyframes map-narrator-progress')
    expect(css).toContain('background-size')
  })

  it('los tres estados se distinguen entre sí', () => {
    const done = serialize(progressSegmentDoneStyle(theme))
    const active = serialize(progressSegmentActiveStyle(theme))
    const pending = serialize(progressSegmentPendingStyle(theme))

    expect(done).not.toEqual(active)
    expect(active).not.toEqual(pending)
    expect(done).not.toEqual(pending)
    expect(active).toContain('linear-gradient')
    expect(done).not.toContain('linear-gradient')
    expect(pending).not.toContain('linear-gradient')
  })
})
