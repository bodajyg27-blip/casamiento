# Desarrollos — Invitación de casamiento

Historial de features completadas sobre `index.html` e `invitacion/index.html` (**raíz del repo** — archivos de trabajo actuales desde el 2026-07-11, ver [[decisiones-tecnicas]]).

## 2026-10-13 — Robustez para ~150 invitados

- **Miniaturas en la galería** y **buscador de invitados en el servidor**: ver [[decisiones-tecnicas]]. **Requieren redeploy de Apps Script** (ver [[bugs-conocidos]]); el cliente funciona igual mientras tanto.
- **Caché del listado de la galería**: subir una foto ya no lo vacía; quien sube ve su foto al instante desde su propio navegador. Ver [[decisiones-tecnicas]]. También requiere el redeploy.
- **Rediseño de `galeria/`**: fondo claro con marco en relieve fijo detrás de la grilla, barra superior clara, nombres en Edwardian y textos de interfaz en Special Elite (igual que la invitación, el Save the Date y la TV). El lightbox sigue oscuro.
- **Rutas alternativas para las fotos**: la galería pasa sola a `lh3.googleusercontent.com` cuando Google bloquea la descarga directa. Ver [[bugs-conocidos]].
- **Botón "Verificar JSON" en `admin/`**: abre `GAS_URL?clave=...` (lista completa de invitados en crudo). No se usa un enlace `script.googleusercontent.com/macros/echo?...` porque son temporales.
- **Estado del sistema en `admin/`**: tarjeta con semáforo (servidor, lista de la galería, fotos en Drive, mensajes de video), tiempos de respuesta, pista según qué falla y revisión automática cada minuto. Solo lectura, no toca Apps Script.
- **Imágenes a WebP**: `sobre`, `fondoblancohorizontal`, `fondohorizontal`, `camara`, `fiesta`, `iglesia` (los fondos pesan ~80% menos). Los `.jpg`/`.png` originales siguen en `img/` sin uso, junto con `TARJETA.jpg`, `calendario.jpg`, `fondo.jpg` y `lugares.jpg`, que ninguna página activa referencia.
- **Tarjeta del QR** (`recursos-impresion/`, fuera del repo): rediseñada con el fondo en relieve y Special Elite + Edwardian; ahora tiene fuente HTML, PNG a 300 ppp y PDF. Mismo destino del QR que la anterior (verificado decodificándolo).

- **Mensajes de video**: la cola solo borra un video cuando aparece en el listado de Drive (antes se podía perder en silencio). Ver [[bugs-conocidos]].
- **Galería**: reintentos automáticos del listado, tandas que ya no se saltean ni se duplican, y galería oculta que no se revela si falla la consulta. Ver [[bugs-conocidos]]. Pendiente aparte: la grilla carga la foto completa (1600 px), no miniaturas.
- **Modo de `index.html`**: reintento + último modo recordado en `localStorage`, con pantalla instantánea para quien ya entró. Ver [[bugs-conocidos]].

## 2026-10-11 — Save the Date en streaming desde el repo

- **Video de Save the Date**: `index.html` dejó de bajarlo de Drive vía Apps Script (base64, no soportaba el archivo de 170 MB) y ahora lo reproduce en streaming desde `save_the_date/`, en 1080p (41,8 MB) o 720p (23,9 MB) según dispositivo/conexión. Ver [[decisiones-tecnicas]]. Probado en local con Chrome headless: ambas calidades, fallback entre ellas y aviso si fallan las dos.
- **Script nuevo**: `claude-ia/scripts/transcode-video.swift` para regenerar las versiones web del video.
- **Save the Date en celulares**: al reproducir en vertical el video pasa a horizontal (bloqueo de orientación en Android, rotación CSS en iPhone) y al terminar vuelve a la pantalla inicial. Ver [[decisiones-tecnicas]].
- **Pantalla inicial del Save the Date**: pasó del fondo oscuro al fondo claro con marco en relieve (`img/fondoblancohorizontal.jpg`) y a las tipografías de la portada de la invitación (Special Elite + Edwardian).
- **Pantalla inicial de `tv/`**: mismo rediseño que la del Save the Date (fondo claro en relieve, Special Elite + Edwardian). El slideshow en sí no cambió.

## 2026-08-26 — Mensajes de video, TV, split por tipo de invitado y panel de admin

Sesión larga con varias features nuevas, en orden aproximado:

