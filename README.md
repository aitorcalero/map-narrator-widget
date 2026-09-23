# Map Narrator Widget

Widget de ArcGIS Experience Builder que describe accesiblemente la vista visual real de un mapa para personas sin visión, mediante capturas controladas y OpenAI. Después de generar la descripción, el usuario puede pulsar **Leer descripción** para convertirla en audio con ElevenLabs y reproducirla desde el propio widget.

## Descripción

El widget genera descripciones accesibles del mapa visible (colores, símbolos, etiquetas, distribución espacial, patrones, leyendas), basadas en:

- **Metadatos GIS** (extensión, escala, basemap, capas visibles)
- **Captura visual opt-in** de la vista actual del mapa (JPEG comprimido)

En modo visual, describe lo que una persona sin visión necesitaría para entender el mapa. El widget solo captura cuando el usuario pulsa el botón. La lectura de audio es opcional y requiere configurar ElevenLabs en el backend; si no está configurado, la generación de texto sigue funcionando.

La explicación técnica completa del diseño, la evolución, los problemas
resueltos y la configuración multiplataforma está disponible en
[docs/ARTICULO-TECNICO.md](docs/ARTICULO-TECNICO.md).

## Componentes necesarios

### Requisitos de software

- **ArcGIS Experience Builder Developer Edition 1.21.0** (o compatible)
- **Node.js 22 o superior** (la versión del contenedor es 22-alpine, pero local usa la versión del sistema)
- **pnpm** (se usa en el proyecto)
- **Tailscale** (recomendado para desarrollo local con HTTPS)
- **Acceso a internet** (para las API de OpenAI, ElevenLabs y ArcGIS)

### Cuentas de terceros necesarias

1. **ArcGIS Online / Enterprise** — para publicar el widget y Experience Builder
   - Portal: `https://geogeeks.maps.arcgis.com`
   - Necesitas un item de Experience Builder publicado
   
2. **OpenAI Platform** — para la descripción del mapa
   - Cuenta en https://platform.openai.com
   - API key de tipo `sk-proj-` o `sk-svcacct-` (Project o Service Account)
   - Modelo: `gpt-5-mini` (o compatible)

3. **ElevenLabs** — para leer en voz alta la descripción generada
   - Cuenta en https://elevenlabs.io
   - API key y un `voice_id`
   - Modelo inicial: `eleven_multilingual_v2`

### Componentes de terceros integrados

- **ArcGIS Maps SDK for JavaScript 5.1.24** (incluido en Experience Builder)
- **OpenAI Responses API** (para generación de descripciones)
- **ElevenLabs Text-to-Speech API** (opcional, para lectura de descripciones)
- **Responsive layout** basado en Bootstrap/jimu-ui (del entorno de Experience Builder)

## Instalación

### 1. Instalar Experience Builder

```sh
# Descargar la versión adecuada desde ArcGIS Downloads
# Instalar en un directorio (ej: ~/work/arcgis-experience-builder)
# Instalar dependencias del servidor y cliente:
cd ~/work/arcgis-experience-builder
cd server && pnpm install
cd ../client && pnpm install
```

### 2. Configurar el portal

Editar `client/builder/setting.json`:
```json
{
  "devEnv": {
    "prod": {
      "portalUrl": "https://geogeeks.maps.arcgis.com",
      "clientId": "TU_CLIENT_ID"
    }
  }
}
```

### 3. Instalar el widget

El widget está en `client/your-extensions/widgets/map-narrator/`. Para instalarlo:
- Si estás en desarrollo, el widget ya está disponible en el entorno de desarrollo de Experience Builder
- Para producción, compilar y publicar el widget

### 4. Compilar el backend del servicio

```sh
cd services/map-narrator-api
npm install
```

## Configuración

### 1. Variables de entorno para el backend

El backend necesita:
```sh
export OPENAI_API_KEY="***"
export OPENAI_MODEL="gpt-5-mini"     # modelo por defecto
export ELEVENLABS_API_KEY="***"  # opcional
export ELEVENLABS_VOICE_ID="tu_voice_id"  # necesario si se habilita ElevenLabs
export ELEVENLABS_MODEL="eleven_multilingual_v2"
export MAP_NARRATOR_ALLOWED_ORIGIN="https://tu-dominio-experience-builder"  # origen permitido
export PORT=8787
```

Opcional:
```sh
export MAP_NARRATOR_FORENSICS_LOG="/ruta/segura/forensics.jsonl"
```

### 2. Almacenamiento seguro de la clave

