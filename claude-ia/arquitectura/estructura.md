# Arquitectura — Invitación de casamiento

## Qué es

Invitación web estática de casamiento (Julieta & Gabriel, 23/10/2027) con sobre de apertura a pantalla completa (foto real), secciones armadas con imágenes de diseño + overlays HTML animados, RSVP, sugerencia de canciones, regalo de bodas dinámico y galería de fotos, publicada en GitHub Pages con dominio propio. Paleta general: verde oliva, tipografía script real Edwardian Script ITC (ver [[decisiones-tecnicas]]).

Sitio publicado: `https://bodajyg.site/` (dominio propio con CNAME, el `.github.io/casamiento` redirige ahí).

## Archivos activos (raíz del repo)

- **`index.html`** — archivo de trabajo principal. HTML + CSS + JS inline, todo en un solo archivo. Sin la sección de método de pago.
- **`invitacion/index.html`** — segunda variante, igual a `index.html` pero **con** la sección "Nuestro regalo de bodas". Cualquier cambio de diseño/estructura se replica en ambos.
- **`galeria/index.html`** — página de galería de fotos (subida + listado + descarga), enlazada desde las dos anteriores.
- **`img/`** — imágenes de diseño, optimizadas para peso (~1.4M en total, ver [[decisiones-tecnicas]]): `sobre.jpg` (sobre de apertura), `TARJETA.jpg` (portada), `calendario.jpg` (guardá la fecha), `lugares.jpg` (ceremonia/fiesta/cómo llegar), `fondo.jpg` (textura de fondo para RSVP/canción/galería/regalo), `alianzas.webp` (footer, transparencia real, procesada con Python/Pillow).
- **`fonts/Edwardian.ttf`** — tipografía script real, cargada vía `@font-face` en cada `index.html`.
- **`documentos/AppsScript_RSVP.gs`** — backend en Google Apps Script, deployado como Web App, respaldado por un Google Sheet con pestañas: "Invitados", "Canciones", "Regalo". No se redeploya solo — cualquier cambio acá requiere que el usuario vuelva a hacer "Deploy" en el editor de Apps Script (y a veces re-autorizar permisos, ver [[bugs-conocidos]]).

## Archivos congelados (no tocar)

Todo dentro de `documentos/` excepto el `.gs`, que sigue siendo el backend real:
- `documentos/index.html`, `documentos/invitacion/index.html` — congelados desde 2026-07-11.
- `documentos/invitacion_casamiento.html` — congelado desde 2026-07-10.

Ver [[decisiones-tecnicas]] para el porqué de la migración a la raíz.

## Backend (Google Apps Script)

- `doGet`:
  - sin parámetro → lista de invitados (`{ nombre, confirmado }`)
  - `?tipo=canciones` → lista de canciones
  - `?tipo=regalo` → datos de la tarjeta de regalo (`{ Monto, Titular, Banco, CBU, Alias }`, pestaña "Regalo" del Sheet, formato clave/valor)
  - `?tipo=galeria` → lista de fotos de una carpeta de Drive (metadata + URL de proxy)
  - `?tipo=foto&id=ID` → una foto puntual, codificada en base64 dentro de un JSON (`{ mimeType, data }`) — no se devuelve blob binario directo, ver [[decisiones-tecnicas]]
- `doPost`:
  - `{ tipo: "cancion", cancion }` → agrega una canción (recortada a 50 caracteres en el servidor)
  - `{ tipo: "foto", nombre, mimeType, data }` → sube una foto a la carpeta de Drive (`GALERIA_FOLDER_ID`)
  - cualquier otro body → confirma asistencia (`{ nombre, restricciones, detalle }`), **solo si el nombre ya existe en la planilla de Invitados**
- `GAS_URL` vive hardcodeado en el `<script>` de cada página que lo necesita (repetido). Visible en la pestaña Network — no se oculta a propósito, ver [[decisiones-tecnicas]].

## Interacción / UX de cada `index.html`

1. **Sobre de apertura** (`#envelope`): overlay fijo a pantalla completa con foto real (`sobre.png`). Se abre con click/tap (no scroll — se probó y se descartó, ver [[decisiones-tecnicas]]). Nombres del sobre aparecen en secuencia (Julieta → & → Gabriel) al cargar la página.
2. **Portada**: imagen `TARJETA.jpg` con "Julieta & Gabriel" tapado y reemplazado por HTML animado (mismo efecto `.centered` que el resto, disparado recién al abrir el sobre).
3. **Guardá la fecha**: imagen `calendario.jpg` + cuenta regresiva en vivo (días/horas/min/seg) superpuesta como overlay HTML sobre el espacio vacío de la imagen.
4. **Dónde celebramos**: imagen `lugares.jpg` con botones invisibles superpuestos ("cómo llegar" a Ceremonia/Fiesta → Google Maps) + overlays de texto (hora/lugar) tapando los placeholders de la imagen.
5. **Confirmar asistencia (RSVP)**: busca contra `guestList` (cargada de la planilla), muestra restricciones alimentarias. Fondo con textura (`fondo.jpg`).
6. **Dejá tu canción**: lista visible guardada en `sessionStorage` (por pestaña, ver [[decisiones-tecnicas]]), envío real al Sheet vía POST. Fondo con textura.
7. **Fotos del casamiento**: enlace a `galeria/index.html`. Fondo con textura.
8. **Nuestro regalo de bodas** — **solo en `invitacion/index.html`**, al final antes del footer. Datos dinámicos desde el Sheet (`?tipo=regalo`). Fondo con textura.
9. **Footer**: "Julieta & Gabriel 💍 23.10.2027", con `alianzas.png` reemplazando el separador.

### Sistema de animación al scrollear

Dos clases independientes en cada sección `.reveal`, manejadas por un único `IntersectionObserver` con `threshold: [0.15, 0.5]`:
- **`.visible`** (15% de intersección): fade + slide de la tarjeta entera. Se agrega una sola vez, no se saca.
- **`.centered`** (50% de intersección): dispara la animación de los *datos internos* (contador, horas, monto, nombres) con `transition-delay` escalonado. Se agrega **y se saca** con cada cambio de intersección, así se repite cada vez que la sección se recentra.

La primera sección (portada) no se observa desde el arranque — recién se empieza a observar cuando se abre el sobre (`revealFirstSection()`), para evitar que la animación de los nombres se reproduzca entera detrás del sobre todavía cerrado. Ver [[decisiones-tecnicas]] y [[bugs-conocidos]].

## Repo remoto

- `origin` → `https://github.com/bodajyg27-blip/casamiento.git`
- Identidad git local del proyecto: `bodajyg27 <bodajyg27@gmail.com>` (no la global de la máquina, que es Gabriel Oros).
- Deploy automático a GitHub Pages vía `.github/workflows/static.yml` en cada push a `main`. Dominio propio `bodajyg.site` configurado (CNAME), con caché de hasta 10 min — si algo no se ve actualizado después de un deploy, probar hard refresh antes de asumir que hay un bug.
