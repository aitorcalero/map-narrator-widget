import { React } from 'jimu-core'
import { act, render, screen, waitFor } from '@testing-library/react'

/**
 * `jimu-arcgis` conecta con la vista real de ArcGIS. Se sustituye por un doble que
 * captura el callback para poder simular la carga del mapa sin depender del SDK.
 */
const mockMapViewHandlers: Array<(view: unknown) => void> = []

jest.mock('jimu-arcgis', () => ({
  JimuMapViewComponent: (props: { onActiveViewChange?: (view: unknown) => void }) => {
    if (props.onActiveViewChange) mockMapViewHandlers.push(props.onActiveViewChange)
    return null
  }
}))

import Widget from '../src/runtime/widget'

const mockView = {
  extent: { xmin: -1, ymin: -1, xmax: 1, ymax: 1, spatialReference: { wkid: 4326 } },
  map: { portalItem: { title: 'Mapa de prueba' }, layers: [] },
  scale: 5000
}

function deferred<T> () {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(res => { resolve = res })
  return { promise, resolve }
}

function baseProps (overrides: Record<string, unknown> = {}) {
  return {
    id: 'map-narrator-1',
    config: {},
    useMapWidgetIds: ['map-widget-1'],
    ...overrides
  } as any
}

const fetchMock = global.fetch as unknown as jest.Mock

beforeEach(() => {
  mockMapViewHandlers.length = 0
  if (fetchMock?.mockReset) fetchMock.mockReset()
})

describe('Widget: estado inicial', () => {
  it('muestra el título y la versión del widget', () => {
    render(<Widget {...baseProps()} />)

    expect(screen.getByText('Narrador del mapa')).toBeTruthy()
    expect(screen.getByLabelText('Versión del widget').textContent).toBe('1.1.0 · stable')
  })

  it('explica que hace el widget', () => {
    render(<Widget {...baseProps()} />)

    expect(screen.getByText('Genera un resumen basado en la extensión y las capas visibles del mapa.')).toBeTruthy()
  })

  it('empieza con el registro de diagnóstico vacío y desactivado', () => {
    render(<Widget {...baseProps()} />)

    const button = screen.getByText('Abrir registro de diagnóstico (0)') as HTMLButtonElement
    expect(button.disabled).toBe(true)
  })

  it('no muestra el reproductor de audio hasta que hay descripción', () => {
    render(<Widget {...baseProps()} />)

    expect(screen.queryByLabelText('Audio de la descripción del mapa')).toBeNull()
  })
})

