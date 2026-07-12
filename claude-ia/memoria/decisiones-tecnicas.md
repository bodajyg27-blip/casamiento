# Decisiones técnicas — Invitación de casamiento

## Formato de imagen: JPEG si no hay alpha real, WebP si lo hay

**Decisión:** para las imágenes de `img/`, se elige el formato según si la imagen tiene transparencia real (canal alpha usado) o no, no por costumbre/lo que venga del diseñador.
- Si la imagen es opaca (aunque el archivo original sea PNG), se convierte a JPEG — comprime mucho mejor para fotos/diseños con degradés.
- Si necesita transparencia real (ej. `alianzas.webp`, que se recorta sobre distintos fondos), se usa WebP, no PNG — WebP soporta alpha y comprime bastante mejor que PNG para el mismo contenido.
- Además, toda imagen se redimensiona al tamaño real en que se muestra en pantalla antes de exportarla (ej. `alianzas.webp` se bajó de 1844×2304 a 500×624 porque se muestra a 1.6em de alto) — no tiene sentido servir resolución de impresión para un ícono chico.

**Por qué:** `img/sobre.png` y `img/alianzas.png` pesaban 2.8M y 3.3M respectivamente sin necesidad — ninguna de las dos tenía razón real para ser tan pesada (una no tenía alpha, la otra se mostraba 4x más chica de lo que pesaba). Ver [[desarrollos]] para el detalle de la conversión.

**Cómo aplicarlo:** cualquier imagen nueva que se agregue al proyecto debería pasar por este mismo criterio antes de commitear — no subir un PNG de varios MB directo del diseñador sin evaluar si puede ser JPEG/WebP y si puede reducirse de tamaño. Herramienta usada: Pillow (`Image.save()`), no había `cwebp`/`pngquant` instalados en la máquina.

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

## Archivos de trabajo definitivos: `index.html` e `invitacion/index.html` en la RAÍZ del repo (no en `documentos/`)

**Decisión (2026-07-11):** a partir de ahora se edita solo **`index.html`** e **`invitacion/index.html`** ubicados en la raíz del repo (no los de `documentos/`).

**Por qué:** el remoto ya tenía una copia de la invitación en la raíz (creada/editada directo desde GitHub, con su propio workflow de Pages en `.github/workflows/static.yml`) que terminó sincronizada con el contenido de `documentos/` tras los merges del 2026-07-11. El usuario decidió consolidar el trabajo ahí en vez de en `documentos/`, para simplificar y alinearse con cómo GitHub Pages sirve el sitio.

**Cómo aplicarlo:**
- Todo cambio nuevo de diseño/estructura/contenido va en `index.html` e `invitacion/index.html` (raíz).
- `documentos/index.html` y `documentos/invitacion/index.html` quedan **congelados** desde el 2026-07-11 — no se tocan más, igual que ya le pasaba a `documentos/invitacion_casamiento.html`. Si en algún momento hay que decidir entre uno y otro por una duda de "¿cuál es el que importa?", es siempre el de la raíz.
- La imagen de portada vive en `img/TARJETA.jpg` (raíz). Desde `index.html` (raíz) se referencia como `img/TARJETA.jpg`; desde `invitacion/index.html` (raíz) como `../img/TARJETA.jpg`. Ojo con no confundir estas rutas con las de los archivos congelados de `documentos/` (que usan `../img/` y `../../img/` respectivamente, por estar un nivel más adentro).

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

## Archivos de trabajo definitivos (v2): `index.html` e `invitacion/index.html` en la raíz, `documentos/` congelado del todo

**Actualización (2026-07-11), reemplaza la decisión "Archivos de trabajo definitivos" anterior:** confirmado y en efecto — se trabaja únicamente en `index.html` e `invitacion/index.html` de la **raíz** del repo. `documentos/index.html`, `documentos/invitacion/index.html` y `documentos/invitacion_casamiento.html` están **todos** congelados y desactualizados a propósito.

**Cómo aplicarlo:** antes de tocar cualquier `index.html` del proyecto, confirmar que sea el de la raíz (no el de `documentos/`). Si alguna vez hay que decidir "¿cuál es la fuente de verdad?", es siempre el de la raíz.

## Galería de fotos: JSON+base64 en vez de blob binario o Drive público

**Decisión:** las fotos de la galería se sirven codificadas en base64 dentro de una respuesta JSON de Apps Script (`{ mimeType, data }`), no como archivo binario directo ni con el link público de Drive.

**Por qué:** se probaron dos alternativas y ambas fallaron:
1. `return file.getBlob()` directo desde `doGet` → Apps Script tira "el valor que muestra no es un valor de retorno admitido". No soporta devolver un blob crudo desde un web app.
2. Compartir cada archivo como "cualquiera con el link" (`file.setSharing(...)`) y que el navegador pida la URL de Drive directo → los requests anónimos (sin sesión de Google) redirigían a un login, aun con el sharing bien configurado. No quedó claro por qué (¿restricción de la cuenta/organización?), pero no era confiable.

