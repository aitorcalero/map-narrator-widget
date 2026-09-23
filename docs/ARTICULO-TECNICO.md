# Map Narrator Widget: creación de un widget accesible para describir mapas

## Resumen

Map Narrator Widget es un widget para ArcGIS Experience Builder que transforma
la vista visible de un mapa en una descripción textual accesible. El usuario
decide cuándo se captura la vista, el backend combina los metadatos GIS con la
imagen y OpenAI genera una narración. De forma opcional, ElevenLabs convierte
esa narración en audio.

El proyecto se desarrolló pensando en un escenario real de trabajo local:
Experience Builder se ejecuta fuera del repositorio, el backend se mantiene en
un servicio Node.js independiente y Tailscale proporciona HTTPS válido durante
el desarrollo. La solución terminó incluyendo launchers equivalentes para
Windows y Linux/macOS, almacenamiento seguro de credenciales, validación de
imágenes, diagnóstico de errores y pruebas automatizadas.

## 1. El problema que se quería resolver

Un mapa puede contener mucha información que no resulta accesible para una
persona que no puede percibir la representación visual directamente:

- colores y patrones;
- símbolos y tamaños;
- etiquetas y leyendas;
- distribución espacial;
- extensión y escala;
- capas visibles y basemap;
- concentración o ausencia de elementos.

La idea no era generar una descripción genérica de una aplicación, sino
describir la vista concreta que el usuario tenía delante. Por eso el widget
recoge dos tipos de información:

1. **Contexto estructurado del mapa**: título, extensión, referencia espacial,
   escala, basemap y capas visibles.
2. **Captura visual opcional**: una imagen de la vista actual, enviada solo
   después de pulsar el botón de descripción visual.

La separación entre ambos datos permite que el modo textual siga funcionando
aunque la captura visual no esté disponible.

## 2. Arquitectura general

La solución se divide en tres piezas:

```text
ArcGIS Experience Builder
        |
        |  contexto GIS + captura JPEG (acción explícita)
        v
Map Narrator Widget
        |
        |  POST /api/map-description
        v
Backend Node.js
   |                 |
   |                 +--> ElevenLabs (POST /api/speech, opcional)
   |
   +--> OpenAI Responses API
```

Experience Builder no se incluye dentro del repositorio. El widget se desarrolla
en `client/your-extensions/widgets/map-narrator` y el backend en
`services/map-narrator-api`.

El backend es el único componente que conoce las claves de OpenAI y ElevenLabs.
El navegador solo recibe la descripción y, cuando corresponde, los bytes del
audio.

## 3. Creación de la estructura del proyecto

El widget se creó para Experience Builder Developer Edition 1.21.0. Su
`manifest.json` declara:

- nombre y etiqueta de `Map Narrator`;
- compatibilidad con `exbVersion` 1.21.0;
- dependencia `jimu-arcgis`;
- soporte de redimensionado automático;
- licencia MIT y atribución del autor.

La lógica de ejecución se organizó en módulos pequeños:

- `widget.tsx`: interfaz, botones, estados, descripción y reproducción;
- `map-context.ts`: extracción del contexto del mapa;
- `visual-capture.ts`: captura y compresión de la vista;
- `layout.ts`: decisiones de distribución visual;
- `diagnostics.ts`: información útil para depuración.

El icono `icon.svg` se añadió después de detectar que Experience Builder
intentaba solicitar `/widgets/map-narrator/icon.svg` y devolvía un error 404.

## 4. Captura visual controlada

La captura visual es opt-in. El widget no envía imágenes durante la navegación
normal ni en segundo plano. Solo captura cuando el usuario activa la acción de
descripción visual.

Durante las primeras pruebas aparecieron dos problemas:

1. Las imágenes PNG de mapas de imágenes podían ocupar varios megabytes.
2. El backend rechazaba capturas por tamaño o por formato inválido.

La solución fue:

- limitar la dimensión máxima a 1280 píxeles;
- convertir la captura a JPEG;
- utilizar calidad 75;
- validar tipo MIME, Base64, dimensiones y tamaño en el backend;
- aceptar explícitamente PNG y JPEG;
- limitar la petición JSON completa a 6 MiB;
- limitar la imagen decodificada a 4 MiB.

El cambio de PNG a JPEG fue importante para mapas de ortofotografía e
imágenes satelitales, que producen archivos mucho mayores que mapas vectoriales
con la misma resolución.