El proyecto incluye scripts que guardan la clave fuera del repositorio y la validan:

```bash
bash scripts/save-api-key.sh
```

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\save-api-key.ps1
```

En Linux/macOS se guarda en `~/.config/map-narrator/backend.env` con permisos 600. En Windows se guarda en `%LOCALAPPDATA%\map-narrator\backend.env` y se restringe al usuario actual.

Para habilitar la lectura con ElevenLabs, ejecuta el asistente correspondiente. Conserva la clave de OpenAI existente y añade la configuración de voz al mismo archivo:

```bash
bash scripts/save-elevenlabs-config.sh
```

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\save-elevenlabs-config.ps1
```

El asistente solicita la API key de ElevenLabs, el `voice_id` y el modelo
(por defecto `eleven_multilingual_v2`). No muestra la API key mientras se
escribe y no la guarda en el repositorio.

### 3. Arranque de todos los servicios

Experience Builder no forma parte de este repositorio. Indica su directorio raíz mediante `EXPERIENCE_BUILDER_ROOT`; el script usa rutas relativas para el backend de este repositorio.

```bash
export EXPERIENCE_BUILDER_ROOT="$HOME/work/arcgis-experience-builder"
export MAP_NARRATOR_ALLOWED_ORIGIN="http://localhost:3001" # opcional; este es el valor predeterminado
bash scripts/start-all.sh
```

```powershell
$env:EXPERIENCE_BUILDER_ROOT = 'C:\work\arcgis-experience-builder'
powershell -ExecutionPolicy Bypass -File .\scripts\start-all.ps1
```

En Windows, el script comprueba que Tailscale esté instalado y conectado; si está desconectado ejecuta `tailscale up`, y pregunta si quieres activar **Funnel** (acceso público) o mantener **Serve** (solo dispositivos de tu tailnet). Después publica Experience Builder en HTTPS 443 y la API en HTTPS 8443. También arranca el watcher del cliente para compilar los widgets personalizados. La URL permitida de CORS se deriva automáticamente del DNS de Tailscale. Si no quieres usar Tailscale, añade `-SkipTailscale` y configura opcionalmente `MAP_NARRATOR_ALLOWED_ORIGIN`.

Para ejecuciones automatizadas puedes evitar la pregunta:

```powershell
# Público en Internet mediante Tailscale Funnel
powershell -ExecutionPolicy Bypass -File .\scripts\start-all.ps1 -Funnel

# Privado, solo dentro de la tailnet
powershell -ExecutionPolicy Bypass -File .\scripts\start-all.ps1 -NoFunnel
```

Los scripts leen la clave almacenada o `OPENAI_API_KEY`, sincronizan el widget, limpian los procesos que escuchan en los puertos de desarrollo, inician el backend en el puerto 8787 y Experience Builder, y devuelven error si alguno no queda disponible. Los registros se guardan en `/tmp/map-narrator` en Linux/macOS y `%TEMP%\map-narrator` en Windows.

Ambos launchers aceptan el mismo flujo:

```sh
# Usar Tailscale Serve sin acceso público
bash scripts/start-all.sh --no-funnel

# Activar Tailscale Funnel
bash scripts/start-all.sh --funnel

# Ejecutar sin Tailscale
bash scripts/start-all.sh --skip-tailscale

# Detener backend y Experience Builder del proyecto
bash scripts/start-all.sh --stop
```

En Windows se usan los equivalentes `-NoFunnel`, `-Funnel`, `-SkipTailscale` y `-Stop`. Si no se indica una opción de Funnel, el script pregunta. La ruta de Experience Builder se puede proporcionar con `--experience-builder-root` o `-ExperienceBuilderRoot`; también se detectan las instalaciones habituales bajo el directorio personal.

La opción de parada solo actúa sobre procesos que escuchan en los puertos de desarrollo del proyecto (`8787`, `3000` y `3001`). Si se había configurado Tailscale Serve o Funnel, puede ser necesario retirar también esa publicación con `tailscale serve reset` y, si la versión instalada lo admite, `tailscale funnel reset`.

### 4. Tailscale (recomendado para desarrollo local)

Para evitar problemas con certificados SSL locales y Service Workers:

```sh
# Exponer Experience Builder vía Tailscale
tailscale serve --https=443 --bg http://127.0.0.1:3000

# Exponer el backend API vía Tailscale
tailscale serve --https=8443 --bg http://127.0.0.1:8787
```

Luego accede a:
- Experience Builder: `https://tu-host.taild71000.ts.net`
- Backend API: `https://tu-host.taild71000.ts.net:8443/api/map-description`

