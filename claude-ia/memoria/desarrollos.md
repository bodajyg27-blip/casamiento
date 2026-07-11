# Desarrollos — Invitación de casamiento

Historial de features completadas sobre `documentos/index.html` y `documentos/invitacion/index.html` (archivos de trabajo actuales).

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
