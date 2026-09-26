import { type React } from 'jimu-core'

export const narrationContentStyle: React.CSSProperties = {
  flex: '1 1 auto',
  minHeight: 0,
  overflowY: 'auto'
}

/**
 * Estilo base de la barra de progreso fija al pie del widget.
 *
 * El fondo y el borde usan variables CSS del sistema en lugar de valores fijos.
 * Antes se referenciaba `var(--ref-palette-neutral-400, #c7c7c7)`: ese tono de
 * paleta no está entre los que Experience Builder publica como variable, así que
 * el borde caía siempre en el color de reserva y no se adaptaba al tema.
 *
 * Como no depende del tema en tiempo de render, se declara como objeto constante
 * para poder verificarlo con los tests unitarios existentes.
 */
export const stickyProgressStyle: React.CSSProperties = {
  flex: '0 0 auto',
  marginTop: 'auto',
  paddingTop: '0.5rem',
  background: 'var(--sys-color-surface-paper, #fff)',
  borderTop: '1px solid var(--sys-color-divider-secondary, #c7c7c7)'
}