La lectura en voz alta usa el mismo host de la API, cambiando la ruta a
`/api/speech`. Si no se configuran `ELEVENLABS_API_KEY` y
`ELEVENLABS_VOICE_ID`, la generación de descripciones sigue funcionando y el
botón de lectura informa de que el servicio no está configurado.

## Configuración del widget en Experience Builder

1. Abre tu app en Experience Builder
2. Añade el widget "Map Narrator" al lienzo
3. Configura:
   - **API URL**: `https://tu-dominio/api/map-description` (o la URL de Tailscale)
   - Después de generar una descripción, pulsa **Leer descripción** para solicitar el audio a ElevenLabs.
   - **Map widget**: selecciona el widget de mapa que quieres describir
   - **Visual mode** (opcional): activa si quieres que capture y describa la vista visual

## Despliegue en producción

Para producción, necesitas:
- Un servidor HTTPS público para el backend API (no localhost)
- Las credenciales de OpenAI en el servidor, no en el código
- El widget publicado en ArcGIS Online/Enterprise

### Estructura de despliegue

```
Tu servidor/proxy HTTPS
├── /api/map-description → backend map-narrator-api (puerto 8787)
└── (tu app Experience Builder)
```

### Backend

```sh
cd services/map-narrator-api
export OPENAI_API_KEY="***"
export MAP_NARRATOR_ALLOWED_ORIGIN="https://tu-app-experience-builder"
npm start
```

El backend debe estar detrás de un proxy HTTPS que:
- Exponga la API en HTTPS
- Configurar CORS correctamente
- Gestionar la autenticación de la organización (si aplica)

### Widget en ArcGIS Online

1. Publicar el widget como item en ArcGIS Online
2. Compartir con la organización o grupo adecuado
3. Añadir a la experiencia desde el builder

## Troubleshooting

### Error "Description service unavailable" (502/401)

1. Verifica que el backend está arrancado
2. Verifica que la API key es correcta:
   ```sh
   curl -s -o /dev/null -w "%{http_code}" https://api.openai.com/v1/models/gpt-5-mini -H "Authorization: Bearer ***"
   ```
   Debe devolver `200`. Si devuelve `401`, la clave no es válida.

3. Revisa los logs del backend: `/tmp/map-narrator-api.log`

### Error "ORIGIN_FORBIDDEN" (403)

El origen de la petición no coincide con `MAP_NARRATOR_ALLOWED_ORIGIN`. Verifica:
- La configuración del widget (API URL)
- El `MAP_NARRATOR_ALLOWED_ORIGIN` del backend
- Desde qué URL se accede a Experience Builder

### Problemas con el Service Worker (HTTPS local)

Si usas `https://127.0.0.1:3001` y ves errores de Service Worker SSL:
- Usa Tailscale para exponer el servicio con HTTPS válido
- O confía el certificado local en tu navegador

### La descripción no coincide con lo que se ve

- Asegúrate de que el modo visual está activado
- Verifica que la captura se está generando correctamente
- Prueba con diferentes estilos (technical, citizen)

## Componentes de terceros específicos

1. **OpenAI** — Proveedor de la API para generar las descripciones
   - Modelo: `gpt-5-mini` (o uno compatible)
   - API: https://api.openai.com/v1/responses
   - Necesitas tener cuenta y crédito sufficiente

2. **ArcGIS Online/Enterprise** — Para alojar el widget y las apps
   - Portal: `https://geogeeks.maps.arcgis.com` (tu organización)
   - Necesitas permisos de administrador para registrar widgets personalizados

3. **Tailscale** (opcional pero recomendado) — Para desarrollo local con HTTPS
   - https://tailscale.com
   - Proporciona certificados TLS válidos para localhost

## Licencia

Copyright © 2026 Aitor Calero García

Este proyecto está licenciado bajo los términos de la licencia MIT. La licencia
permite usar, modificar y redistribuir el proyecto, manteniendo esta atribución.

## Roadmap

- [ ] [Añadir una barra de progreso mientras se realiza la petición a OpenAI](https://github.com/aitorcalero/map-narrator-widget/issues/2).
- [ ] [Personalizar el prompt de descripción visual](https://github.com/aitorcalero/map-narrator-widget/issues/8).
- [ ] [Generar un resumen breve y visual para ElevenLabs](https://github.com/aitorcalero/map-narrator-widget/issues/9).
- [ ] [Mover el reproductor de audio al inicio y enfocar al terminar](https://github.com/aitorcalero/map-narrator-widget/issues/7).
