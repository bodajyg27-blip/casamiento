# Desarrollos — Invitación de casamiento

Historial de features completadas sobre `index.html` e `invitacion/index.html` (**raíz del repo** — archivos de trabajo actuales desde el 2026-07-11, ver [[decisiones-tecnicas]]).

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
