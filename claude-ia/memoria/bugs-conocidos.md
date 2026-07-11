# Bugs / pendientes conocidos — Invitación de casamiento

## Abierto — Divergencia git local/remoto

`main` local y `origin/main` (`bodajyg27-blip/casamiento`) divergieron:

- **Local** tiene 1 commit (`comit`) que no está en origin — incluye la sección de calendario y el fix de canciones sobre `invitacion_casamiento.html` e `index.html`.
- **Origin** tiene 7 commits que no están en local (`Update index.html`, `Add files via upload`, `Create static.yml`, `Delete .github/workflows/invitacion`, `Delete .github/workflows/static.yml`, `Create invitacion`, `Create static.yml`) — parecen configuración de GitHub Pages hecha directo desde la web de GitHub, incluyendo otra versión de `index.html`.

**Pendiente:** resolver (merge o rebase) antes de volver a pushear. Todavía no se intentó — confirmar con el usuario cómo prefiere reconciliar (¿priorizar la versión local del index.html, la de GitHub, o mergear manualmente?).

## Pendiente — Foto real de la pareja

La sección "Nos casamos" tiene un placeholder circular con un SVG de anillos entrelazados en el lugar de la foto. El usuario quiere reemplazarlo por una foto real de la pareja. No se puede generar ni traer una foto real sin que el usuario la provea (no hay forma de fetchear una foto de ellos desde internet). Falta: que el usuario suministre el archivo de imagen para embeberlo en **ambos** `index.html` (principal e `invitacion/`).

## Pendiente — Ajuste de tipografía y colores por sección con imágenes de referencia

El usuario avisó que va a pasar imágenes de referencia para seguir ajustando tipografía y colores **sección por sección** (más allá del cambio global a verde oliva ya aplicado). Cuando lleguen esas imágenes: aplicar los cambios en **ambos** `documentos/index.html` y `documentos/invitacion/index.html` salvo que se indique lo contrario, y documentar cada ajuste en [[desarrollos]] / [[decisiones-tecnicas]] a medida que se confirme con el usuario.

## Abierto — `documentos/invitacion_casamiento.html` no recibió ninguno de los cambios recientes

Desde que se consolidó el trabajo en `documentos/index.html` (2026-07-10), `invitacion_casamiento.html` quedó congelado en una versión vieja: no tiene el sobre de apertura, ni la paleta oliva, ni el reordenamiento de secciones, ni el split de pago. Si alguien lo abre esperando ver el estado actual del proyecto, va a ver algo desactualizado. No se toca a propósito (ver [[decisiones-tecnicas]]) — solo dejar constancia de que existe y por qué está desactualizado.