- **`mensaje/index.html`**: página de grabación de "Dejanos un mensaje" para dejar en un iPad en modo kiosko (Acceso Guiado) durante el evento. Cámara en óvalo, grabación espejada (canvas, ver [[decisiones-tecnicas]]), tope de 30s, detección de mute de audio, cola de subida con IndexedDB para no perder mensajes sin conexión. Subida a Drive vía el Apps Script (`addMensaje`).
- **`tv/index.html`**: slideshow a pantalla completa de fotos + mensajes de video para transmitir a la TV del salón (Chromecast/AirPlay), con `?modo=fotos`/`?modo=videos`, timeout y vigilante anti-traba (ver [[bugs-conocidos]] por la regresión que sufrió).
- **`admin/index.html`** (originalmente `mensaje/admin.html`, luego movida a `admin/`): panel con clave para ver/borrar mensajes de video y, más tarde, también fotos de la galería (`borrarFoto` nuevo en el backend). Reestructurado a menú-primero con vistas bajo demanda — ver [[decisiones-tecnicas]].
- **Seguridad**: la clave de admin pasó de estar hardcodeada en el JS a vivir en la pestaña `Config` del Sheet, validada server-side (`claveValida()`). Se protegió `borrarMensaje`, `borrarFoto` y `setModoIndex`; **no** se protegió `getMensajes`/`getMensajeVideo` porque `tv/` los necesita en público (ver [[bugs-conocidos]] por la regresión inicial).
- **Split de la invitación por tipo de invitado**: `index.html` pasó de ser la invitación completa a ser una puerta de entrada (sobre + buscador) que redirige a `familiar/index.html` (sin regalo) o `invitacion/index.html` (con regalo) según la nueva columna `Tipo` del Sheet. Ver [[decisiones-tecnicas]].
- **Modo de `index.html`**: agregado un switch en `admin/` para elegir qué muestra la puerta de entrada — invitación normal, video de "Save the Date" (toque para reproducir con sonido) o redirección directa a la galería (pensado para la noche posterior a la boda).
- **Secciones nuevas** (sincronizadas en `familiar/` e `invitacion/`): carrusel "Nuestra historia" (fotos propias en Drive, orden por nombre de archivo, precargadas en `sessionStorage` desde `index.html`), Itinerario (mockup de horarios) y Dress Code (texto + íconos SVG dibujados a mano de vestido/traje).
- **Cierre automático de RSVP y sugerencia de canciones**: ambas secciones se ocultan solas 15 días antes de la boda, mostrando un mensaje de "plazo cerrado" (chequeo client-side contra el reloj del dispositivo).
- **Galería**: rediseño app-like (header, FAB de subida, lightbox) y fix del botón "Volver" para que use el historial del navegador en vez de un link fijo a `index.html`.

Ver [[decisiones-tecnicas]] para el detalle de cada decisión de diseño y [[bugs-conocidos]] para los bugs encontrados y resueltos en el camino.

## 2026-07-12 — Optimización de peso de imágenes

`img/` pesaba ~16.6 MB en total, con dos archivos PNG desproporcionados: `sobre.png` (2.8M, la primera imagen que carga cualquier visitante, como `background-image` del sobre a pantalla completa) y `alianzas.png` (3.3M, usada solo como ícono de 1.6em en el footer). Ninguna imagen tenía `width`/`height` ni `loading="lazy"`.

Cambios (con Pillow, `img.save()`, no había `cwebp`/`pngquant` instalados):
- `sobre.png` → `sobre.jpg` (calidad 85): no tenía transparencia real (era RGB, no RGBA), así que JPEG es directamente mejor. 2.8M → 360K.
- `alianzas.png` → `alianzas.webp`: sí tiene transparencia real, así que se mantuvo con WebP (soporta alpha y comprime mucho mejor que PNG). Redimensionada de 1844×2304 a 500×624 antes de exportar, porque se muestra a 1.6em de alto — no tiene sentido servir la resolución completa. 3.3M → 23K.
- `fondoblanco.jpg` (305K) eliminada: había quedado huérfana desde que se sacó la sección "NOMBRES" duplicada (ver entrada del sobre click-based).
- `width`/`height` agregados a todos los `<img>` (evita layout shift mientras cargan) y `loading="lazy"` a las que están debajo del fold (calendario, lugares, footer). La portada (`TARJETA.jpg`) y el sobre (CSS background) quedaron sin lazy porque son lo primero que se ve.
- Resultado: `img/` pasó de ~16.6 MB a ~1.4 MB.

Ver [[decisiones-tecnicas]] para el criterio de cuándo usar JPEG vs WebP en este proyecto.

## 2026-07-09 — Setup inicial del repo

- Commit inicial (`first commit`) con `.vscode/settings.json`, `documentos/AppsScript_RSVP.gs` y `documentos/invitacion_casamiento.html`.
- Reconfigurado para trabajar bajo la cuenta `bodajyg27-blip`:
  - `git config user.name/email` locales → `bodajyg27 <bodajyg27@gmail.com>`.
  - `origin` apuntando a `https://github.com/bodajyg27-blip/casamiento.git`.
  - Commit inicial reescrito (`git commit --amend`) para quedar autorado por `bodajyg27`.
  - Push exitoso una vez generado un Personal Access Token de esa cuenta (el token anterior guardado en el keychain era de otra cuenta de GitHub).

## 2026-07-10 — Sección "Guardá la fecha" (calendario)

- Antes: la fecha ("23 de octubre de 2027") se mostraba como texto plano dentro de la portada.
- Ahora: sección propia con un calendario visual del mes (octubre 2027), día 23 resaltado, generado dinámicamente por JS (`renderCalendar(year, monthIndex, highlightDay)` en el `<script>` de `index.html`).
- La hora (19:00 hs) se movió junto al calendario.

## 2026-07-10 — Canciones: aislar por pestaña (sessionStorage)

- Antes: `loadSongs()` traía **todas** las canciones ya cargadas por cualquier invitado desde el Google Sheet al abrir la página.
- Ahora: la lista visible se guarda en `sessionStorage` (clave `misCanciones`). Sobrevive a un refresh de la misma pestaña, pero una pestaña nueva arranca vacía — no ve lo que cargaron otros invitados ni lo que cargó la misma persona en otra pestaña.
- El POST al Google Sheet se mantiene sin cambios: la pareja sigue recibiendo todas las canciones en la planilla, solo cambió qué ve cada invitado en pantalla.
- Ver [[decisiones-tecnicas]] para el porqué de `sessionStorage` vs `localStorage`.

