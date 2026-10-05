import { css } from 'jimu-core/emotion'
import type { IMThemeVariables } from 'jimu-core'

/** Tipo del tema activo, tal como lo expone `useTheme()` de `jimu-theme`. */
type NarratorTheme = IMThemeVariables

/**
 * Indicador de actividad en línea para operaciones en curso.
 *
 * Sustituye al par `spinner-border spinner-border-sm`, que Experience Builder no
 * inyecta: la versión de Bootstrap embebida es la 4.1.3 y `spinner-border` se
 * incorporó en la 4.2, por lo que el elemento quedaba vacío e invisible.
 *
 * Se dimensiona en `em` para heredar el tamaño del texto que acompaña y toma los
 * colores del tema activo, de modo que funciona igual en modo claro y oscuro.
 */
export function inlineSpinnerStyle (theme: NarratorTheme, marginInlineEnd?: string) {
  return css`
    display: inline-block;
    flex: 0 0 auto;
    width: 1em;
    height: 1em;
    border: 0.15em solid ${theme.sys.color.divider.secondary};
    border-top-color: ${theme.sys.color.primary.main};
    border-radius: 50%;
    animation: map-narrator-spin 0.9s linear infinite;
    ${marginInlineEnd ? `margin-inline-end: ${marginInlineEnd};` : ''}

    @keyframes map-narrator-spin {
      to {
        transform: rotate(360deg);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      animation-duration: 2.4s;
    }
  `
}

/** Segmento completado de la barra de progreso segmentada. */
export function progressSegmentDoneStyle (theme: NarratorTheme) {
  return css`
    flex: 1 1 0;
    height: 6px;
    border-radius: ${theme.sys.shape.shape1};
    background-color: ${theme.sys.color.primary.main};
  `
}

/**
 * Segmento pendiente. Antes usaba `bg-secondary bg-opacity-25`: `bg-secondary` sí
 * existe pero `bg-opacity-25` no, así que el segmento se pintaba con el color
 * secundario a plena intensidad en lugar del tono tenue previsto.
 */
export function progressSegmentPendingStyle (theme: NarratorTheme) {
  return css`
    flex: 1 1 0;
    height: 6px;
    border-radius: ${theme.sys.shape.shape1};
    background-color: ${theme.sys.color.action.disabled.default};
  `
}

/**
 * Segmento activo con rayado y desplazamiento. Sustituye a
 * `progress-bar-striped progress-bar-animated`, tampoco disponibles, que dejaban
 * el segmento como color plano y sin señal de actividad.
 */
export function progressSegmentActiveStyle (theme: NarratorTheme) {
  const stripe = `color-mix(in srgb, ${theme.sys.color.surface.paper} 30%, transparent)`
  return css`
    flex: 1 1 0;
    height: 6px;
    border-radius: ${theme.sys.shape.shape1};
    background-color: ${theme.sys.color.primary.main};
    background-image: linear-gradient(
      45deg,
      ${stripe} 25%,
      transparent 25%,
      transparent 50%,
      ${stripe} 50%,
      ${stripe} 75%,
      transparent 75%,
      transparent
    );
    background-size: 0.75rem 0.75rem;
    animation: map-narrator-progress 1s linear infinite;

    @keyframes map-narrator-progress {
      from {
        background-position: 0.75rem 0;
      }
      to {
        background-position: 0 0;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      animation: none;
    }
  `
}