## 5. Diseño del backend

El backend se implementó con Node.js y expone dos rutas principales:

### `POST /api/map-description`

Recibe:

- el contexto normalizado del mapa;
- el locale;
- el estilo de descripción;
- opcionalmente una imagen en forma de data URL.

Antes de llamar al proveedor externo, el servidor:

1. valida el JSON;
2. comprueba la extensión y la referencia espacial;
3. valida las capas y los límites;
4. valida el data URL de la imagen;
5. comprueba dimensiones y tamaño;
6. aplica CORS;
7. aplica límites de frecuencia;
8. genera un `requestId` para diagnóstico.

La imagen no se almacena como parte de la respuesta ni se incluye en los
registros forenses.

### `POST /api/speech`

Recibe el texto ya generado y lo envía a ElevenLabs cuando el servicio está
configurado. La respuesta es audio MPEG. Si ElevenLabs no está configurado, el
backend devuelve un error explícito y la generación de texto continúa siendo
usable.

La API key y el `voice_id` nunca se envían al cliente.

### `GET /healthz`

Se utiliza por los launchers para saber si el backend está listo antes de
iniciar el resto del entorno.

## 6. Integración con OpenAI

La descripción visual se genera mediante la Responses API. El backend utiliza
por defecto `gpt-5-mini`, aunque el modelo se puede cambiar con
`OPENAI_MODEL`.

La petición combina:

- instrucciones de accesibilidad;
- contexto estructurado;
- locale;
- estilo;
- imagen, cuando el modo visual está activo.

Durante la integración se corrigió un problema de autenticación: el header
correcto es:

```http
Authorization: Bearer <OPENAI_API_KEY>
```

Los errores iniciales no procedían de la API key. Los diagnósticos permitieron
separar varias causas:

- `Failed to fetch`: normalmente CORS o conectividad;
- `413 PAYLOAD_TOO_LARGE`: cuerpo HTTP demasiado grande;
- `visual image is too large`: límite de imagen;
- `visual request must contain a PNG data URL`: validación incompatible con
  la captura JPEG.

Esta distinción evitó intentar resolver problemas de imagen modificando
credenciales o configuración de OpenAI.

## 7. Integración opcional con ElevenLabs

ElevenLabs no interpreta directamente la imagen en esta arquitectura. El
flujo correcto es:

```text
imagen + contexto -> OpenAI -> descripción textual -> ElevenLabs -> audio
```

Se creó `elevenlabs-synthesizer.js`, que:

- llama a `/v1/text-to-speech/{voice_id}`;
- utiliza `eleven_multilingual_v2` por defecto;
- valida el texto;
- devuelve audio MPEG;
- mantiene la clave exclusivamente en el servidor.

En el widget se añadió el botón **Leer descripción**. Al iniciar una nueva
descripción visual:

- se limpia la descripción anterior;
- se revoca la URL temporal del audio anterior;
- se elimina el reproductor anterior;
- se evita reproducir contenido obsoleto.

La voz es opcional: OpenAI puede seguir generando texto aunque falten
`ELEVENLABS_API_KEY` o `ELEVENLABS_VOICE_ID`.

## 8. Configuración segura de credenciales

Las claves no se guardan en el repositorio ni en el código del widget.

### Linux y macOS

Los scripts guardan la configuración en:

```text
~/.config/map-narrator/backend.env
```

El archivo se crea con permisos 600 y el directorio con permisos 700. Los
scripts disponibles son:

```bash
bash scripts/save-api-key.sh
bash scripts/save-elevenlabs-config.sh
```

### Windows

La configuración se guarda en:

```text
%LOCALAPPDATA%\map-narrator\backend.env
```