## 2026-07-10 — `index.html` como archivo de trabajo oficial

- Apareció `documentos/index.html` (duplicado de `invitacion_casamiento.html`, con el `<title>` en otro orden) — necesario porque GitHub Pages sirve `index.html` por defecto.
- Se sincronizó el contenido completo de `invitacion_casamiento.html` → `index.html`.
- Decisión del usuario: a partir de acá se trabaja **solo en `index.html`**. `invitacion_casamiento.html` queda como archivo histórico, sin más ediciones.
- Repo con divergencia local/remoto sin resolver — ver [[bugs-conocidos]].

## 2026-07-10 — Protección básica anti-spam en canciones

- `AppsScript_RSVP.gs` → `addCancion()`: el texto de la canción se recorta a 50 caracteres (`.trim().slice(0, 50)`) antes de guardarse en el Sheet.
- `index.html`: `maxlength="50"` en el input de canción, para que el límite se vea reflejado en la UI.
- La confirmación de asistencia (`confirmarInvitado`) ya estaba protegida de por sí: solo actualiza si el nombre existe en la planilla de invitados.
- Se evaluó (y se descartó por ahora) ofuscar `GAS_URL` — no sirve como protección real porque la URL siempre es visible en la pestaña Network al hacerse el `fetch`. Ver [[decisiones-tecnicas]].

## 2026-07-10 — Reordenamiento de secciones + placeholder de foto

- Sección 1 (portada): ahora solo "Nos casamos" + nombres + descripción + un placeholder circular de anillos (SVG dibujado a mano, mismos tonos dorado/marrón de la paleta original) en el lugar donde después va la foto real de la pareja.
- Sección 2: "Guardá la fecha" (calendario), sin cambios de contenido, solo de posición.
- Sección 3 (nueva): "Dónde celebramos" — contiene lo que antes estaba en la portada (dirección + mapa embebido de Google Maps).
- Pendiente: reemplazar el SVG de los anillos por una foto real de la pareja en cuanto el usuario la provea (no se puede generar/traer una foto real sin que el usuario la suministre). Ver [[bugs-conocidos]].

## 2026-07-10 — Reordenamiento final: regalo/tarjeta al final

- La sección "Nuestro regalo de bodas" (antes 5ª) pasó a ser la **última** sección antes del footer, después de "Dejá tu canción".
- Orden final en ese momento: Portada → Guardá la fecha → Dónde celebramos → RSVP → Canción → Regalo/Tarjeta → footer.

## 2026-07-10 — Split de archivos: `index.html` (sin pago) vs `documentos/invitacion/index.html` (con pago)

- Se creó la carpeta `documentos/invitacion/` con `index.html` como **copia completa e intacta** de `documentos/index.html` en ese momento (incluye la sección de pago).
- En `documentos/index.html` (principal) se **quitó** la sección "Nuestro regalo de bodas" y la función JS `copyAlias()` asociada (quedaba sin uso).
- A partir de acá hay **dos variantes que conviven y se editan en paralelo**: `documentos/index.html` (sin métodos de pago — para compartir más ampliamente) y `documentos/invitacion/index.html` (con métodos de pago — versión completa). Cualquier cambio de diseño/estructura/estilo debe aplicarse a **ambos archivos**, salvo la sección de pago en sí.

## 2026-07-10 — Orden de nombres: Julieta primero en todos lados

- Decisión del usuario: en toda la invitación el orden correcto es **"Julieta & Gabriel"** (no "Gabriel & Julieta").
- Aplicado en ambos archivos: `<title>`, nombres de la portada, sobre de apertura, footer.
- Excepción intencional: "Titular: Gabriel Oros" en la sección de pago (`invitacion/index.html`) no se tocó — es el nombre real del titular de la cuenta bancaria, no una mención de la pareja.

## 2026-07-10 — Sobre de apertura a pantalla completa

- Reemplaza la portada como primer elemento visible: un overlay fijo a pantalla completa que cubre todo el sitio hasta que el usuario hace click/tap.
- Diseño (inspirado en una referencia visual que pasó el usuario, adaptado a la paleta del sitio): panel superior de color sólido con "Nos casamos" + nombres en script (`Great Vibes`), borde inferior festoneado tipo encaje (truco CSS con `radial-gradient` repetido), sello ovalado centrado sobre el borde festoneado con una flor tipo cala grabada + iniciales, texto "Tocá para abrir la invitación" al pie.
- Interacción: bloquea el scroll de fondo (`document.documentElement.style.overflow = 'hidden'`) hasta el click. Al hacer click se dispara un **efecto de apertura** (no solo un fade): el panel superior se desliza hacia arriba y desaparece (`transform: translateY(-115%)`), el sello se encoge/rota/desvanece, el hint se desvanece rápido, y recién con un delay (`transition-delay: 0.7s`) se desvanece el resto del overlay revelando la invitación.
- El resto de las secciones sigue apareciendo al hacer scroll gracias al `IntersectionObserver` ya existente (clase `.reveal` / `.visible`) — no hubo que tocar esa parte.
- Implementado de forma idéntica en `index.html` e `invitacion/index.html`.

## 2026-07-10 — Cuenta regresiva en vivo (días/horas/min/seg)

