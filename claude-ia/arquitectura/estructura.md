# Arquitectura — Invitación de casamiento

## Qué es

Sitio web de casamiento (Julieta & Gabriel, 23/10/2027): puerta de entrada con buscador que separa la invitación por tipo de invitado, dos variantes de invitación (con/sin regalo), galería de fotos, mensajes de video grabados por los invitados, pantalla de TV para el salón y panel de administración — todo estático (HTML+CSS+JS por archivo, sin build), publicado en GitHub Pages. Paleta general: verde oliva, tipografía script real Edwardian Script ITC (ver [[decisiones-tecnicas]]).

**Sitio publicado:** `https://bodajyg27-blip.github.io/casamiento/` (GitHub Pages, sin dominio propio — no hay `CNAME` en el repo ni en su historial; si en algún momento se documentó un dominio `bodajyg.site`, era incorrecto/no llegó a configurarse).

## Estructura de páginas

- **`index.html`** (raíz) — **puerta de entrada**, no invitación completa. Según `ModoIndex` (pestaña `Config` del Sheet):
  - `invitacion` (default): sobre de apertura + buscador de nombre → redirige a `familiar/` o `invitacion/` según la columna `Tipo` de cada invitado.
  - `savethedate`: video a pantalla completa con toque para reproducir (con sonido), sacado de `SAVETHEDATE_FOLDER_ID`.
  - `galeria`: redirige directo a `galeria/index.html`.
  - Cambia desde `admin/` (switch de tres botones), sin tocar código.
- **`familiar/index.html`** — invitación completa **sin** sección de regalo. Antes era el contenido de `index.html`; se movió acá cuando `index.html` pasó a ser la puerta de entrada.
- **`invitacion/index.html`** — invitación completa **con** sección "Nuestro regalo de bodas". Debe mantenerse pareja a `familiar/` en todo lo demás (carrusel, itinerario, dress code, RSVP, canciones, galería) — ver [[decisiones-tecnicas]].
- **`galeria/index.html`** — galería de fotos: subida (FAB), grilla con shimmer de carga, visor a pantalla completa con navegación. Botón "Volver" usa `history.back()` cuando hay de dónde volver (ver [[decisiones-tecnicas]]).
- **`mensaje/index.html`** — grabación de "Dejanos un mensaje": cámara en óvalo, graba en espejo (ver [[decisiones-tecnicas]]), sube a Drive. Pensada para dejarse en modo kiosko (Acceso Guiado de iOS) en un iPad durante el evento. Cola local con IndexedDB para no perder mensajes sin conexión.
- **`tv/index.html`** — slideshow de fotos + mensajes para transmitir a la TV del salón (Chromecast/AirPlay). Soporta `?modo=fotos` / `?modo=videos`. Se actualiza sola cada 2 minutos, con timeout y vigilante anti-traba en las descargas.
- **`admin/index.html`** (antes `mensaje/admin.html`) — panel protegido con clave numérica (passcode de 4 dígitos, validado en el servidor). Menú con: switch de modo de `index.html`, acceso a fotos de la galería (ver/borrar) y a mensajes de video (ver/borrar). No carga nada automático al entrar, cada vista carga bajo demanda — ver [[decisiones-tecnicas]].

## Archivos congelados (no tocar)

Todo dentro de `documentos/` excepto el `.gs`:
- `documentos/index.html`, `documentos/invitacion/index.html` — congelados desde 2026-07-11.
- `documentos/invitacion_casamiento.html` — congelado desde 2026-07-10.

## Recursos compartidos

- **`img/`** — imágenes de diseño optimizadas (ver [[decisiones-tecnicas]] para el criterio JPEG/WebP): `sobre.jpg`, `TARJETA.jpg`, `calendario.jpg`, `lugares.jpg`, `fondo.jpg`, `alianzas.webp`.
- **`fonts/Edwardian.ttf`** — tipografía script, `@font-face` en cada página que la usa.
- **`documentos/AppsScript_RSVP.gs`** — backend completo, deployado como Web App. Es una **copia local de referencia**: el que corre de verdad está pegado en script.google.com y hay que actualizarlo ahí manualmente en cada cambio (Cmd+S alcanza, no hace falta redeploy salvo que haya más de una implementación activa — confirmar cuál usa el sitio si eso pasa).

## Backend (Google Apps Script)

Respaldado por un Google Sheet con pestañas: `Invitados`, `Canciones`, `Regalo`, `Config`.