PowerShell restringe el ACL al usuario actual:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\save-api-key.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\save-elevenlabs-config.ps1
```

Las validaciones incluyen:

- valor no vacío;
- prefijo `sk-` para OpenAI;
- exactamente un prefijo `sk-`;
- detección de claves duplicadas;
- rechazo de caracteres de control;
- conservación de la configuración de ElevenLabs al actualizar OpenAI y
  viceversa.

Un problema relevante apareció al validar claves OpenAI con una operación
basada en `Split('sk-')`, que rechazaba claves válidas. Se sustituyó por una
comprobación de prefijo y conteo explícito.

## 9. Desarrollo en Windows

La instalación local utilizada fue:

```text
C:\Users\aitor.calero\arcgis-experience-builder-1.21
```

El launcher de Windows (`scripts/start-all.ps1`) resuelve Experience Builder
por variable de entorno, rutas habituales o una ruta introducida
interactivamente. Comprueba:

- `node.exe`;
- `npm.cmd`;
- `pnpm.cmd`;
- directorios `server` y `client`;
- existencia del widget fuente.

Antes de iniciar, sincroniza el widget del repositorio con:

```text
client\your-extensions\widgets\map-narrator
```

También libera los puertos `8787`, `3000` y `3001`, incluyendo procesos
descendientes. Si Windows deniega el cierre de un proceso iniciado con
privilegios elevados, el error indica que hay que ejecutar PowerShell como
administrador.

El arranque es:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-all.ps1
```

Para controlar el acceso:

```powershell
# Solo la tailnet
powershell -ExecutionPolicy Bypass -File .\scripts\start-all.ps1 -NoFunnel

# Acceso público mediante Funnel
powershell -ExecutionPolicy Bypass -File .\scripts\start-all.ps1 -Funnel

# Sin Tailscale
powershell -ExecutionPolicy Bypass -File .\scripts\start-all.ps1 -SkipTailscale
```

Si no se especifica ninguna opción, el script pregunta si se desea activar
Funnel.

## 10. Desarrollo en Linux y macOS

El launcher Bash se alineó para ofrecer el mismo contrato operativo que
PowerShell:

```bash
bash scripts/start-all.sh
bash scripts/start-all.sh --no-funnel
bash scripts/start-all.sh --funnel
bash scripts/start-all.sh --skip-tailscale
```

Busca Experience Builder en rutas habituales o mediante:

```bash
export EXPERIENCE_BUILDER_ROOT="$HOME/work/arcgis-experience-builder"
```

El flujo común es:

1. cargar credenciales;
2. comprobar dependencias;
3. validar Experience Builder;
4. copiar el widget;
5. detener procesos anteriores;
6. arrancar la API;
7. esperar `/healthz`;
8. arrancar el cliente de Experience Builder;
9. arrancar el servidor de Experience Builder;
10. esperar el puerto 3000;
11. configurar Tailscale;
12. mostrar las URLs finales.

El launcher utiliza `lsof` o `fuser` para localizar procesos en los puertos y
`pgrep` para detener sus árboles de procesos. Las trazas se guardan en
`/tmp/map-narrator`, salvo que `TMPDIR` indique otra ubicación.

Para evitar ejecutar comandos arbitrarios desde el archivo de credenciales,
el launcher Bash lee pares `NOMBRE=VALOR` y solo exporta nombres de variable
válidos.

## 11. Tailscale, Serve y Funnel

Experience Builder necesita un contexto HTTPS fiable para evitar problemas de
certificados y Service Workers. Tailscale resuelve ese problema sin exponer
las claves al navegador.

Se publican dos servicios:

```text
HTTPS 443  -> http://127.0.0.1:3000   Experience Builder
HTTPS 8443 -> http://127.0.0.1:8787   API
```

`Serve` limita el acceso a la tailnet. `Funnel` permite acceso público si la
política de la tailnet lo autoriza. El origen CORS se deriva del DNS de
Tailscale:

```text
https://<nombre-del-equipo>
```

Para retirar la publicación:

```bash
tailscale serve reset
tailscale funnel reset
```

La decisión de Funnel es explícita porque convierte un entorno privado en uno
accesible desde Internet.

## 12. Cómo detener el entorno