- Antes: contador simple actualizado cada 60s, mostrando solo "Faltan X días y Y horas" en un solo `<div>` de texto.
- Ahora: 4 bloques (`#cdDays`, `#cdHours`, `#cdMins`, `#cdSecs`) que se actualizan cada segundo (`setInterval(update, 1000)`), con horas/min/seg con padding a 2 dígitos.
- Vive dentro de la sección "Guardá la fecha", debajo de "19:00 hs".

## 2026-07-10 — Paleta de colores: de marrón/dorado a verde oliva

- Se reemplazó sistemáticamente **toda** la paleta de colores del sitio (fondo, tarjetas, botones, calendario, contador, RSVP, canciones, sello del sobre, etc.) de tonos marrón/dorado/crema a una familia de verdes oliva.
- Mapeo de colores aplicado (ver [[decisiones-tecnicas]] para el detalle completo) — aplicado con `sed` sobre ambos archivos por igual, reemplazo exacto de códigos hex.
- **No se tocó**: el filtro `sepia()` del iframe de Google Maps (riesgo de afectar la legibilidad del mapa real) y "Titular: Gabriel Oros" en la sección de pago (dato real, no parte del theme).
- Pendiente anunciado por el usuario: van a pasar imágenes de referencia para seguir ajustando tipografía y colores **por sección** — este documento se actualiza a medida que eso avance.

## 2026-07-11 — Migración de archivos: `documentos/` → raíz del repo

- El remoto ya tenía una copia de la invitación en la raíz (creada/editada directo desde GitHub, con `.github/workflows/static.yml` para Pages). Tras varios merges, el usuario decidió consolidar **todo** el trabajo en `index.html` e `invitacion/index.html` de la **raíz**, no en `documentos/`.
- `documentos/index.html`, `documentos/invitacion/index.html` y `documentos/invitacion_casamiento.html` quedan **congelados**, no se editan más. Ver [[decisiones-tecnicas]].

## 2026-07-11 — Regalo de bodas dinámico desde el Sheet

- `AppsScript_RSVP.gs`: nuevo endpoint `?tipo=regalo`, lee la pestaña **"Regalo"** del mismo Sheet (formato clave/valor: `Monto`, `Titular`, `Banco`, `CBU`, `Alias`).
- `invitacion/index.html`: la sección de regalo carga esos datos vía `fetch` al abrir la página (`loadRegalo()`) y los pinta en `#giftAmount`, `#giftTitular`, etc. El botón "Copiar alias" copia el alias real recibido, no un valor fijo.

## 2026-07-11 — Galería de fotos (Google Drive + Apps Script)

- Página nueva **`galeria/index.html`**: sube fotos (redimensionadas a máx. 1600px en el navegador antes de subir) y las lista en grilla, con descarga individual.
- Backend: `?tipo=galeria` (GET, lista archivos de una carpeta de Drive) y `{tipo:'foto'}` (POST, sube un archivo). Las fotos se sirven **en base64 dentro de un JSON**, no como blob binario directo — Apps Script no admite devolver un blob crudo desde `doGet` (tirapa error "valor de retorno no admitido"), y el sharing público de Drive tampoco andaba de forma confiable. El cliente arma la imagen con `data:` URI. Ver [[decisiones-tecnicas]].
- Enlace agregado en `index.html` e `invitacion/index.html`: sección "Fotos del casamiento" → botón "Ver galería".
- Requiere que el usuario autorice permisos de Drive manualmente la primera vez que se usó cada función nueva (`getGaleria`, luego `addFoto`) — Apps Script no re-pide autorización automáticamente al agregar código que usa un scope nuevo.

## 2026-07-11/12 — Reemplazo de secciones codeadas por imágenes de diseño, con overlays interactivos

El usuario empezó a proveer imágenes de diseño (mismo estilo "papel grabado" oliva) para reemplazar secciones armadas con CSS/JS:

- **Portada** (`img/TARJETA.jpg`): reemplaza kicker+nombres+mensaje armados en HTML.
- **Calendario** (`img/calendario.jpg`): reemplaza el calendario armado con JS. La cuenta regresiva quedó como **overlay HTML superpuesto** sobre la imagen (`.countdown-overlay`), en el espacio vacío debajo de los números dibujados.
- **Lugar** (`img/lugares.jpg`): reemplaza el mapa embebido. Tiene dos botones **invisibles** superpuestos sobre los "CÓMO LLEGAR" dibujados (Ceremonia y Fiesta, medidos con Python/Pillow para que el área clickeable coincida exactamente), más overlays de texto ("19:00 -- Iglesia", "20:30 hs") tapando los placeholders "HORA"/"HORA -- LUGAR" de la imagen con un color de fondo muestreado a mano para que no se note el parche.
- **Fondo con textura** (`img/fondo.jpg`): aplicado como fondo de las tarjetas de RSVP, Canción, Galería y Regalo (clase `.card-fondo`), con los textos internos reclareados para mantener contraste.
- Técnica general para "tapar texto de una imagen y poner HTML encima": usar Python/Pillow para (1) ubicar la banda de píxeles oscuros/claros del texto a tapar, (2) muestrear el color de fondo alrededor, (3) pintar un rectángulo de ese color sobre el original, (4) superponer el texto real en HTML en esa posición, animado igual que el resto.

## 2026-07-12 — Tipografía real: Edwardian Script ITC