**`doGet`:**
| `?tipo=` | Devuelve | Auth |
|---|---|---|
| _(sin parámetro)_ | Lista de invitados `{ nombre, confirmado, tipo }` | público |
| `canciones` | Lista de canciones | público |
| `regalo` | Datos de la tarjeta de regalo (clave/valor, pestaña `Regalo`) | público |
| `galeria` | Fotos de `GALERIA_FOLDER_ID` (por fecha) | público |
| `carrusel` | Fotos de `CARRUSEL_FOLDER_ID` (por nombre de archivo) | público |
| `foto&id=` | Una foto/archivo en base64 (`{mimeType, data}`) — genérico, sirve cualquier id de Drive | público |
| `mensajes` | Lista de mensajes de video | público (a propósito, lo necesita `tv/`) |
| `mensajeVideo&id=` | Un video de mensaje en base64 | público |
| `verificarClave&clave=` | `{ok: true/false}` contra `ClaveAdmin` | — |
| `modoIndex` | `{modo}` actual de `index.html` | público |
| `saveTheDate` | `{id, nombre}` del video de save the date | público |

**`doPost`** (`{tipo: ...}` en el body):
| `tipo` | Acción | Auth |
|---|---|---|
| `cancion` | Agrega canción (recortada a 50 caracteres) | público |
| `foto` | Sube foto a `GALERIA_FOLDER_ID` | público |
| `mensaje` | Sube video a `MENSAJES_FOLDER_ID` | público |
| `borrarMensaje` | Borra un mensaje (`setTrashed`) | **clave** |
| `borrarFoto` | Borra una foto de galería | **clave** |
| `setModoIndex` | Cambia `ModoIndex` en `Config` | **clave** |
| _(cualquier otro)_ | Confirma asistencia — solo si el nombre existe en `Invitados` | público |

Solo `borrarMensaje`, `borrarFoto` y `setModoIndex` exigen la clave admin (`claveValida()`); ver la solidaridad de esto con `getMensajes`/`getMensajeVideo` en [[decisiones-tecnicas]] y [[bugs-conocidos]] (regresión de `tv/` cuando se protegió de más).

`GAS_URL` vive hardcodeado en el `<script>` de cada página que lo necesita — visible en la pestaña Network a propósito, no se oculta (ver [[decisiones-tecnicas]]).

### Google Sheet — columnas relevantes

- **`Invitados`**: A=nombre, B=confirmado, C=fecha confirmación, D=restricciones, E=detalle, F=*(sin uso)*, **G=Tipo** (`Familiar`/`Invitado`).
- **`Config`**: filas clave/valor sin encabezado — `ClaveAdmin` (passcode del panel) y `ModoIndex` (`invitacion`/`savethedate`/`galeria`).

### Carpetas de Google Drive

| Constante | Contenido |
|---|---|
| `GALERIA_FOLDER_ID` | Fotos que suben los invitados |
| `MENSAJES_FOLDER_ID` | Videos de "Dejanos un mensaje" |
| `CARRUSEL_FOLDER_ID` | Fotos del carrusel "Nuestra historia" (orden por nombre de archivo) |
| `SAVETHEDATE_FOLDER_ID` | Video de "Save the date" (se usa el primero que encuentre) |

## Interacción / UX

1. **Puerta de entrada** (`index.html`): sobre → buscador → redirige según `Tipo`. Ver arriba para los otros dos modos.
2. **Portada**: `TARJETA.jpg` con nombres animados (mismo patrón `.reveal`/`.centered` que el resto).
3. **Carrusel "Nuestra historia"**: precargado desde `index.html` en `sessionStorage`, ver [[decisiones-tecnicas]].
4. **Guardá la fecha**: `calendario.jpg` + cuenta regresiva en vivo.
5. **Dónde celebramos**: `lugares.jpg` con links a mapa + overlays de hora/lugar.
6. **Itinerario**: horarios del día (actualmente mockup, a confirmar con datos reales).
7. **Dress Code**: texto + dos íconos SVG originales (vestido/traje) dibujados a mano, no fotos (evita temas de licencia de stock, ver conversación).
8. **Confirmar asistencia / Dejá tu canción**: se cierran solos 15 días antes de la boda (ver [[decisiones-tecnicas]]).
9. **Fotos del casamiento**: link a `galeria/index.html`.
10. **Nuestro regalo de bodas** — solo en `invitacion/index.html`.

### Sistema de animación al scrollear

`IntersectionObserver` con `threshold: [0.15, 0.5]` sobre las secciones `.reveal`: `.visible` (15%, fade+slide, una sola vez) y `.centered` (50%, anima datos internos con `transition-delay` escalonado, se agrega y saca en cada re-intersección). La primera sección no se observa hasta que se abre el sobre (`revealFirstSection()`).

## Repo remoto

- `origin` → `https://github.com/bodajyg27-blip/casamiento.git`
- Identidad git local del proyecto: `bodajyg27 <bodajyg27@gmail.com>` (no la global de la máquina).
- Deploy automático a GitHub Pages vía `.github/workflows/static.yml` en cada push a `main`.
