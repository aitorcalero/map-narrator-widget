# Map Narrator Widget

Widget de ArcGIS Experience Builder que describe accesiblemente la vista visual real de un mapa para personas sin visión, mediante capturas controladas y OpenAI.

## Descripción

El widget genera descripciones accesibles del mapa visible (colores, símbolos, etiquetas, distribución espacial, patrones, leyendas), basadas en:

- **Metadatos GIS** (extensión, escala, basemap, capas visibles)
- **Captura visual opt-in** de la vista actual del mapa (PNG)

En modo visual, describe lo que una persona sin visión necesitaría para entender el mapa. El widget solo captura cuando el usuario pulsa el botón.

## Componentes necesarios

### Requisitos de software

- **ArcGIS Experience Builder Developer Edition 1.21.0** (o compatible)
- **Node.js 22 o superior** (la versión del contenedor es 22-alpine, pero local usa la versión del sistema)
- **pnpm** (se usa en el proyecto)
- **Tailscale** (recomendado para desarrollo local con HTTPS)
- **Acceso a internet** (para las API de OpenAI y ArcGIS)

### Cuentas de terceros necesarias

1. **ArcGIS Online / Enterprise** — para publicar el widget y Experience Builder
   - Portal: `https://geogeeks.maps.arcgis.com`
   - Necesitas un item de Experience Builder publicado
   
2. **OpenAI Platform** — para la descripción del mapa
   - Cuenta en https://platform.openai.com
   - API key de tipo `sk-proj-` o `sk-svcacct-` (Project o Service Account)
   - Modelo: `gpt-5-mini` (o compatible)

### Componentes de terceros integrados

- **ArcGIS Maps SDK for JavaScript 5.1.24** (incluido en Experience Builder)
- **OpenAI Responses API** (para generación de descripciones)
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
export OPENAI_API_KEY="***"  # o *** OPENAI_MODEL="gpt-5-mini"     # modelo por defecto
export MAP_NARRATOR_ALLOWED_ORIGIN="https://tu-dominio-experience-builder"  # origen permitido
export PORT=8787
```

Opcional:
```sh
export MAP_NARRATOR_FORENSICS_LOG="/ruta/segura/forensics.jsonl"
```

### 2. Almacenamiento seguro de la clave

El proyecto incluye un script para guardar la clave de forma segura (solo la tienes que pegar una vez y el script la valida):

```sh
bash scripts/save-api-key.sh
```

Esto guarda la clave en `~/.config/map-narrator/backend.env` con permisos 600.

### 3. Arranque de todos los servicios

El script `scripts/start-all.sh` arranca todo automáticamente:

```sh
bash scripts/start-all.sh
```

Este script:
- Lee la clave del archivo de credenciales o de la variable de entorno
- Detiene procesos anteriores
- Arranca el backend API en el puerto 8787
- Arranca Experience Builder en los puertos 3000/3001
- Verifica que todo está funcionando

### 4. Tailscale (recomendado para desarrollo local)

Para evitar problemas con certificados SSL locales y Service Workers:

```sh
# Exponer Experience Builder vía Tailscale
tailscale serve --https=443 --bg https+insecure://127.0.0.1:3001

# Exponer el backend API vía Tailscale
tailscale serve --https=8443 --bg http://127.0.0.1:8787
```

Luego accede a:
- Experience Builder: `https://tu-host.taild71000.ts.net`
- Backend API: `https://tu-host.taild71000.ts.net:8443/api/map-description`

## Configuración del widget en Experience Builder

1. Abre tu app en Experience Builder
2. Añade el widget "Map Narrator" al lienzo
3. Configura:
   - **API URL**: `https://tu-dominio/api/map-description` (o la URL de Tailscale)
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

Copyright © Aitor Calero García

Este proyecto está licenciado bajo los términos especificados en el archivo LICENSE.