- El usuario subió `fonts/Edwardian.ttf`. Se carga con `@font-face` en `index.html` e `invitacion/index.html` (ruta relativa `fonts/` vs `../fonts/`).
- Reemplaza a Tangerine (que a su vez había reemplazado a Great Vibes, alternativas gratuitas usadas antes de tener el archivo real). Aplicado a: nombres del sobre, `h2.section-title`, `.section-sub`, nombre de invitado encontrado, nombre seleccionado en restricciones, y el overlay de nombres de la portada.
- Sin variante bold — se usa `font-weight: normal` en todos lados (forzar 700 generaría un "bold falso" feo en una fuente script).

## 2026-07-12 — Sistema de animación en dos niveles: `.visible` (tarjeta) y `.centered` (datos internos)

- Antes: un solo `IntersectionObserver` (threshold 0.15) agregaba `.visible` a toda `.reveal` y listo — sin distinguir "la tarjeta ya asomó" de "la tarjeta está bien centrada".
- Ahora: el mismo observer también agrega/saca la clase `.centered` según `intersectionRatio >= 0.5`. Los **datos internos** de cada sección (contador, "19:00 -- Iglesia"/"20:30 hs", monto, nombres de la portada) usan `.reveal.centered X` en vez de `.reveal.visible X`, con `transition-delay` escalonado por elemento — así se animan recién cuando la sección está bien centrada, no apenas asoma, y **se repiten cada vez** que la sección vuelve a centrarse (el observer hace `classList.toggle`, no solo `add`).
- Aplicado a: `.countdown-unit`, `.hora-lugar-ceremonia`, `.hora-fiesta`, `.gift-amount`, `.bank-box`, y el overlay de nombres de la portada.

## 2026-07-12 — Bug: animación de nombres de la portada no se veía

- Causa real (no era caché ni bug de CSS): la primera sección (portada) marcaba `.centered` **apenas cargaba la página**, mientras el sobre de apertura todavía tapaba toda la pantalla. La animación completa (menos de 2s) terminaba de reproducirse *detrás* del sobre — para cuando el usuario lo abría, ya estaba en su estado final, se veía estática.
- Fix: la primera sección **no se observa desde el arranque**. Recién se empieza a observar (con el mismo `IntersectionObserver` que las demás) cuando el usuario abre el sobre (`revealFirstSection()`, llamada desde el handler de click del sobre). A partir de ahí se comporta como cualquier otra sección — se repite cada vez que se recentra.
- Se probaron y descartaron en el camino: doble `requestAnimationFrame` solo (no alcanzaba, el problema no era de timing de paint sino de *cuándo* se disparaba respecto al sobre), y una animación de apertura tipo scroll-scrub del sobre (revertida, ver [[decisiones-tecnicas]]).

## 2026-07-12 — Sobre de apertura: iteraciones de diseño

Varias vueltas sobre el mecanismo de apertura del sobre, terminó así:

1. Diseño codeado (panel + sello SVG) → reemplazado por foto real (`img/sobre.png`).
2. Se probó una solapa animada 3D (`rotateX` + `perspective`, imitando una secuencia de fotos de referencia) — el usuario la encontró fea, se revirtió por completo.
3. Se probó apertura ligada al scroll (el sobre se iba desvaneciendo en proporción al `scrollY`, sin click) — funcionaba pero el usuario prefirió volver al modelo de **click/tap** original.
4. Estado final: click/tap sobre el sobre → `classList.add('open')` → fade + scale leve (`transition: opacity/transform 0.6s`) → libera el scroll del body → dispara `revealFirstSection()`.
5. Nombres del sobre animados en secuencia (Julieta → & → Gabriel, con `<span>` individuales y `animation-delay` escalonado vía `@keyframes envelopeTextIn`), disparados por `animation-delay` fijo al cargar la página (no dependen del `.centered` de scroll, porque el sobre en sí ya está visible desde el arranque).
6. `history.scrollRestoration = 'manual'` + `scrollTo(0,0)` al principio del script, para que el navegador no restaure el scroll de la visita anterior al recargar (evita ver el sobre "a medio abrir" un instante antes de que corra el JS).

## 2026-07-12 — Portada: nombres reales tapando el texto de la imagen

- `img/TARJETA.jpg` tenía "Julieta & Gabriel" dibujado dentro de la imagen. Se tapó con un parche de color (Python/Pillow, color muestreado del fondo real de la tarjeta) y se puso el texto real en HTML encima (mismas clases `.nombres-overlay`/`.nombres-part`/`.nombres-amp` que se usaron en una sección "Nombres" intermedia que se probó con `img/fondoblanco.jpg` y después se **sacó** por quedar redundante).
- Con esto, la portada tiene el mismo efecto de aparición escalonada de nombres que el resto de las secciones "centradas".

## 2026-07-12 — Procesamiento de imágenes con Python (Pillow + scipy)

Varias imágenes provistas por el usuario venían con fondos que no eran transparentes de verdad (canal alpha en 255 aunque mostraran un patrón cuadriculado tipo "checkerboard" pintado en el RGB, no transparencia real):