describe('Widget: bloqueo por configuración incompleta', () => {
  it('pide seleccionar un widget de mapa cuando no hay ninguno asociado', () => {
    render(<Widget {...baseProps({ useMapWidgetIds: undefined })} />)

    expect(screen.getByText('Selecciona un widget de mapa en la configuración.')).toBeTruthy()
    expect((screen.getByRole('button', { name: /Describir metadatos del mapa/ }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('pide configurar la URL de la API cuando falta', () => {
    render(<Widget {...baseProps()} />)

    expect(screen.getByText('Configura una URL HTTPS para la API de narración.')).toBeTruthy()
  })

  it('rechaza una URL de API que no es HTTPS ni loopback', () => {
    render(<Widget {...baseProps({ config: { apiUrl: 'http://narrator.example.com/api/map-description' } })} />)

    expect(screen.getByText('Configura una URL HTTPS para la API de narración.')).toBeTruthy()
  })

  it('indica que espera al mapa cuando la configuración es válida pero no ha cargado', () => {
    render(<Widget {...baseProps({ config: { apiUrl: 'https://narrator.example.com/api/map-description' } })} />)

    expect(screen.getByText('Esperando a que cargue el mapa.')).toBeTruthy()
  })

  it('habilita el botón cuando hay mapa y endpoint válidos', async () => {
    render(<Widget {...baseProps({ config: { apiUrl: 'https://narrator.example.com/api/map-description' } })} />)

    await act(async () => {
      mockMapViewHandlers.forEach(handler => handler({ view: mockView }))
    })

    await waitFor(() => {
      const button = screen.getByRole('button', { name: /Describir metadatos del mapa/ }) as HTMLButtonElement
      expect(button.disabled).toBe(false)
    })
  })
})

describe('Widget: componentes oficiales y regresiones de estilos', () => {
  it('aplica la tipografía del tema en lugar de clases h5/h6', () => {
    const { container } = render(<Widget {...baseProps()} />)

    expect(container.querySelectorAll('.jimu-typography').length).toBeGreaterThan(0)
    expect(container.querySelector('.h5')).toBeNull()
    expect(container.querySelector('.h6')).toBeNull()
  })

  it('no usa clases que Experience Builder no inyecta', () => {
    const { container } = render(<Widget {...baseProps()} />)
    const html = container.innerHTML

    // Regresión: ninguna de estas clases existe en el CSS de EXB.
    for (const legacy of ['spinner-border', 'alert-danger', 'progress-bar-striped', 'bg-opacity-25', 'gap-1', 'ms-3', 'me-2']) {
      expect(html).not.toContain(legacy)
    }
  })

  it('mantiene las utilidades que sí existen en el tema', () => {
    const { container } = render(<Widget {...baseProps()} />)
    const root = container.querySelector('.widget-map-narrator') as HTMLElement

    expect(root.className).toContain('d-flex')
    expect(root.className).toContain('flex-column')
    expect(root.className).toContain('p-3')
    expect(root.className).toContain('overflow-hidden')
  })

  it('usa el color de texto secundario del tema en las notas, no text-muted', () => {
    const { container } = render(<Widget {...baseProps()} />)

    expect(container.querySelector('.text-muted')).toBeNull()
    expect(container.querySelector('.jimu-typography')).toBeTruthy()
  })

  it('muestra la nota de privacidad solo en modo visual', () => {
    const { container: metadataContainer } = render(<Widget {...baseProps()} />)
    expect(metadataContainer.textContent).not.toContain('no se guarda en el widget')

    const { container: visualContainer } = render(
      <Widget {...baseProps({ config: { apiUrl: 'https://narrator.example.com/api/map-description', visualMode: true } })} />
    )
    expect(visualContainer.textContent).toContain('no se guarda en el widget')
  })

  it('cambia la etiqueta del botón según el modo de narración', () => {
    render(<Widget {...baseProps()} />)
    expect(screen.getByText('Describir metadatos del mapa')).toBeTruthy()

    render(<Widget {...baseProps({ config: { apiUrl: 'https://narrator.example.com/api/map-description', visualMode: true } })} />)
    expect(screen.getByText('Describir visualmente el mapa')).toBeTruthy()
  })
})

describe('Widget: operación en curso', () => {
  it('bloquea el botón y muestra el indicador de actividad propio mientras espera a la API', async () => {
    const pending = deferred<any>()
    fetchMock.mockImplementation(() => pending.promise)

    const { container } = render(<Widget {...baseProps({ config: { apiUrl: 'https://narrator.example.com/api/map-description' } })} />)

    await act(async () => {
      mockMapViewHandlers.forEach(handler => handler({ view: mockView }))
    })

    const button = await screen.findByRole('button', { name: /Describir metadatos del mapa/ }) as HTMLButtonElement
    await act(async () => { button.click() })

    // El paso actual se anuncia en el botón, en la región viva y en el panel de
    // progreso, así que se consulta por rol en lugar de por texto exacto.
    const busyButton = await screen.findByRole('button', { name: /Analizando la configuración visible del mapa/ }) as HTMLButtonElement
    expect(busyButton.disabled).toBe(true)
    expect(screen.getAllByText('Analizando la configuración visible del mapa…').length).toBeGreaterThanOrEqual(1)

    // Regresión: el indicador usaba `spinner-border`, que EXB no inyecta, así que
    // quedaba un span vacío e invisible. Ahora aporta su propia animación.
    const spinner = busyButton.querySelector('span[aria-hidden="true"]') as HTMLElement
    expect(spinner).toBeTruthy()
    expect(spinner.className).not.toContain('spinner-border')
    expect(spinner.className).toMatch(/css-/)

    // El panel de progreso anuncia el estado como región viva.
    expect(screen.getAllByRole('status').length).toBeGreaterThanOrEqual(1)
    expect(container.querySelector('.map-narrator-progress-tracker')).toBeTruthy()

    await act(async () => {
      pending.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          description: {
            title: 'Movilidad urbana',
            description: 'El mapa muestra la red de transporte.',
            highlightedLayers: [],
            observedPatterns: [],
            limitations: []
          }
        })
      })
    })

    await waitFor(() => {
      expect(screen.getByText('Movilidad urbana')).toBeTruthy()
    })

    // Al terminar, el panel de progreso desaparece y el botón vuelve a estar activo.
    expect(container.querySelector('.map-narrator-progress-tracker')).toBeNull()
    const idleButton = screen.getByRole('button', { name: /Describir metadatos del mapa/ }) as HTMLButtonElement
    expect(idleButton.disabled).toBe(false)
  })

  it('muestra el error como alerta del tema y lo deja registrado en el diagnóstico', async () => {
    fetchMock.mockImplementation(() => Promise.resolve({
      ok: false,
      status: 502,
      json: async () => ({ error: { code: 'UPSTREAM_ERROR', message: 'Servicio de descripción no disponible' } })
    }))

    const { container } = render(<Widget {...baseProps({ config: { apiUrl: 'https://narrator.example.com/api/map-description' } })} />)

    await act(async () => {
      mockMapViewHandlers.forEach(handler => handler({ view: mockView }))
    })

    const button = await screen.findByRole('button', { name: /Describir metadatos del mapa/ }) as HTMLButtonElement
    await act(async () => { button.click() })

    await waitFor(() => {
      expect(screen.getByText('Servicio de descripción no disponible')).toBeTruthy()
    })

    // Regresión: el aviso usaba `alert alert-danger`, que EXB no inyecta.
    expect(container.querySelector('.alert-danger')).toBeNull()

    // El fallo queda registrado para poder diagnosticarlo después.
    const diagnosticButton = screen.getByText('Abrir registro de diagnóstico (1)') as HTMLButtonElement
    expect(diagnosticButton.disabled).toBe(false)
  })
})
