# Decisiones técnicas — Invitación de casamiento

## sessionStorage (no localStorage) para las canciones

**Decisión:** la lista de canciones que ve cada invitado se guarda en `sessionStorage`, no en `localStorage` ni trayéndola del Google Sheet.

**Por qué:** el requerimiento era "que cada uno vea las canciones que agregó, pero que si abre otra pestaña no vea las que ya cargaron [otros, o él mismo en otra sesión]". `localStorage` se comparte entre todas las pestañas del mismo origen — no serviría. `sessionStorage` es exclusivo de cada pestaña (sobrevive a un refresh, pero no se comparte al abrir una pestaña nueva), que es exactamente el comportamiento pedido.

**Cómo aplicarlo:** si en el futuro se pide "que se vea una lista compartida de canciones para todos", hay que volver a traer los datos del Sheet (`GAS_URL + "?tipo=canciones"`) en vez de leer `sessionStorage` — son requerimientos opuestos, no compatibles al mismo tiempo sin un toggle explícito.

## No ofuscar `GAS_URL`

**Decisión:** no se implementó ofuscación/encriptación de la URL de Google Apps Script en el `<script>`.

**Por qué:** cualquier ofuscación en el código fuente es cosmética — en cuanto la página hace `fetch(GAS_URL)`, la URL real viaja tal cual y es visible en la pestaña Network del navegador. Ocultarla del código fuente no evita que alguien la extraiga ahí. La única forma de esconderla de verdad sería un proxy propio (servidor/función serverless intermedia), que no se justificó para este proyecto.

**Cómo aplicarlo:** la protección real contra spam se hizo del lado del servidor (Apps Script), no ocultando la URL — ver el límite de 50 caracteres en `addCancion()` y la validación de nombre existente en `confirmarInvitado()`.

## Límite de 50 caracteres por truncado, no por rechazo

**Decisión:** en `addCancion()` (AppsScript_RSVP.gs), el texto de la canción se recorta con `.slice(0, 50)` en vez de rechazar el request si excede el límite.

**Por qué:** pedido explícito del usuario ("aplica el punto 2 nomas pero a 50 caracteres"). Se replicó el mismo límite en el cliente (`maxlength="50"` en el input) para que la UI ya refleje la restricción antes de llegar al servidor.

## `index.html` como archivo de trabajo (histórico, superado en parte)

**Decisión original:** a partir del 2026-07-10 se edita solo `documentos/index.html`. `documentos/invitacion_casamiento.html` queda congelado como archivo histórico.

**Por qué:** GitHub Pages sirve `index.html` por defecto; apareció como duplicado (probablemente creado por el usuario vía GitHub para levantar Pages) y el usuario pidió consolidar el trabajo ahí.

**Actualización (mismo día):** esto ya no es "un solo archivo". Ver la decisión siguiente — ahora son dos archivos activos con un propósito distinto cada uno. `documentos/invitacion_casamiento.html` sigue congelado, sin tocar.

## Dos variantes activas: `index.html` (sin pago) vs `invitacion/index.html` (con pago)

**Decisión:** `documentos/invitacion/index.html` se creó como copia completa de `documentos/index.html`, y luego se le quitó la sección "Nuestro regalo de bodas" (+ la función `copyAlias()`) **solo** al `index.html` principal.

**Por qué:** pedido explícito del usuario — quería una versión de la invitación sin el método de pago visible (para compartir más ampliamente) y otra completa con el método de pago (`invitacion/index.html`).

**Cómo aplicarlo:** cualquier cambio de diseño, estructura, tipografía o color (sobre, calendario, RSVP, canciones, paleta general) se replica en **ambos archivos** por igual. Solo la sección de pago (y lo que dependa de ella, como `copyAlias()`) es exclusiva de `invitacion/index.html`. Si se agrega una feature nueva y no se aclara lo contrario, asumir que va en los dos.

## Sobre de apertura a pantalla completa, con paleta propia adaptada de una referencia

**Decisión:** el usuario pasó una captura de un pin de Pinterest (no se pudo leer el contenido visual vía `WebFetch` — Pinterest no expone eso a scraping) describiendo un sobre a pantalla completa: panel de color sólido arriba con borde festoneado, sello ovalado con flor + iniciales superpuesto, texto de apertura abajo. Se implementó esa estructura con la paleta de colores del sitio en vez de copiar los colores exactos de la referencia (que era bordó).

**Por qué:** mantener coherencia visual con el resto de la invitación en vez de introducir un color ajeno a la paleta.

**Cómo aplicarlo:** si en el futuro se pasan más referencias visuales (imágenes) para ajustar tipografía/colores por sección, evaluar primero si conviene adoptar el color exacto de la referencia o adaptarlo a la paleta ya establecida — preguntar si no es obvio por contexto.

## Paleta verde oliva (reemplaza marrón/dorado/crema)

**Decisión:** se reemplazó toda la paleta marrón/dorado/crema original por verdes oliva, vía `sed` con mapeo de códigos hex exactos, aplicado igual en ambos archivos.

**Mapeo aplicado** (viejo → nuevo):
- `#6b4a2f` (oscuro, texto/botones) → `#4b5320`
- `#573c26` (hover de botón) → `#3a4118`
- `#5a4636` (texto de cuerpo) → `#48472e`
- `#c9a876` (dorado, dividers/bordes decorativos) → `#9c9a52`
- `#d8b98c` (bordes de tarjetas/inputs) → `#c7c894`
- `#a1794a` (texto secundario/links) → `#7d7a3f`
- `#a98a5a` (kicker) → `#8a8a4a`
- `#8a7360` (texto muted) → `#71724a`
- `#f7ece2`, `#efe0d0`, `#f4e6d6` (fondos claros) → `#f2f1de`, `#e7e6c6`, `#eeecd4`
- `#fffaf3`, `#fffdf8` (cremas de tarjetas/inputs) → `#f9f8ec`, `#f6f5e6`
- `#e6d3b8`, `#eee0c9`, `#f2e6d5` (bordes/hovers menores) → `#dcdcb0`, `#e4e4c4`, `#eceed6`
- `#7a9a6f` (status-tag, ya era verdoso) → `#6b7a3a`
- rgbas decorativos del fondo (`201,168,118` / `178,110,130` / `120,140,110`) → (`156,163,82` / `139,150,80` / `108,128,68`)
- sombra `rgba(107,74,47,x)` → `rgba(75,83,32,x)` (coincide con `#4b5320` en rgb)

**Qué NO se tocó:** el filtro `sepia(12%) saturate(90%)` del iframe de Google Maps (riesgo de romper la legibilidad del mapa real), y "Titular: Gabriel Oros" en la sección de pago (nombre real, no parte del theme).

**Cómo aplicarlo:** si se pide ajustar un color puntual de una sección específica más adelante (con imágenes de referencia), buscar el código hex actual de esa clase primero (ya no son los marrones originales) antes de tocar nada.

## Convención: orden de nombres "Julieta & Gabriel"

**Decisión:** en toda la invitación el nombre de Julieta va primero, Gabriel segundo — en el `<title>`, la portada, el sobre de apertura y el footer.

**Excepción:** "Titular: Gabriel Oros" en la sección de pago no sigue esta regla — es el nombre de una persona real (titular de cuenta bancaria), no una mención de la pareja como par.