- `img/alianzas.png`: se detectó el fondo (píxeles de baja saturación) y se usó `scipy.ndimage.label` para identificar componentes conectados — se removió el fondo externo **y** los huecos internos de los anillos (que al no tocar el borde de la imagen no se habían sacado en el primer intento), con un leve desenfoque gaussiano en el borde del recorte para evitar un halo duro. Usada en el footer ("Julieta & Gabriel 💍 23.10.2027").
- Antes de confiar en el resultado, siempre conviene **componer la imagen sobre un color sólido** (no dejarse engañar por el checkerboard que el visor de imágenes muestra tanto para "transparencia real" como, a veces, para contenido opaco cuadriculado) para confirmar visualmente que el fondo es transparente de verdad.

## 2026-10-19 — Migración de fotos y mensajes a Cloudflare R2

- Nuevo `worker/` (Worker `boda-media` + `wrangler.jsonc`), probado en local con R2 simulado (subidas, listado paginado, miniaturas, Range en videos, borrado con clave inválida) y publicado; responde en `https://boda-media.bodajyg.workers.dev`.
- `galeria/`, `mensaje/`, `tv/` y `admin/` usan `MEDIA_URL` (el Worker) en vez de Apps Script para fotos y videos. Se quitaron las rutas alternativas de Drive (`lh3.googleusercontent.com`) y el proxy base64.
- Las fotos y videos que estaban en Drive no se migraron (eran de prueba).
- El carrusel también pasó al Worker (`/carrusel`), y `AppsScript_RSVP.gs` quedó solo con el Sheet (de 765 a ~300 líneas, sin `DriveApp`).
- Pendiente: probar en el navegador de punta a punta; que el usuario publique el Worker, suba las fotos del carrusel a R2, publique el script nuevo y borre en Google la API key de Drive y las carpetas.

## 2026-10-19 — Admin reordenado + respaldo en Drive

- `admin/` menú principal por secciones: Estado, Contenido (fotos/mensajes con el total al lado), Pantalla del salón (los 3 accesos a `tv/`, antes íconos sueltos en la barra), Sitio web (modo + visibilidad en una tarjeta), Respaldo, Herramientas.
- Botón **Sincronizar** (sección Respaldo): llama a `sincronizarDrive()` del Apps Script (POST `tipo: "sincronizarDrive"` + clave), que copia a la carpeta "Casamiento J&G - Respaldo" (subcarpetas Fotos y Mensajes, ID en Config → `CarpetaRespaldo`) lo que el Worker tiene y Drive no. Detecta lo ya copiado por el id al final del nombre del archivo. Cada llamada trabaja ~90 s; el admin repite hasta que no falte nada. Solo copia, nunca borra.
- Requiere autorizar Drive + UrlFetch: correr `autorizarRespaldo()` desde el editor **antes** de publicar la versión nueva. Ver [[bugs-conocidos]].

## 2026-10-19 — Carga del carrusel desde el admin

- `admin/` → Contenido → **Carrusel «Nuestra historia»**: lista las fotos en orden (número, miniatura, ver, borrar) y botón **Cargar fotos** (varias a la vez). Cada foto se prepara en el navegador: HEIC → JPEG con `heic2any` si el navegador no lo abre, y se achica a 1600 px en WebP (JPEG si no hay WebP). Se suben en orden de nombre de archivo.
- Worker: `POST /carrusel` (FormData `foto` + `clave`, valida la clave contra Apps Script, solo jpeg/png/webp) guarda `carrusel/<n>-<base36>.<ext>` con n = mayor + 1; el sufijo evita reutilizar nombres (las fotos de `/c/` se cachean 1 h). `POST /borrar` acepta `tipo: "carrusel"` con el nombre como id.
- No hay reordenar: para cambiar el orden, borrar y volver a cargar.

## 2026-10-19 — Fotos repetidas (galería y carrusel)

- El navegador calcula el SHA-256 del archivo **original** (antes de convertirlo) y lo manda como `hash`. Detecta el mismo archivo elegido otra vez; no una copia reenviada por WhatsApp o exportada en otro formato.
- Galería: el Worker guarda una marca `huellas/<hash>` en `boda-fotos` y la consulta con `head()` (no el listado, que es grande y está en memoria); responde 409 `repetida`. Al borrar una foto se borra su marca (el hash va en el customMetadata de la foto). La página saca la foto de la cola y avisa "ya estaba en la galería"; además no encola dos veces el mismo archivo. Las 15 fotos subidas antes del cambio no tienen huella.
- Carrusel: el hash va en el customMetadata de cada foto y se compara contra el listado del carrusel (pocas fotos); el admin saltea las repetidas antes de convertirlas.
- En los dos, sin `hash` (página vieja en caché) se sube igual, sin control. Probado con `wrangler dev` (R2 local + Apps Script simulado).

## 2026-10-19 — Uso del plan gratis de Cloudflare en el admin

- Tarjeta "Plan gratis de Cloudflare" (sección Estado) con barras: pedidos al Worker hoy (100.000/día, reinicio 00:00 UTC = 21:00 AR), almacenamiento R2 (10 GB), operaciones clase A (1M/mes) y clase B (10M/mes). Amarillo ≥ 70 %, rojo ≥ 90 %. Se actualiza con el semáforo (cada minuto).
- Worker `POST /uso` (con clave): el almacenamiento se suma listando los buckets (la analítica llega atrasada); pedidos y operaciones salen de la API GraphQL de analítica (`r2OperationsAdaptiveGroups`, `workersInvocationsAdaptive`). Clasificación A/B según la página de precios de R2; lo desconocido cuenta como A. Resultado en memoria 60 s.
- Requiere el secreto **CF_API_TOKEN** (token de Cloudflare con *Account Analytics: Read*): `npx wrangler secret put CF_API_TOKEN` desde `worker/`. `CF_ACCOUNT_ID` está en `wrangler.jsonc`. Sin token, la tarjeta muestra solo el almacenamiento y lo avisa.