**Cómo aplicarlo:** el cliente arma la imagen con `img.src = 'data:' + mimeType + ';base64,' + data`, construida en JS a partir del JSON. Es más pesado que servir binario directo, pero funciona de forma confiable sin depender de configuración de sharing de Drive. Si en el futuro hay muchas fotos y esto se vuelve lento, reconsiderar.

## Animación de secciones en dos niveles: `.visible` vs `.centered`

**Decisión:** el `IntersectionObserver` que revela las secciones al scrollear maneja **dos clases independientes**: `.visible` (la tarjeta entera hace fade+slide, se agrega una sola vez al 15% de intersección y no se saca más) y `.centered` (dispara la animación de los *datos internos* — contador, horas, monto, nombres — al 50% de intersección, y se **saca y pone** con cada cambio, así se repite cada vez que la sección se recentra).

**Por qué:** pedido explícito del usuario en dos pasos — primero quiso que los datos internos tuvieran su propio efecto de aparición (no solo la tarjeta), después que ese efecto se repitiera cada vez que volvía a centrar la sección scrolleando para arriba y para abajo.

**Cómo aplicarlo:** cualquier dato nuevo que se agregue a una sección y deba tener este efecto de aparición usa `.reveal.centered .clase-del-dato` en el CSS (no `.reveal.visible`), con su propio `transition-delay` para escalonarlo respecto a los demás datos de la misma sección.

## La primera sección no se observa desde el arranque — espera a que se abra el sobre

**Decisión:** la sección `.reveal` de índice 0 (la portada) no se pasa al `IntersectionObserver` al cargar la página. Se marca `.visible` de una (la tarjeta se ve apenas se abre el sobre), pero el `.centered` (que dispara la animación de los nombres) recién se empieza a observar cuando el usuario **abre el sobre** (`revealFirstSection()`, llamada desde el click handler del sobre).

**Por qué:** si se observara desde el arranque, el `IntersectionObserver` dispara su callback casi inmediatamente (la portada ya está en el viewport al cargar), agregando `.centered` mientras el sobre todavía tapa la pantalla. La animación de los nombres (dura ~2s) se reproduce entera *detrás* del sobre opaco — para cuando el usuario lo abre, ya terminó, se ve estática. No alcanzaba con un `requestAnimationFrame` doble (eso resuelve un problema de timing de *pintado*, no de *cuándo conceptualmente* debería arrancar la animación).

**Cómo aplicarlo:** si se agrega contenido animado nuevo a la portada, va a funcionar solo porque usa la misma clase `.reveal.centered` — no hace falta tocar nada extra, `revealFirstSection()` ya se encarga de arrancar la observación en el momento correcto.

## Sobre de apertura: click/tap, no scroll — y por qué

**Decisión:** el sobre se abre con un click/tap (`classList.add('open')` + fade/scale por CSS transition), no con una animación ligada al scroll (`scrollY`-driven).

**Por qué:** se implementó la versión scroll-driven (el sobre se iba desvaneciendo en proporción exacta a cuánto scrolleaba el usuario, sin necesidad de click) y funcionaba técnicamente, pero el usuario prefirió volver al modelo original de click. También se probó y se descartó una solapa animada en 3D (`rotateX`) imitando una secuencia de fotos de referencia — el usuario la encontró fea y se revirtió por completo, sin dejar rastros en el código.

**Cómo aplicarlo:** no reintroducir el mecanismo scroll-driven sin que el usuario lo pida explícitamente de nuevo — ya se probó y se descartó una vez.

## Tapar texto de una imagen y reemplazarlo por HTML animado (patrón repetible)

**Decisión/patrón:** cuando una imagen de diseño trae texto dibujado adentro (nombres, horas, lugar) que se necesita hacer dinámico o animado, no se edita la imagen "a mano" — se usa Python/Pillow para: (1) ubicar la banda de píxeles de ese texto (por brillo/oscuridad), (2) muestrear el color de fondo alrededor, (3) pintar un rectángulo sólido de ese color tapando el texto original, (4) superponer el texto real en HTML en esa posición exacta, con la tipografía y el efecto de aparición del resto del sitio.

**Por qué:** permite mantener el diseño gráfico que provee el usuario (mismo marco, misma textura) pero con contenido que puede animarse, actualizarse o traerse del Sheet — cosa que un texto dibujado en un JPG no permite.

**Cómo aplicarlo:** este patrón ya se usó en `lugares.jpg` (hora de ceremonia/fiesta) y `TARJETA.jpg` (nombres de la portada). Si aparece una imagen nueva con texto que haya que "activar", replicar el mismo proceso. Siempre verificar el parche componiendo la imagen resultante sobre un fondo sólido antes de darlo por bueno (ver también la nota de `alianzas.png` sobre falsos positivos de "transparencia" en el visor).