Se añadió un modo de parada común:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-all.ps1 -Stop
```

```bash
bash scripts/start-all.sh --stop
```

La parada actúa sobre los puertos del proyecto, no sobre todos los procesos de
Node del sistema. Si Tailscale sigue publicando rutas, hay que ejecutar además
los comandos de reset indicados anteriormente.

## 13. Problemas encontrados y decisiones técnicas

### Ruta incorrecta del script

El launcher se estaba invocando desde el directorio padre del repositorio. La
ruta relativa `.\scripts\start-all.ps1` solo funciona desde la raíz correcta.
La solución fue documentar la ruta absoluta y hacer que el script resuelva
sus directorios a partir de `$PSScriptRoot` o `BASH_SOURCE`.

### Ruta placeholder de Experience Builder

El valor `C:\ruta\a\arcgis-experience-builder` provocaba errores poco claros.
El launcher ahora detecta rutas inválidas y solicita una ruta real que
contenga `server` y `client`.

### CORS

El acceso mediante Tailscale no utiliza el mismo origen que `localhost`. El
backend pasó a recibir `MAP_NARRATOR_ALLOWED_ORIGIN` y los launchers lo
derivan automáticamente del host publicado.

### Capturas demasiado grandes

Aumentar únicamente el límite del backend no resolvía el problema. Se
combinó:

- límite de cuerpo HTTP;
- límite de imagen;
- límite de dimensiones;
- compresión JPEG en cliente;
- validación de formato real en servidor.

### Procesos antiguos

Reiniciar sin detener procesos anteriores dejaba puertos ocupados y podía
mezclar bundles de distintas ejecuciones. El arranque actual limpia los
puertos antes de iniciar y ofrece una parada explícita.

### Icono faltante

Experience Builder solicita el icono aunque el widget funcione. Añadir
`icon.svg` eliminó el 404 y mejoró la integración con el catálogo de widgets.

## 14. Pruebas y validación

La API terminó con 23 pruebas correctas. La cobertura incluye:

- generación textual;
- petición visual con imagen;
- PNG y JPEG;
- límites de tamaño;
- dimensiones excesivas;
- validación de contexto;
- CORS;
- rate limiting;
- errores de OpenAI;
- integración de ElevenLabs;
- respuesta de audio;
- servicio no configurado;
- logs forenses sanitizados;
- reutilización de descripciones equivalentes;
- ausencia de datos sensibles en errores.

También se validó:

- sintaxis Bash con `bash -n`;
- sintaxis PowerShell con el parser de PowerShell;
- opciones incompatibles de los launchers;
- `--help` y `-Stop`;
- ausencia de marcadores de conflicto Git.

La validación completa en Linux requiere una instalación real de Experience
Builder y Tailscale; la lógica está alineada, pero esas dependencias no se
pueden simular por completo desde Windows.

## 15. Estado funcional alcanzado

El proyecto terminó con estas capacidades:

- widget ArcGIS Experience Builder operativo;
- descripción basada en contexto GIS;
- modo visual opt-in;
- captura JPEG comprimida;
- backend Node.js con validaciones;
- OpenAI Responses API;
- lectura opcional con ElevenLabs;
- configuración segura para ambos sistemas;
- Tailscale Serve y Funnel;
- CORS derivado de la URL publicada;
- sincronización automática del widget;
- limpieza de procesos;
- parada explícita;
- icono del widget;
- limpieza de descripción y audio anteriores;
- pruebas automatizadas del backend;
- documentación multiplataforma;
- licencia MIT y atribución.

## 16. Evolución prevista

Durante el trabajo también se identificaron mejoras que quedaron registradas
como roadmap:

- personalizar el prompt visual;
- generar un resumen breve y visual específico para ElevenLabs;
- colocar el reproductor arriba y enfocar al terminar;
- añadir barra de progreso;
- mejorar estados y navegación con lectores de pantalla;
- añadir pausa, repetición, detención y velocidad;
- cancelar peticiones obsoletas;
- seleccionar idioma y estilo;
- endurecer caché, timeouts, reintentos y control de abuso;
- reforzar privacidad y métricas de coste;
- incorporar modos de diagnóstico más completos;
- ampliar pruebas del widget y configurar CI.

Estas mejoras deben mantener las decisiones fundamentales del diseño: captura
explícita, credenciales solo en backend, validación estricta y comportamiento
consistente entre Windows y Linux/macOS.

## Conclusión

La creación del widget no consistió únicamente en conectar un botón con una
API de visión. Fue necesario resolver la integración con Experience Builder,
el tamaño y formato de las capturas, CORS, HTTPS local, gestión de procesos,
credenciales, accesibilidad, audio y compatibilidad entre sistemas operativos.

La arquitectura final mantiene una frontera clara: Experience Builder aporta
el mapa, el widget controla la interacción, el backend valida y protege la
información, OpenAI genera la descripción y ElevenLabs aporta la voz de forma
opcional. Esa separación permite evolucionar cada parte sin exponer secretos
ni acoplar el cliente a los proveedores externos.