## 2026-10-19 — Avance visible en Sincronizar

- `sincronizarDrive()` trabaja tandas de ~20 s (`RESPALDO_TIEMPO_MAX_MS`, antes 90 s) para que el admin actualice el avance seguido. El panel muestra "Copiando… X de Y en Drive (NN %) · se copiaron N en esta sincronización" y la barra con el tramo pendiente animado mientras el script trabaja. El porcentaje cuenta también lo que ya estaba en Drive. Probado con un Apps Script simulado (25 → 50 → 75 → 100 %).
- Para que tome efecto hay que pegar el `.gs` y publicar una **nueva versión** (misma URL); no pide permisos nuevos.

## 2026-10-19 — Admin rediseñado con pestañas + invitados y regalo editables

- `admin/index.html` reescrito: cinco pestañas (Inicio, Invitados, Contenido, Regalo, Sistema), barra inferior en celular y lateral en escritorio. Se conserva todo lo anterior (clave, semáforo, switches, mensajes, fotos, carrusel con conversión HEIC, uso de Cloudflare, respaldo en Drive).
- **Invitados** (Apps Script, con clave): `adminListarInvitados`, `adminGuardarInvitado`, `adminBorrarInvitado`. Lista con búsqueda sin acentos y filtros, hoja de edición (nombre, tipo, confirmó, restricciones, detalle), agregar, borrar y exportar CSV. Se identifica por número de fila **y** nombre original (`filaDeInvitado`): si la lista cambió, busca por nombre; si no aparece, error "recargá". Rechaza nombres repetidos (`confirmarInvitado` busca por nombre). La fecha de confirmación se conserva al editar y se borra al desconfirmar. Las restricciones son las del formulario de la invitación (Celiaquía, Diabetes, Vegetariano, Intolerancia, Otros).
- **Regalo**: `adminGuardarRegalo` actualiza solo las filas Monto/Titular/Banco/CBU/Alias de la pestaña "Regalo" (agrega las que falten, no toca otras), el CBU se guarda como texto (ceros iniciales) y exige 22 dígitos; Alias en mayúsculas. Vista previa de cómo lo ven los invitados.
- **Candado**: las ediciones y `confirmarInvitado` usan el candado del script (borrar corre las filas). Por eso `sincronizarDrive` pasó a usar una bandera en CacheService (`sync_en_curso`) y no el candado: si no, una sincronización bloquearía las confirmaciones.
- **Carrusel**: se puede subir con cualquier nombre (el Worker asigna el siguiente número) y reordenar con flechas: `POST /carrusel/orden` en el Worker (R2 no renombra: relee todo, guarda con el número nuevo y recién después borra los viejos; exige que sea el mismo conjunto de fotos).
- **Fotos**: grilla con "Ver más", visor con anterior/siguiente y borrado, selección múltiple para borrar varias.
- Gotcha: el campo `tipo` de los pedidos al script lleva el nombre de la acción; el tipo del invitado viaja como `tipoInvitado` (con el mismo nombre se pisaban y el servidor no reconocía el pedido).
- Probado: funciones del script con un Sheet simulado en Node (`doPost` NO está cubierto por esa prueba: el bug de `tipo` lo encontró el recorrido en Chrome) y recorrido completo en Chrome contra un Worker local (wrangler dev) y un Apps Script simulado: 39 verificaciones (invitados, regalo, fotos, carrusel con un HEIC real, sistema). **Falta probar contra el Apps Script y el Sheet reales** una vez publicado.

## 2026-10-19 — Borrar con menos riesgo de tocarlo sin querer (admin)

- Todos los borrados del panel ya pedían confirmación (`confirmar()`). Ahora, además: el aviso ignora cualquier toque que llegue en los primeros 600 ms (un doble toque o el mismo toque que lo abrió no confirma) y el botón dice "Sí, borrar" en el caso de invitados. En la hoja de edición de un invitado, "Borrar invitado" quedó aparte, abajo y lejos de "Guardar".
- Probado en Chrome: el aviso abre, un toque inmediato no borra, Cancelar no borra y deja la hoja abierta, y confirmando tras una pausa sí borra.

## 2026-10-19 — Alta rápida de invitados (admin)

- Botón **Agregar** en la cabecera de la lista de Invitados (y el **+** flotante) abre un popup chico con solo nombre y tipo (Familiar/Invitado, por defecto Invitado). Se envía como `adminGuardarInvitado` sin `nombreOriginal` (confirmó = no, sin restricciones); lo demás se completa después editando. Valida nombre vacío y repetido (el popup queda abierto para corregir), limpia la búsqueda y el filtro, y resalta al recién agregado. La hoja completa queda solo para editar. Probado en Chrome (12 verificaciones).

## 2026-10-19 — Columna "Pagado" (solo admin)

- Columna **F** de la pestaña Invitados (estaba "sin uso"; menú desplegable en el Sheet con `SI`, `NO`, `AUN NO CONFIRMADO`). El script la busca por un encabezado que contenga "pag" y, si no hay, usa la F (`columnaPago()`); nunca una de las columnas que ya usan otra cosa.
- Es un dato interno: viaja solo en `adminListarInvitados` / `adminGuardarInvitado` (con clave). `leerInvitados()`, `buscarInvitado()` y `getInvitados()` devuelven campos explícitos (nombre, confirmado, tipo), así que no llega a la tarjeta del invitado ni al JSON público; el CSV del panel tampoco lo incluye, y no hay filtro ni columna en la lista. Solo se ve en el detalle del invitado (selector "Pagado").
- Todo invitado nuevo se crea con `AUN NO CONFIRMADO` (`PAGO_POR_DEFECTO`), venga del popup de alta rápida o de la hoja completa. Editar: el panel manda `pago` solo si se cambió; el servidor valida contra `PAGO_VALORES` y, si no llega, no toca la celda. Un valor que no esté en la lista (o vacío) se muestra tal cual en el selector y no se pisa.
- `confirmarInvitado()` (confirmación desde la web) NO toca esta columna.
- Probado: funciones del script con Sheet simulado (por defecto, no filtrado en buscador/lista, sin pisar, inválido rechazado, encabezado en otra columna) y 12 verificaciones en Chrome. Requiere publicar el `.gs` nuevo.

## 2026-10-19 — El desplegable de "Pagado" en las filas nuevas

- Las filas que crea el panel con `appendRow` no heredaban la validación de datos (el desplegable de F; tampoco otras como casillas de verificación). `copiarValidaciones()` copia la validación de toda la fila de arriba (`PASTE_DATA_VALIDATION`, así conserva el estilo del Sheet) y, si ahí no hay ninguna, arma la lista `SI / NO / AUN NO CONFIRMADO`. Si falla, el invitado igual queda guardado y el error va a la pestaña "Errores".
- `repararListasPago()`: se corre UNA vez a mano desde el editor de Apps Script para ponerles el desplegable a las filas que ya se habían agregado sin él (toma el de la fila más cercana de arriba que lo tenga).
- Probado con un Sheet simulado (herencia, lista de respaldo, falla al copiar, primera fila, reparación). Requiere publicar el `.gs`.

## 2026-10-19 — Columna "Capitán" (admin)

- Columna del Sheet con una **C** para los invitados que son capitanes (vacío = no). Se busca por el encabezado (que contenga "capit", sin importar tildes ni mayúsculas) porque no tiene lugar fijo (`columnaCapitan()`); si no existe, `adminListarInvitados` devuelve `capitanDisponible: false` y el panel no muestra el campo ni se escribe nada.
- En la lista del panel, una **cinta naranja con una C** (`.cinta`) al lado del nombre de los capitanes. En el detalle, un selector **Capitán SI / NO**: SI escribe `C` en el Sheet, NO la borra (`capitan` boolean; solo viaja si se cambió, el servidor ignora cualquier valor que no sea true/false). Invitado nuevo: vacío.
- Dato interno como Pagado: no sale por `buscarInvitado`/`getInvitados`/JSON público ni por el CSV. `confirmarInvitado` no lo toca. `copiarValidaciones()` copia las validaciones de la fila de arriba hasta esta columna.
- Probado: funciones del script con Sheet simulado (C/c, marcar, desmarcar, sin mandar, nuevo, columna en otro lugar, sin columna) y 13 verificaciones en Chrome. Requiere publicar el `.gs`.

## 2026-10-19 — Exportar solo Nombre, Restricciones y Detalle

- El CSV de Invitados (botón Exportar) lleva únicamente `Nombre`, `Restricciones` y `Detalle` (todos los invitados, una fila cada uno). Se sacaron Tipo, Confirmó y Fecha; Pagado y Capitán ya no iban. Sigue con BOM para que Excel abra bien los acentos.

## 2026-10-19 — Confirmar asistencia: el admin puede confirmar, no desconfirmar; Pagado pasa a NO

- **Pagado = NO al confirmar**: `pagoAlConfirmar()` (común a `confirmarInvitado` y al admin): si Pagado está en `AUN NO CONFIRMADO` o vacío pasa a `NO`; un `SI` (o un `NO`) ya puesto no se toca, y confirmar dos veces no cambia nada.
- **Admin**: puede CONFIRMAR (como si el invitado lo hiciera: `confirmado: true` pone B = verdadero, C = fecha de ese momento y aplica la regla de Pagado; si en el mismo guardado se elige un pago explícito, gana ese) pero NO desconfirmar: un `confirmado: false` se ignora en el servidor y no se puede borrar la fecha. Un invitado nuevo sale sin confirmar salvo que se pida confirmarlo.
- **Panel**: en el detalle, si el invitado no confirmó hay un interruptor «Confirmó asistencia»; prenderlo solo lo deja pedido (se puede volver a apagar antes de guardar) y **al tocar Guardar** pregunta «¿Confirmar la asistencia de X?» (botón «Sí, confirmar»; aclara que no se puede desconfirmar y que Pagado pasa a NO). Si dice que no, no se guarda nada y la hoja sigue abierta. Una vez confirmado, el detalle muestra «SÍ» fijo y «no se puede desconfirmar desde el panel», sin interruptor. El panel manda `confirmado` solo para confirmar. El alta rápida (popup) crea siempre sin confirmar.
- Probado: funciones del script con Sheet simulado (confirmar, no desconfirmar, SI no se pisa, pago explícito, nuevo, fecha) y 12 verificaciones en Chrome. Requiere publicar el `.gs`.
